import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { z } from "zod";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  express.json({
    limit: "100kb",
    verify: (req, res, buf) => {
      if (req.originalUrl === "/api/paypal/webhook") {
        req.rawBody = Buffer.from(buf);
      }
    }
  })
);
app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const APP_URL =
  process.env.APP_URL ||
  `http://localhost:${PORT}`;

const PAYPAL_MODE =
  process.env.PAYPAL_MODE || "sandbox";

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID =
  process.env.PAYPAL_WEBHOOK_ID;
const DEFAULT_BANKER_FEE_BPS = 700;

/* --------------------------------
   SESSION
--------------------------------- */

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:
      1000 * 60 * 60 * 24 * 7,
    path: "/"
  };
}

function tokenFor(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function auth(req, res, next) {
  try {
    const token =
      req.cookies.cp_session;

    if (!token) {
      return res.status(401).json({
        error: "Not signed in"
      });
    }

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      error: "Session expired"
    });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({
      error: "Admin access required"
    });
  }

  next();
}

/* --------------------------------
   HELPERS
--------------------------------- */

function validContribution(amountUsd) {
  return (
    Number.isInteger(amountUsd) &&
    amountUsd >= 5 &&
    amountUsd <= 100 &&
    amountUsd % 5 === 0
  );
}

function paypalBaseUrl() {
  return PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken() {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PayPal is not configured"
    );
  }

  const credentials =
    Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

  const response =
    await fetch(
      `${paypalBaseUrl()}/v1/oauth2/token`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body:
          "grant_type=client_credentials"
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Unable to connect to PayPal"
    );
  }

  return data.access_token;
}

async function paypalRequest(
  path,
  options = {}
) {
  const accessToken =
    await paypalAccessToken();

  const response =
    await fetch(
      `${paypalBaseUrl()}${path}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",

          ...(options.headers || {})
        }
      }
    );

  const text =
    await response.text();

  let data = {};

  try {
    data =
      text ? JSON.parse(text) : {};
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.details?.[0]
        ?.description ||
      data?.error_description ||
      "PayPal request failed";

    const error =
      new Error(message);

    error.status =
      response.status;

    error.paypal =
      data;

    throw error;
  }

  return data;
}

/* --------------------------------
   BANKER FEE
--------------------------------- */

async function getBankerFeeBps() {
  const setting =
    await prisma.systemSetting.findUnique({
      where: {
        key: "BANKER_FEE_BPS"
      }
    });

  if (!setting) {
    const created =
      await prisma.systemSetting.create({
        data: {
          key: "BANKER_FEE_BPS",
          value:
            String(
              DEFAULT_BANKER_FEE_BPS
            ),
          description:
            "PayaCircle banker fee in basis points. 700 = 7%."
        }
      });

    return Number(
      created.value
    );
  }

  const value =
    Number(setting.value);

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 10000
  ) {
    return DEFAULT_BANKER_FEE_BPS;
  }

  return Math.round(value);
}

function calculatePayout(
  grossAmountCents,
  bankerFeeBps
) {
  const bankerFeeCents =
    Math.round(
      grossAmountCents *
        bankerFeeBps /
        10000
    );

  const netAmountCents =
    Math.max(
      0,
      grossAmountCents -
        bankerFeeCents
    );

  return {
    grossAmountCents,
    bankerFeeBps,
    bankerFeeCents,
    paypalFeeCents: 0,
    netAmountCents
  };
}

async function ensureBankerFeeSetting() {
  await prisma.systemSetting.upsert({
    where: {
      key: "BANKER_FEE_BPS"
    },

    update: {},

    create: {
      key: "BANKER_FEE_BPS",
      value:
        String(
          DEFAULT_BANKER_FEE_BPS
        ),
      description:
        "PayaCircle banker fee in basis points. 700 = 7%."
    }
  });
}

/* --------------------------------
   CREATE PAYOUT RECORD
--------------------------------- */

async function createPayoutForMembership(
  membershipId
) {
  const membership =
    await prisma.membership.findUnique({
      where: {
        id: membershipId
      },

      include: {
        circle: true,
        payoutDate: true,
        user: true,
        payout: true
      }
    });

  if (!membership) {
    return null;
  }

  if (
    membership.status !==
    "PAID"
  ) {
    return null;
  }

  if (!membership.payoutDateId) {
    return null;
  }

  if (!membership.payoutDate) {
    return null;
  }

  if (membership.payout) {
    return membership.payout;
  }

  if (!membership.user.paypalEmail) {
    return null;
  }

  /*
    The full circle pool is:

    contribution × number of members

    The member-facing banker fee is then
    deducted from that gross payout.
  */

  const grossAmountCents =
    membership.circle.amountCents *
    membership.circle.capacity;

  const bankerFeeBps =
    await getBankerFeeBps();

  const amounts =
    calculatePayout(
      grossAmountCents,
      bankerFeeBps
    );

  const payout =
    await prisma.payout.create({
      data: {
        userId:
          membership.userId,

        circleId:
          membership.circleId,

        membershipId:
          membership.id,

        payoutDateId:
          membership.payoutDateId,

        grossAmountCents:
          amounts.grossAmountCents,

        bankerFeeBps:
          amounts.bankerFeeBps,

        bankerFeeCents:
          amounts.bankerFeeCents,

        paypalFeeCents:
          amounts.paypalFeeCents,

        netAmountCents:
          amounts.netAmountCents,

        paypalEmail:
          membership.user.paypalEmail,

        status:
          "SCHEDULED"
      }
    });

  return payout;
}

/* --------------------------------
   PROCESS DUE PAYOUTS
--------------------------------- */

let payoutProcessorRunning = false;

async function processDuePayouts() {
  if (payoutProcessorRunning) {
    return;
  }

  payoutProcessorRunning = true;

  try {
    const now =
      new Date();

    const payouts =
      await prisma.payout.findMany({
        where: {
          status: "SCHEDULED",

          payoutDate: {
            payoutAt: {
              lte: now
            }
          }
        },

        include: {
          user: true,
          circle: true,
          payoutDate: true,
          membership: true
        },

        orderBy: {
          payoutDate: {
            payoutAt: "asc"
          }
        },

        take: 25
      });

    for (const payout of payouts) {
      await sendPayout(
        payout
      );
    }
  } catch (error) {
    console.error(
      "Payout processor error:",
      error
    );
  } finally {
    payoutProcessorRunning = false;
  }
}

async function sendPayout(payout) {
  if (
    payout.status !==
    "SCHEDULED"
  ) {
    return;
  }

  if (!payout.paypalEmail) {
    console.error(
      `Payout ${payout.id} has no PayPal email`
    );

    await prisma.payout.update({
      where: {
        id: payout.id
      },

      data: {
        status:
          "FAILED"
      }
    });

    return;
  }

  /*
    Mark it PROCESSING before contacting PayPal.
    This prevents the local processor from
    attempting the same payout repeatedly.
  */

  const claimed =
    await prisma.payout.updateMany({
      where: {
        id: payout.id,

        status:
          "SCHEDULED"
      },

      data: {
        status:
          "PROCESSING"
      }
    });

  if (
    claimed.count !== 1
  ) {
    return;
  }

  try {
    const senderItemId =
      payout.id;

    const amount =
      (
        payout.netAmountCents /
        100
      ).toFixed(2);

    const result =
      await paypalRequest(
        "/v1/payments/payouts",
        {
          method: "POST",

          body:
            JSON.stringify({
              sender_batch_header: {
                sender_batch_id:
                  `PAYACIRCLE-${payout.id}`,

                email_subject:
                  "Your PayaCircle payout is on the way",

                email_message:
                  "Your scheduled PayaCircle payout has been initiated."
              },

              items: [
                {
                  recipient_type:
                    "EMAIL",

                  amount: {
                    value:
                      amount,

                    currency:
                      "USD"
                  },

                  receiver:
                    payout.paypalEmail,

                  note:
                    "PayaCircle scheduled circle payout",

                  sender_item_id:
                    senderItemId
                }
              ]
            })
        }
      );

    const batchId =
      result?.batch_header
        ?.payout_batch_id ||
      null;

    /*
      PayPal normally returns the batch as
      PENDING/PROCESSING. The webhook will
      move our record to COMPLETED when PayPal
      confirms the individual payout.
    */

    await prisma.payout.update({
      where: {
        id: payout.id
      },

      data: {
        paypalBatchId:
          batchId,

        status:
          "PROCESSING"
      }
    });

    console.log(
      `PayaCircle payout ${payout.id} sent to PayPal. Batch: ${batchId}`
    );
  } catch (error) {
    console.error(
      `PayPal payout failed for ${payout.id}:`,
      error
    );

    await prisma.payout.update({
      where: {
        id: payout.id
      },

      data: {
        status:
          "FAILED"
      }
    });
  }
}

/* --------------------------------
   HEALTH
--------------------------------- */

app.get(
  "/api/health",
  async (_, res) => {
    res.json({
      ok: true,
      app: "PayaCircle",
      mode: PAYPAL_MODE
    });
  }
);

/* --------------------------------
   REGISTER
--------------------------------- */

app.post(
  "/api/register",
  async (req, res) => {
    const parsed =
      z
        .object({
          name:
            z.string()
              .trim()
              .min(2)
              .max(100),

          email:
            z.string()
              .email(),

          password:
            z.string()
              .min(8)
              .max(100)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Please provide a valid name, email and password of at least 8 characters"
      });
    }

    const name =
      parsed.data.name.trim();

    const email =
      parsed.data.email
        .trim()
        .toLowerCase();

    const existing =
      await prisma.user.findUnique({
        where: {
          email
        }
      });

    if (existing) {
      return res.status(409).json({
        error:
          "An account with that email already exists"
      });
    }

    const passwordHash =
      await bcrypt.hash(
        parsed.data.password,
        12
      );

    const user =
      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash
        }
      });

    res.cookie(
      "cp_session",
      tokenFor(user),
      sessionCookieOptions()
    );

    res.status(201).json({
      name: user.name,
      email: user.email,
      role: user.role
    });
  }
);

/* --------------------------------
   LOGIN
--------------------------------- */

app.post(
  "/api/login",
  async (req, res) => {
    const parsed =
      z
        .object({
          email:
            z.string()
              .email(),

          password:
            z.string()
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Invalid login"
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email:
            parsed.data.email
              .trim()
              .toLowerCase()
        }
      });

    if (
      !user ||
      !(await bcrypt.compare(
        parsed.data.password,
        user.passwordHash
      ))
    ) {
      return res.status(401).json({
        error:
          "Incorrect email or password"
      });
    }

    res.cookie(
      "cp_session",
      tokenFor(user),
      sessionCookieOptions()
    );

    res.json({
      name: user.name,
      email: user.email,
      role: user.role
    });
  }
);

/* --------------------------------
   LOGOUT
--------------------------------- */

app.post(
  "/api/logout",
  (req, res) => {
    res.clearCookie(
      "cp_session",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/"
      }
    );

    res.json({
      ok: true
    });
  }
);

/* --------------------------------
   CURRENT USER
--------------------------------- */

app.get(
  "/api/me",
  auth,
  async (req, res) => {
    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.id
        },

        select: {
          id: true,
          name: true,
          email: true,
          paypalEmail: true,
          role: true,
          createdAt: true,

          memberships: {
            orderBy: {
              createdAt: "desc"
            },

            include: {
              circle: true,
              payoutDate: true,
              payments: true,
              payout: true
            }
          }
        }
      });

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.json(user);
  }
);

/* --------------------------------
   SAVE PAYPAL EMAIL
--------------------------------- */

app.patch(
  "/api/me/paypal",
  auth,
  async (req, res) => {
    const parsed =
      z
        .object({
          paypalEmail:
            z.string()
              .trim()
              .email()
              .max(254)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Please enter a valid PayPal email address"
      });
    }

    const paypalEmail =
      parsed.data.paypalEmail
        .trim()
        .toLowerCase();

    try {
      const user =
        await prisma.user.update({
          where: {
            id: req.user.id
          },

          data: {
            paypalEmail
          }
        });

      /*
        If the user already paid and selected
        a payout week, create the payout record
        now that their PayPal email exists.
      */

      const memberships =
        await prisma.membership.findMany({
          where: {
            userId:
              req.user.id,

            status:
              "PAID",

            payoutDateId: {
              not: null
            },

            payout: null
          },

          select: {
            id: true
          }
        });

      for (const membership of memberships) {
        try {
          await createPayoutForMembership(
            membership.id
          );
        } catch (error) {
          console.error(
            "Unable to create payout after PayPal email update:",
            error
          );
        }
      }

      res.json({
        ok: true,
        paypalEmail:
          user.paypalEmail
      });
    } catch (error) {
      console.error(
        "PayPal email update error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to save PayPal email"
      });
    }
  }
);

/* --------------------------------
   BANKER FEE - PUBLIC
--------------------------------- */

app.get(
  "/api/settings/banker-fee",
  async (_, res) => {
    try {
      const bankerFeeBps =
        await getBankerFeeBps();

      res.json({
        bankerFeeBps,

        bankerFeePercent:
          bankerFeeBps / 100
      });
    } catch (error) {
      console.error(
        "Banker fee error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load banker fee"
      });
    }
  }
);

/* --------------------------------
   BANKER FEE - ADMIN
--------------------------------- */

app.get(
  "/api/admin/settings/banker-fee",
  auth,
  adminOnly,
  async (_, res) => {
    try {
      const bankerFeeBps =
        await getBankerFeeBps();

      res.json({
        bankerFeeBps,

        bankerFeePercent:
          bankerFeeBps / 100
      });
    } catch {
      res.status(500).json({
        error:
          "Unable to load banker fee"
      });
    }
  }
);

app.put(
  "/api/admin/settings/banker-fee",
  auth,
  adminOnly,
  async (req, res) => {
    const parsed =
      z
        .object({
          percent:
            z.number()
              .min(0)
              .max(100)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Banker fee must be between 0% and 100%"
      });
    }

    const bankerFeeBps =
      Math.round(
        parsed.data.percent *
          100
      );

    try {
      const setting =
        await prisma.systemSetting.upsert({
          where: {
            key:
              "BANKER_FEE_BPS"
          },

          update: {
            value:
              String(
                bankerFeeBps
              )
          },

          create: {
            key:
              "BANKER_FEE_BPS",

            value:
              String(
                bankerFeeBps
              ),

            description:
              "PayaCircle banker fee in basis points. 700 = 7%."
          }
        });

      res.json({
        ok: true,

        bankerFeeBps:
          Number(
            setting.value
          ),

        bankerFeePercent:
          Number(
            setting.value
          ) / 100
      });
    } catch (error) {
      console.error(
        "Update banker fee error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to update banker fee"
      });
    }
  }
);

/* --------------------------------
   PUBLIC CIRCLES
--------------------------------- */

app.get(
  "/api/circles",
  async (_, res) => {
    const circles =
      await prisma.circle.findMany({
        include: {
          _count: {
            select: {
              memberships: {
                where: {
                  status: {
                    not: "CANCELLED"
                  }
                }
              }
            }
          }
        },

        orderBy: {
          createdAt: "desc"
        }
      });

    res.json(circles);
  }
);

/* --------------------------------
   SINGLE CIRCLE
--------------------------------- */

app.get(
  "/api/circles/:id",
  async (req, res) => {
    const circle =
      await prisma.circle.findUnique({
        where: {
          id: req.params.id
        },

        include: {
          _count: {
            select: {
              memberships: {
                where: {
                  status: {
                    not: "CANCELLED"
                  }
                }
              }
            }
          }
        }
      });

    if (!circle) {
      return res.status(404).json({
        error:
          "Circle not found"
      });
    }

    res.json(circle);
  }
);

/* --------------------------------
   CIRCLE PAYOUT DATES
--------------------------------- */

app.get(
  "/api/circles/:id/dates",
  auth,
  async (req, res) => {
    const circle =
      await prisma.circle.findUnique({
        where: {
          id: req.params.id
        }
      });

    if (!circle) {
      return res.status(404).json({
        error:
          "Circle not found"
      });
    }

    const dates =
      await prisma.payoutDate.findMany({
        where: {
          circleId:
            req.params.id
        },

        orderBy: {
          payoutAt: "asc"
        }
      });

    res.json(dates);
  }
);

/* --------------------------------
   CANCEL MEMBERSHIP
--------------------------------- */

app.post(
  "/api/memberships/:id/cancel",
  auth,
  async (req, res) => {
    const membershipId =
      req.params.id;

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const membership =
              await tx.membership.findUnique(
                {
                  where: {
                    id: membershipId
                  },

                  include: {
                    circle: true,
                    payoutDate: true
                  }
                }
              );

            if (!membership) {
              const error =
                new Error(
                  "Membership not found"
                );

              error.status = 404;

              throw error;
            }

            if (
              membership.userId !==
              req.user.id
            ) {
              const error =
                new Error(
                  "You cannot cancel this membership"
                );

              error.status = 403;

              throw error;
            }

            if (
              membership.status ===
                "CANCELLED" ||
              membership.status ===
                "REFUNDED"
            ) {
              const error =
                new Error(
                  "This membership has already been cancelled"
                );

              error.status = 409;

              throw error;
            }

            if (
              membership.circle.status !==
              "COLLECTING"
            ) {
              const error =
                new Error(
                  "This circle has already started and can no longer be cancelled"
                );

              error.status = 409;

              throw error;
            }

            const hasCapturedPayment =
              await tx.payment.findFirst(
                {
                  where: {
                    membershipId:
                      membership.id,

                    status:
                      "CAPTURED"
                  }
                }
              );

            if (hasCapturedPayment) {
              const error =
                new Error(
                  "This membership has already been paid. Please contact PayaCircle support to request a refund."
                );

              error.status = 409;

              throw error;
            }

            if (
              membership.payoutDateId
            ) {
              await tx.payoutDate.update({
                where: {
                  id:
                    membership.payoutDateId
                },

                data: {
                  reserved: {
                    decrement: 1
                  }
                }
              });
            }

            const updated =
              await tx.membership.update(
                {
                  where: {
                    id:
                      membership.id
                  },

                  data: {
                    status:
                      "CANCELLED",

                    payoutDateId:
                      null
                  },

                  include: {
                    circle: true,
                    payoutDate: true
                  }
                }
              );

            return updated;
          }
        );

      res.json({
        ok: true,

        message:
          "Your circle membership has been cancelled.",

        membership:
          result
      });
    } catch (error) {
      res.status(
        error?.status || 400
      ).json({
        error:
          error?.message ||
          "Unable to cancel membership"
      });
    }
  }
);

/* --------------------------------
   CREATE CIRCLE
--------------------------------- */

const PLAN_MIN = {
  FAMILY: 2,
  FRIENDS: 3,
  SOCIAL_MEDIA: 5,
  CUSTOM: 2
};

app.post(
  "/api/circles",
  auth,
  async (req, res) => {
    const parsed =
      z
        .object({
          name:
            z.string()
              .trim()
              .min(2)
              .max(80)
              .optional()
              .or(z.literal("")),

          type:
            z.enum([
              "FAMILY",
              "FRIENDS",
              "SOCIAL_MEDIA",
              "CUSTOM"
            ]),

          capacity:
            z.number()
              .int()
              .min(2)
              .max(1000),

          amountUsd:
            z.number()
              .int()
              .min(5)
              .max(100)
              .multipleOf(5)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Invalid circle information"
      });
    }

    const {
      name,
      type,
      capacity,
      amountUsd
    } = parsed.data;

    if (
      !validContribution(
        amountUsd
      )
    ) {
      return res.status(400).json({
        error:
          "Contribution must be between $5 and $100 in $5 increments"
      });
    }

    if (
      capacity <
      (PLAN_MIN[type] || 2)
    ) {
      return res.status(400).json({
        error:
          "This circle type requires more members"
      });
    }

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const code =
              `${type.slice(0, 4)}-` +
              Date.now()
                .toString(36)
                .toUpperCase();

            const circle =
              await tx.circle.create({
                data: {
                  code,

                  name:
                    name || null,

                  type,

                  amountCents:
                    amountUsd * 100,

                  capacity,

                  houseFeeCents:
                    10000
                }
              });

            const creatorMembership =
              await tx.membership.create({
                data: {
                  userId:
                    req.user.id,

                  circleId:
                    circle.id,

                  payoutDateId:
                    null,

                  status:
                    "PAYMENT_PENDING"
                },

                include: {
                  circle: true,
                  payoutDate: true
                }
              });

            return {
              circle,

              membership:
                creatorMembership
            };
          }
        );

      res.status(201).json({
        ...result.circle,

        membership:
          result.membership
      });
    } catch (error) {
      console.error(
        "Create circle error:",
        error
      );

      res.status(
        error?.status || 500
      ).json({
        error:
          error?.message ||
          "Unable to create circle"
      });
    }
  }
);

/* --------------------------------
   JOIN / RESERVE MEMBERSHIP
--------------------------------- */

app.post(
  "/api/memberships",
  auth,
  async (req, res) => {
    const parsed =
      z
        .object({
          circleId:
            z.string()
              .min(1)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Invalid membership request"
      });
    }

    const {
      circleId
    } = parsed.data;

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const circle =
              await tx.circle.findUnique({
                where: {
                  id: circleId
                }
              });

            if (!circle) {
              const error =
                new Error(
                  "Circle not found"
                );

              error.status = 404;

              throw error;
            }

            if (
              circle.status !==
              "COLLECTING"
            ) {
              throw new Error(
                "This circle is not accepting new members"
              );
            }

            const activeMemberCount =
              await tx.membership.count({
                where: {
                  circleId,

                  status: {
                    not: "CANCELLED"
                  }
                }
              });

            const existing =
              await tx.membership.findUnique({
                where: {
                  userId_circleId: {
                    userId:
                      req.user.id,

                    circleId
                  }
                }
              });

            if (existing) {
              if (
                existing.status !==
                "CANCELLED"
              ) {
                return {
                  membership:
                    await tx.membership.findUnique({
                      where: {
                        id:
                          existing.id
                      },

                      include: {
                        circle: true,
                        payoutDate: true
                      }
                    }),

                  circle,

                  scheduleCreated:
                    false
                };
              }

              if (
                activeMemberCount >=
                circle.capacity
              ) {
                throw new Error(
                  "Circle is full"
                );
              }

              const rejoined =
                await tx.membership.update({
                  where: {
                    id:
                      existing.id
                  },

                  data: {
                    payoutDateId:
                      null,

                    status:
                      "PAYMENT_PENDING"
                  },

                  include: {
                    circle: true,
                    payoutDate: true
                  }
                });

              const memberCount =
                activeMemberCount + 1;

              let scheduleCreated =
                false;

              let updatedCircle =
                circle;

              if (
                memberCount >=
                circle.capacity
              ) {
                const existingDates =
                  await tx.payoutDate.count({
                    where: {
                      circleId
                    }
                  });

                if (
                  existingDates === 0
                ) {
                  const firstPayoutDate =
                    new Date();

                  firstPayoutDate.setDate(
                    firstPayoutDate.getDate() +
                      7
                  );

                  firstPayoutDate.setHours(
                    12,
                    0,
                    0,
                    0
                  );

                  for (
                    let i = 0;
                    i < circle.capacity;
                    i++
                  ) {
                    const payoutAt =
                      new Date(
                        firstPayoutDate
                      );

                    payoutAt.setDate(
                      payoutAt.getDate() +
                        i * 7
                    );

                    await tx.payoutDate.create({
                      data: {
                        circleId,

                        payoutAt,

                        capacity: 1,

                        reserved: 0
                      }
                    });
                  }
                }

                updatedCircle =
                  await tx.circle.update({
                    where: {
                      id:
                        circle.id
                    },

                    data: {
                      status:
                        "READY"
                    }
                  });

                scheduleCreated =
                  true;
              }

              return {
                membership:
                  rejoined,

                circle:
                  updatedCircle,

                scheduleCreated
              };
            }

            if (
              activeMemberCount >=
              circle.capacity
            ) {
              throw new Error(
                "Circle is full"
              );
            }

            const membership =
              await tx.membership.create({
                data: {
                  userId:
                    req.user.id,

                  circleId,

                  payoutDateId:
                    null,

                  status:
                    "PAYMENT_PENDING"
                },

                include: {
                  circle: true,
                  payoutDate: true
                }
              });

            const memberCount =
              activeMemberCount + 1;

            let scheduleCreated =
              false;

            let updatedCircle =
              circle;

            if (
              memberCount >=
              circle.capacity
            ) {
              const existingDates =
                await tx.payoutDate.count({
                  where: {
                    circleId
                  }
                });

              if (
                existingDates === 0
              ) {
                const firstPayoutDate =
                  new Date();

                firstPayoutDate.setDate(
                  firstPayoutDate.getDate() +
                    7
                );

                firstPayoutDate.setHours(
                  12,
                  0,
                  0,
                  0
                );

                for (
                  let i = 0;
                  i < circle.capacity;
                  i++
                ) {
                  const payoutAt =
                    new Date(
                      firstPayoutDate
                    );

                  payoutAt.setDate(
                    payoutAt.getDate() +
                      i * 7
                  );

                  await tx.payoutDate.create({
                    data: {
                      circleId,

                      payoutAt,

                      capacity: 1,

                      reserved: 0
                    }
                  });
                }
              }

              updatedCircle =
                await tx.circle.update({
                  where: {
                    id:
                      circle.id
                  },

                  data: {
                    status:
                      "READY"
                  }
                });

              scheduleCreated =
                true;
            }

            return {
              membership,

              circle:
                updatedCircle,

              scheduleCreated
            };
          }
        );

      res.status(201).json({
        ...result.membership,

        circle:
          result.circle,

        scheduleCreated:
          result.scheduleCreated
      });
    } catch (error) {
      const message =
        error?.message ||
        "Unable to reserve membership";

      const status =
        error?.status ||
        (message.includes(
          "full"
        )
          ? 409
          : message.includes(
              "not found"
            )
          ? 404
          : 400);

      res.status(status).json({
        error: message
      });
    }
  }
);

/* --------------------------------
   CHOOSE PAYOUT WEEK
--------------------------------- */

app.post(
  "/api/memberships/:id/payout-date",
  auth,
  async (req, res) => {
    const parsed =
      z
        .object({
          payoutDateId:
            z.string()
              .min(1)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Please select a valid payout week"
      });
    }

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const membership =
              await tx.membership.findUnique({
                where: {
                  id:
                    req.params.id
                },

                include: {
                  circle: true,
                  payoutDate: true,
                  user: true,
                  payout: true
                }
              });

            if (!membership) {
              const error =
                new Error(
                  "Membership not found"
                );

              error.status = 404;

              throw error;
            }

            if (
              membership.userId !==
              req.user.id
            ) {
              const error =
                new Error(
                  "You cannot change this membership"
                );

              error.status = 403;

              throw error;
            }

            if (
              membership.status ===
                "CANCELLED" ||
              membership.status ===
                "REFUNDED"
            ) {
              throw new Error(
                "This membership has been cancelled"
              );
            }

            /*
              A payout week can only be selected
              after the member has completed
              their contribution.
            */

            if (
              membership.status !==
              "PAID"
            ) {
              throw new Error(
                "Please complete your contribution before selecting a payout week"
              );
            }

            /*
              The circle must already be full
              and the weekly schedule must
              have been created.
            */

            if (
              membership.circle.status !==
              "READY"
            ) {
              throw new Error(
                "The payout schedule is not ready yet. Your circle must be full first."
              );
            }

            const payoutDate =
              await tx.payoutDate.findUnique({
                where: {
                  id:
                    parsed.data
                      .payoutDateId
                }
              });

            if (!payoutDate) {
              const error =
                new Error(
                  "Payout week not found"
                );

              error.status = 404;

              throw error;
            }

            /*
              Make absolutely sure the selected
              week belongs to this circle.
            */

            if (
              payoutDate.circleId !==
              membership.circleId
            ) {
              throw new Error(
                "That payout week does not belong to this circle"
              );
            }

            /*
              If the member clicks the week they
              already have, simply return the
              current membership.
            */

            if (
              membership.payoutDateId ===
              payoutDate.id
            ) {
              return membership;
            }

            /*
              Reserve the new week atomically.
              This prevents two members from
              successfully selecting the same
              available week at the same time.
            */

            const reserved =
              await tx.payoutDate.updateMany({
                where: {
                  id:
                    payoutDate.id,

                  reserved: {
                    lt:
                      payoutDate.capacity
                  }
                },

                data: {
                  reserved: {
                    increment: 1
                  }
                }
              });

            if (
              reserved.count !== 1
            ) {
              throw new Error(
                "That payout week has already been selected. Please choose another week."
              );
            }

            /*
              Release the member's previous week
              only after the new week has been
              successfully reserved.
            */

            if (
              membership.payoutDateId
            ) {
              await tx.payoutDate.updateMany({
                where: {
                  id:
                    membership.payoutDateId,

                  reserved: {
                    gt: 0
                  }
                },

                data: {
                  reserved: {
                    decrement: 1
                  }
                }
              });
            }

            /*
              Save the new payout week.
            */

            const updated =
              await tx.membership.update({
                where: {
                  id:
                    membership.id
                },

                data: {
                  payoutDateId:
                    payoutDate.id,

                  status:
                    "PAID"
                },

                include: {
                  circle: true,
                  payoutDate: true,
                  user: true,
                  payout: true
                }
              });

            /*
              If a payout record already exists,
              move that payout record to the newly
              selected week.

              If one does not exist and the member
              has a PayPal email, create it.
            */

            if (updated.payout) {
              await tx.payout.update({
                where: {
                  id:
                    updated.payout.id
                },

                data: {
                  payoutDateId:
                    payoutDate.id
                }
              });
            }

            return updated;
          }
        );

      /*
        If the member has selected a payout week
        but no payout record exists yet, create it
        after the transaction completes.

        This is intentionally separate because
        createPayoutForMembership() uses the main
        Prisma client rather than the transaction
        client.
      */

      let finalMembership =
        result;

      if (
        result.status === "PAID" &&
        result.payoutDateId
      ) {
        try {
          const existingPayout =
            await prisma.payout.findUnique({
              where: {
                membershipId:
                  result.id
              }
            });

          if (!existingPayout) {
            await createPayoutForMembership(
              result.id
            );
          }
        } catch (error) {
          console.error(
            "Unable to create payout after week selection:",
            error
          );
        }

        /*
          Reload the membership so the frontend
          receives the latest payout information.
        */

        finalMembership =
          await prisma.membership.findUnique({
            where: {
              id:
                result.id
            },

            include: {
              circle: true,
              payoutDate: true,
              payout: true
            }
          });
      }

      res.json({
        ok: true,

        message:
          "Your preferred payout week has been saved.",

        membership:
          finalMembership
      });
    } catch (error) {
      console.error(
        "Payout week selection error:",
        error
      );

      res.status(
        error?.status || 400
      ).json({
        error:
          error?.message ||
          "Unable to select payout week"
      });
    }
  }
);

/* --------------------------------
   PAYPAL CREATE ORDER
--------------------------------- */

app.post(
  "/api/paypal/create-order",
  auth,
  async (req, res) => {
    const parsed =
      z
        .object({
          circleId:
            z.string()
              .min(1),

          membershipId:
            z.string()
              .min(1)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Please select your circle membership before paying"
      });
    }

    try {
      const circle =
        await prisma.circle.findUnique({
          where: {
            id:
              parsed.data.circleId
          }
        });

      if (!circle) {
        return res.status(404).json({
          error:
            "Circle not found"
        });
      }

      const membership =
        await prisma.membership.findUnique({
          where: {
            id:
              parsed.data.membershipId
          }
        });

      if (!membership) {
        return res.status(404).json({
          error:
            "Membership not found"
        });
      }

      if (
        membership.userId !==
        req.user.id
      ) {
        return res.status(403).json({
          error:
            "Membership does not belong to this account"
        });
      }

      if (
        membership.circleId !==
        circle.id
      ) {
        return res.status(400).json({
          error:
            "Membership does not belong to this circle"
        });
      }

      if (
        membership.status ===
        "CANCELLED"
      ) {
        return res.status(409).json({
          error:
            "This membership has been cancelled"
        });
      }

      if (
        membership.status ===
        "PAID"
      ) {
        return res.status(409).json({
          error:
            "This membership has already been paid"
        });
      }

      const bankerFeeBps =
        await getBankerFeeBps();

      const grossAmountCents =
        circle.amountCents *
        circle.capacity;

      const payout =
        calculatePayout(
          grossAmountCents,
          bankerFeeBps
        );

      const amount =
        (
          circle.amountCents /
          100
        ).toFixed(2);

      const order =
        await paypalRequest(
          "/v2/checkout/orders",
          {
            method: "POST",

            headers: {
              Prefer:
                "return=representation"
            },

            body:
              JSON.stringify({
                intent:
                  "CAPTURE",

                purchase_units: [
                  {
                    reference_id:
                      circle.id,

                    description:
                      `PayaCircle contribution - ${circle.code}`,

                    amount: {
                      currency_code:
                        "USD",

                      value:
                        amount
                    }
                  }
                ],

                application_context: {
                  brand_name:
                    "PayaCircle",

                  landing_page:
                    "LOGIN",

                  user_action:
                    "PAY_NOW",

                  return_url:
                    `${APP_URL}/?paypal=success`,

                  cancel_url:
                    `${APP_URL}/?paypal=cancel`
                }
              })
          }
        );

      const payment =
        await prisma.payment.create({
          data: {
            userId:
              req.user.id,

            circleId:
              circle.id,

            membershipId:
              membership.id,

            paypalOrderId:
              order.id,

            amountCents:
              circle.amountCents,

            status:
              "CREATED"
          }
        });

      res.json({
        orderId:
          order.id,

        paymentId:
          payment.id,

        approvalUrl:
          order.links?.find(
            (link) =>
              link.rel ===
                "approve" ||
              link.rel ===
                "payer-action"
          )?.href ||
          null,

        bankerFeeBps,

        bankerFeePercent:
          bankerFeeBps / 100,

        estimatedGrossPayout:
          payout.grossAmountCents,

        estimatedBankerFee:
          payout.bankerFeeCents,

        estimatedNetPayout:
          payout.netAmountCents
      });
    } catch (error) {
      console.error(
        "PayPal create order error:",
        error
      );

      res.status(
        error?.status || 500
      ).json({
        error:
          error?.message ||
          "Unable to create PayPal order"
      });
    }
  }
);

/* --------------------------------
   PAYPAL CAPTURE ORDER
--------------------------------- */

app.post(
  "/api/paypal/capture-order",
  auth,
  async (req, res) => {
    const parsed =
      z
        .object({
          orderId:
            z.string()
              .min(1)
        })
        .safeParse(
          req.body
        );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "Invalid PayPal order"
      });
    }

    try {
      const payment =
        await prisma.payment.findUnique({
          where: {
            paypalOrderId:
              parsed.data.orderId
          },

          include: {
            circle: true,
            membership: true
          }
        });

      if (!payment) {
        return res.status(404).json({
          error:
            "Payment not found"
        });
      }

      if (
        payment.userId !==
        req.user.id
      ) {
        return res.status(403).json({
          error:
            "Payment does not belong to this account"
        });
      }

      if (
        payment.status ===
        "CAPTURED"
      ) {
        return res.json({
          ok: true,

          status:
            "CAPTURED",

          payment
        });
      }

      const order =
        await paypalRequest(
          `/v2/checkout/orders/${encodeURIComponent(
            parsed.data.orderId
          )}`,
          {
            method: "GET"
          }
        );

      let captureData =
        order.purchase_units?.[0]
          ?.payments?.captures?.[0];

      if (
        order.status !==
        "COMPLETED"
      ) {
        const capture =
          await paypalRequest(
            `/v2/checkout/orders/${encodeURIComponent(
              parsed.data.orderId
            )}/capture`,
            {
              method: "POST",

              headers: {
                Prefer:
                  "return=representation"
              },

              body: "{}"
            }
          );

        captureData =
          capture.purchase_units?.[0]
            ?.payments?.captures?.[0];
      }

      const capturedAmount =
        captureData?.amount?.value;

      const capturedCurrency =
        captureData?.amount
          ?.currency_code;

      const expectedAmount =
        (
          payment.amountCents /
          100
        ).toFixed(2);

      if (
        capturedCurrency !==
          "USD" ||
        capturedAmount !==
          expectedAmount
      ) {
        await prisma.payment.update({
          where: {
            id:
              payment.id
          },

          data: {
            status:
              "FAILED"
          }
        });

        return res.status(400).json({
          error:
            "PayPal payment amount could not be verified"
        });
      }

      if (!captureData?.id) {
        throw new Error(
          "PayPal payment could not be verified"
        );
      }

      const paypalFeeCents =
        captureData
          ?.seller_receivable_breakdown
          ?.paypal_fee
          ?.value
          ? Math.round(
              Number(
                captureData
                  .seller_receivable_breakdown
                  .paypal_fee
                  .value
              ) * 100
            )
          : null;

      const updatedPayment =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.payment.update({
                where: {
                  id:
                    payment.id
                },

                data: {
                  status:
                    "CAPTURED",

                  paypalCaptureId:
                    captureData.id,

                  paypalFeeCents
                }
              });

            if (
              payment.membershipId
            ) {
              await tx.membership.update({
                where: {
                  id:
                    payment.membershipId
                },

                data: {
                  status:
                    "PAID"
                }
              });
            }

            return updated;
          }
        );

      /*
        Payment is now confirmed.

        If the member already selected a payout
        week and has a PayPal email, create the
        scheduled payout record.
      */

      let payout = null;

      if (
        payment.membershipId
      ) {
        try {
          payout =
            await createPayoutForMembership(
              payment.membershipId
            );
        } catch (error) {
          console.error(
            "Payout record creation error:",
            error
          );
        }
      }

      res.json({
        ok: true,

        status:
          "CAPTURED",

        payment:
          updatedPayment,

        payout
      });
    } catch (error) {
      console.error(
        "PayPal capture error:",
        error
      );

      try {
        await prisma.payment.updateMany({
          where: {
            paypalOrderId:
              parsed.data.orderId,

            userId:
              req.user.id,

            status: {
              in: [
                "CREATED",
                "APPROVED"
              ]
            }
          },

          data: {
            status:
              "FAILED"
          }
        });
      } catch {
        // Ignore secondary update error.
      }

      res.status(
        error?.status || 500
      ).json({
        error:
          error?.message ||
          "Unable to capture PayPal payment"
      });
    }
  }
);

/* --------------------------------
   PAYPAL WEBHOOK
--------------------------------- */

app.post(
  "/api/paypal/webhook",
  async (req, res) => {
    const eventType =
      req.body?.event_type ||
      "unknown";

    console.log(
      "PayPal webhook received:",
      eventType
    );

    try {
      const resource =
        req.body?.resource;

      const payoutItemId =
        resource?.payout_item_id ||
        resource?.payout_item
          ?.payout_item_id ||
        null;

      const senderItemId =
        resource?.sender_item_id ||
        null;

      const payoutBatchId =
        resource?.payout_batch_id ||
        resource?.payout_batch
          ?.payout_batch_id ||
        null;

      let payout = null;

      if (senderItemId) {
        payout =
          await prisma.payout.findUnique({
            where: {
              id:
                senderItemId
            }
          });
      }

      if (
        !payout &&
        payoutItemId
      ) {
        payout =
          await prisma.payout.findFirst({
            where: {
              paypalItemId:
                payoutItemId
            }
          });
      }

      if (
        !payout &&
        payoutBatchId
      ) {
        payout =
          await prisma.payout.findFirst({
            where: {
              paypalBatchId:
                payoutBatchId
            }
          });
      }

      if (payout) {
        let status = null;

        if (
          eventType.includes(
            "SUCCEEDED"
          )
        ) {
          status =
            "COMPLETED";
        }

        if (
          eventType.includes(
            "FAILED"
          ) ||
          eventType.includes(
            "RETURNED"
          ) ||
          eventType.includes(
            "BLOCKED"
          ) ||
          eventType.includes(
            "CANCELED"
          )
        ) {
          status =
            "FAILED";
        }

        if (
          status
        ) {
          await prisma.payout.update({
            where: {
              id:
                payout.id
            },

            data: {
              status,

              paypalItemId:
                payoutItemId ||
                payout.paypalItemId,

              paypalBatchId:
                payoutBatchId ||
                payout.paypalBatchId
            }
          });
        }
      }

      res.json({
        received: true
      });
    } catch (error) {
      console.error(
        "PayPal webhook processing error:",
        error
      );

      /*
        Return 200 so PayPal does not repeatedly
        resend an event because of a local
        processing error.
      */

      res.json({
        received: true
      });
    }
  }
);

/* --------------------------------
   PAYMENTS
--------------------------------- */

app.get(
  "/api/payments",
  auth,
  async (req, res) => {
    const payments =
      await prisma.payment.findMany({
        where: {
          userId:
            req.user.id
        },

        include: {
          circle: true,
          membership: true
        },

        orderBy: {
          createdAt: "desc"
        }
      });

    res.json(payments);
  }
);

/* --------------------------------
   PAYOUTS
--------------------------------- */

app.get(
  "/api/payouts",
  auth,
  async (req, res) => {
    const payouts =
      await prisma.payout.findMany({
        where: {
          userId:
            req.user.id
        },

        include: {
          circle: true,
          payoutDate: true,
          membership: true
        },

        orderBy: {
          createdAt: "desc"
        }
      });

    res.json(payouts);
  }
);

/* --------------------------------
   ADMIN PAYOUT SUMMARY
--------------------------------- */

app.get(
  "/api/admin/payouts",
  auth,
  adminOnly,
  async (_, res) => {
    const payouts =
      await prisma.payout.findMany({
        include: {
          user: true,
          circle: true,
          payoutDate: true
        },

        orderBy: {
          createdAt: "desc"
        }
      });

    res.json(
      payouts.map(
        (payout) => ({
          id:
            payout.id,

          userId:
            payout.userId,

          userName:
            payout.user?.name,

          paypalEmail:
            payout.paypalEmail,

          circleId:
            payout.circleId,

          circleCode:
            payout.circle?.code,

          payoutAt:
            payout.payoutDate
              ?.payoutAt,

          grossAmountCents:
            payout.grossAmountCents,

          bankerFeeBps:
            payout.bankerFeeBps,

          bankerFeeCents:
            payout.bankerFeeCents,

          paypalFeeCents:
            payout.paypalFeeCents,

          netAmountCents:
            payout.netAmountCents,

          status:
            payout.status,

          paypalBatchId:
            payout.paypalBatchId,

          paypalItemId:
            payout.paypalItemId,

          createdAt:
            payout.createdAt
        })
      )
    );
  }
);

/* --------------------------------
   ADMIN SUMMARY
--------------------------------- */

app.get(
  "/api/admin/summary",
  auth,
  adminOnly,
  async (_, res) => {
    const [
      users,
      circles,
      memberships,
      payments,
      payouts
    ] =
      await Promise.all([
        prisma.user.count(),

        prisma.circle.count(),

        prisma.membership.count(),

        prisma.payment.count(),

        prisma.payout.count()
      ]);

    res.json({
      users,
      circles,
      memberships,
      payments,
      payouts
    });
  }
);

/* --------------------------------
   GLOBAL ERROR HANDLER
--------------------------------- */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Something went wrong on the server"
    });
  }
);

/* --------------------------------
   START SERVER
--------------------------------- */

async function startServer() {
  try {
    await ensureBankerFeeSetting();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `PayaCircle running on port ${PORT}`
        );

        console.log(
          `PayaCircle banker fee default: 7%`
        );

        /*
          Check for due payouts every minute.
        */

        setInterval(
          processDuePayouts,
          60 * 1000
        );

        /*
          Also check shortly after startup.
        */

        setTimeout(
          processDuePayouts,
          5000
        );
      }
    );
  } catch (error) {
    console.error(
      "Unable to start PayaCircle:",
      error
    );

    await prisma.$disconnect();

    process.exit(1);
  }
}

startServer();

/* --------------------------------
   CLEAN SHUTDOWN
--------------------------------- */

async function shutdown() {
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);
