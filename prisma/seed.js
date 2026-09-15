import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const plans = [
  { code:'FAMILY-10', name:'Family Starter', type:'FAMILY', capacity:10, amountCents:2500 },
  { code:'FRIENDS-15', name:'Friends Circle', type:'FRIENDS', capacity:15, amountCents:2500 },
  { code:'SOCIAL-50', name:'Social Media Circle', type:'SOCIAL_MEDIA', capacity:50, amountCents:2500 },
];

async function main(){
  for(const p of plans){
    await prisma.circle.upsert({where:{code:p.code},update:{name:p.name,type:p.type,capacity:p.capacity,amountCents:p.amountCents},create:{...p,houseFeeCents:10000}});
  }
  console.log('Seeded PayaCircle starter circles.');
}
main().finally(()=>prisma.$disconnect());
