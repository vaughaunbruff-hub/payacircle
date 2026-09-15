import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();
const app = express();
app.use(helmet());
app.use(express.json({limit:"100kb"}));
app.use(cookieParser());
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use(express.static("public"));

const PORT=process.env.PORT||3000;
const JWT_SECRET=process.env.JWT_SECRET;
if(!JWT_SECRET) throw new Error("JWT_SECRET is required");

function tokenFor(user){return jwt.sign({sub:user.id,role:user.role},JWT_SECRET,{expiresIn:"2h"});}
function auth(req,res,next){
  try{
    const raw=req.cookies.cp_session;
    if(!raw) return res.status(401).json({error:"Authentication required"});
    req.user=jwt.verify(raw,JWT_SECRET);
    next();
  }catch{return res.status(401).json({error:"Invalid session"});}
}
function admin(req,res,next){if(req.user?.role!=="ADMIN")return res.status(403).json({error:"Admin only"});next();}

async function paypalToken(){
  const base=process.env.PAYPAL_MODE==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";
  const basic=Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const r=await fetch(`${base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${basic}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
  if(!r.ok) throw new Error("PayPal authentication failed");
  return (await r.json()).access_token;
}
function paypalBase(){return process.env.PAYPAL_MODE==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";}

app.get("/api/health",async(_,res)=>{
  try { await prisma.$queryRaw`SELECT 1`; res.json({ok:true,app:"PayaCircle",mode:process.env.PAYPAL_MODE||"sandbox"}); }
  catch { res.status(503).json({ok:false,error:"Database unavailable"}); }
});

const MIN_CONTRIBUTION_CENTS = Number(process.env.MIN_CONTRIBUTION_USD||5)*100;
const MAX_CONTRIBUTION_CENTS = Number(process.env.MAX_CONTRIBUTION_USD||100)*100;
const PLAN_MIN = { FAMILY:10, FRIENDS:15, SOCIAL_MEDIA:50 };

function validContribution(amountCents){
  return Number.isInteger(amountCents) && amountCents>=MIN_CONTRIBUTION_CENTS && amountCents<=MAX_CONTRIBUTION_CENTS && amountCents%500===0;
}


app.post("/api/register",async(req,res)=>{
  const parsed=z.object({name:z.string().min(2).max(80),email:z.string().email(),password:z.string().min(10).max(100)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Invalid registration details"});
  const {name,email,password}=parsed.data;
  const exists=await prisma.user.findUnique({where:{email:email.toLowerCase()}});
  if(exists)return res.status(409).json({error:"Account already exists"});
  const passwordHash=await bcrypt.hash(password,12);
  const user=await prisma.user.create({data:{name,email:email.toLowerCase(),passwordHash}});
  res.cookie("cp_session",tokenFor(user),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:7200000});
  res.json({id:user.id,name:user.name,email:user.email});
});

app.post("/api/login",async(req,res)=>{
  const parsed=z.object({email:z.string().email(),password:z.string()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Invalid login"});
  const user=await prisma.user.findUnique({where:{email:parsed.data.email.toLowerCase()}});
  if(!user||!(await bcrypt.compare(parsed.data.password,user.passwordHash)))return res.status(401).json({error:"Incorrect email or password"});
  res.cookie("cp_session",tokenFor(user),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:7200000});
  res.json({name:user.name,email:user.email,role:user.role});
});

app.post("/api/logout",(req,res)=>{res.clearCookie("cp_session");res.json({ok:true});});

app.get("/api/circles",async(_,res)=>{
  const circles=await prisma.circle.findMany({include:{_count:{select:{memberships:true}}},orderBy:{createdAt:"desc"}});
  res.json(circles);
});

app.post("/api/circles",auth,async(req,res)=>{
  const parsed=z.object({
    name:z.string().min(2).max(80),
    type:z.enum(["FAMILY","FRIENDS","SOCIAL_MEDIA","CUSTOM"]),
    capacity:z.number().int().min(2).max(1000),
    amountUsd:z.number().multipleOf(5).min(5).max(100)
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Invalid circle plan"});
  const {name,type,capacity,amountUsd}=parsed.data;
  if(type!=="CUSTOM" && capacity<PLAN_MIN[type]) return res.status(400).json({error:`${type} circles require at least ${PLAN_MIN[type]} members`});
  const amountCents=Math.round(amountUsd*100);
  if(!validContribution(amountCents)) return res.status(400).json({error:"Contribution must be $5–$100 USD in $5 increments"});
  const code=`${type.slice(0,4)}-${Date.now().toString(36).toUpperCase()}`;
  const circle=await prisma.circle.create({data:{code,name,type,capacity,amountCents,houseFeeCents:10000}});
  res.status(201).json(circle);
});

app.get("/api/circles/:id/dates",async(req,res)=>{
  const dates=await prisma.payoutDate.findMany({where:{circleId:req.params.id},orderBy:{payoutAt:"asc"}});
  res.json(dates);
});

app.post("/api/memberships",auth,async(req,res)=>{
  const parsed=z.object({circleId:z.string(),payoutDateId:z.string()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Invalid selection"});
  const circle=await prisma.circle.findUnique({where:{id:parsed.data.circleId},include:{memberships:true}});
  const date=await prisma.payoutDate.findUnique({where:{id:parsed.data.payoutDateId}});
  if(!circle||!date||date.circleId!==circle.id)return res.status(400).json({error:"Invalid circle/date"});
  if(circle.status!=="COLLECTING")return res.status(409).json({error:"Circle is closed"});
  if(circle.amountCents<MIN_CONTRIBUTION_CENTS||circle.amountCents>MAX_CONTRIBUTION_CENTS||circle.amountCents%500!==0)return res.status(409).json({error:"Circle contribution is outside the allowed range"});
  if(circle.memberships && circle.memberships.length>=circle.capacity)return res.status(409).json({error:"Circle is full"});
  const existing=await prisma.membership.findUnique({where:{userId_circleId:{userId:req.user.sub,circleId:circle.id}}});
  if(existing)return res.status(409).json({error:"You already have a membership in this circle"});
  if(date.reserved>=date.capacity)return res.status(409).json({error:"Payout date is full"});
  const membership=await prisma.$transaction(async tx=>{
    const m=await tx.membership.create({data:{userId:req.user.sub,circleId:circle.id,payoutDateId:date.id,status:"PAYMENT_PENDING"}});
    await tx.payoutDate.update({where:{id:date.id},data:{reserved:{increment:1}}});
    return m;
  });
  res.json(membership);
});

app.post("/api/paypal/create-order",auth,async(req,res)=>{
  const parsed=z.object({membershipId:z.string()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Invalid membership"});
  const m=await prisma.membership.findUnique({where:{id:parsed.data.membershipId},include:{circle:true}});
  if(!m||m.userId!==req.user.sub||m.status!=="PAYMENT_PENDING")return res.status(404).json({error:"Membership not payable"});
  const access=await paypalToken();
  const order=await fetch(`${paypalBase()}/v2/checkout/orders`,{
    method:"POST",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json","PayPal-Request-Id":`circle-${m.id}`},
    body:JSON.stringify({intent:"CAPTURE",purchase_units:[{reference_id:m.id,custom_id:m.id,amount:{currency_code:"USD",value:(m.circle.amountCents/100).toFixed(2)},description:`PayaCircle savings contribution — ${m.circle.code}`}],application_context:{user_action:"PAY_NOW",shipping_preference:"NO_SHIPPING"}})
  });
  const data=await order.json();
  if(!order.ok)return res.status(502).json({error:"PayPal order creation failed",details:data});
  await prisma.payment.create({data:{userId:req.user.sub,circleId:m.circleId,membershipId:m.id,paypalOrderId:data.id,amountCents:m.circle.amountCents,status:"CREATED"}});
  res.json({id:data.id});
});

app.post("/api/paypal/capture-order",auth,async(req,res)=>{
  const parsed=z.object({orderId:z.string()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Invalid order"});
  const payment=await prisma.payment.findUnique({where:{paypalOrderId:parsed.data.orderId},include:{membership:true}});
  if(!payment||payment.userId!==req.user.sub)return res.status(404).json({error:"Payment not found"});
  const access=await paypalToken();
  const r=await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(parsed.data.orderId)}/capture`,{method:"POST",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"}});
  const data=await r.json();
  if(!r.ok)return res.status(502).json({error:"PayPal capture failed",details:data});
  const capture=data?.purchase_units?.[0]?.payments?.captures?.[0];
  if(capture?.status==="COMPLETED"){
    const fee=Number(capture?.seller_receivable_breakdown?.paypal_fee?.value||0);
    await prisma.$transaction([
      prisma.payment.update({where:{id:payment.id},data:{status:"CAPTURED",paypalCaptureId:capture.id,paypalFeeCents:Math.round(fee*100)}}),
      prisma.membership.update({where:{id:payment.membershipId},data:{status:"PAID"}})
    ]);
  }
  res.json({status:capture?.status||data.status});
});

/*
  IMPORTANT: PayPal webhook verification is required before trusting webhook events.
  Register this route with raw request handling in a hardened production deployment.
  For a production build, use PayPal's verify-webhook-signature endpoint with:
  PAYPAL_WEBHOOK_ID + transmission headers + raw body.
*/
app.post("/api/paypal/webhook",async(req,res)=>{
  // Placeholder safety behavior: acknowledge only after basic receipt.
  // DO NOT use this placeholder as proof of payment in production.
  console.warn("Webhook received; verification implementation must be enabled before live use.");
  res.sendStatus(200);
});

app.get("/api/me",auth,async(req,res)=>{
  const user=await prisma.user.findUnique({where:{id:req.user.sub},include:{memberships:{include:{circle:true,payoutDate:true,payments:true,payout:true}}}});
  res.json(user);
});

app.get("/api/admin/summary",auth,admin,async(_,res)=>{
  const [users,circles,paid,payouts]=await Promise.all([
    prisma.user.count(),prisma.circle.count(),prisma.payment.count({where:{status:"CAPTURED"}}),prisma.payout.count()
  ]);
  res.json({users,circles,paidPayments:paid,payouts});
});

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Internal server error"});});
app.listen(PORT,"0.0.0.0",()=>console.log(`PayaCircle listening on port ${PORT}`));
