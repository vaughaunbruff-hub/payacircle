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

app.set("trust proxy", true);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: "100kb" }));
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

/* --------------------------------
   AUTH
--------------------------------- */

function tokenFor(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "2h"
    }
  );
}

function auth(req, res, next) {
  try {
    const raw = req.cookies.cp_session;

    if (!raw) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    req.user = jwt.verify(raw, JWT_SECRET);

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid session"
    });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({
      error: "Admin only"
    });
  }

  next();
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/"
  };
}

/* --------------------------------
   PAYPAL
--------------------------------- */

function paypalBase() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalToken() {
  if (
    !process.env.PAYPAL_CLIENT_ID ||
    !process.env.PAYPAL_CLIENT_SECRET
  ) {
    throw new Error("PayPal credentials are not configured");
  }

  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${paypalBase()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  if (!response.ok) {
    throw new Error("PayPal authentication failed");
  }

  const data = await response.json();

  return data.access_token;
}

/* --------------------------------
   HEALTH
--------------------------------- */

app.get("/api/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      app: "PayaCircle",
      mode: process.env.PAYPAL_MODE || "sandbox"
    });
  } catch {
    res.status(503).json({
      ok: false,
      error: "Database unavailable"
    });
  }
});

/* --------------------------------
   CONTRIBUTION RULES
--------------------------------- */

const MIN_CONTRIBUTION_CENTS =
  Number(process.env.MIN_CONTRIBUTION_USD || 5) * 100;

const MAX_CONTRIBUTION_CENTS =
  Number(process.env.MAX_CONTRIBUTION_USD || 100) * 100;

const PLAN_MIN = {
  FAMILY: 10,
  FRIENDS: 15,
  SOCIAL_MEDIA: 50
};

function validContribution(amountCents) {
  return (
    Number.isInteger(amountCents) &&
    amountCents >= MIN_CONTRIBUTION_CENTS &&
    amountCents <= MAX_CONTRIBUTION_CENTS &&
    amountCents % 500 === 0
  );
}

/* --------------------------------
   REGISTER
--------------------------------- */

app.post("/api/register", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2).max(80),
      email: z.string().email(),
      password: z.string().min(10).max(100)
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid registration details"
    });
  }

  const {
    name,
    email,
    password
  } = parsed.data;

  const normalizedEmail =
    email.trim().toLowerCase();

  const exists = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    }
  });

  if (exists) {
    return res.status(409).json({
      error: "Account already exists"
    });
  }

  const passwordHash = await bcrypt.hash(
    password,
    12
  );

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    }
  });

  res.cookie(
    "cp_session",
    tokenFor(user),
    sessionCookieOptions()
  );

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
});

/* --------------------------------
   LOGIN
--------------------------------- */

app.post("/api/login", async (req, res) => {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string()
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid login"
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      email: parsed.data.email
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
      error: "Incorrect email or password"
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
});

/* --------------------------------
   LOGOUT
--------------------------------- */

app.post("/api/logout", (req, res) => {
  res.clearCookie("cp_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  res.json({
    ok: true
  });
});

/* --------------------------------
   CURRENT USER
--------------------------------- */

app.get("/api/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      id: req.user.sub
    },
    include: {
      memberships: {
        orderBy: {
          createdAt: "desc"
        },
        include: {
          circle: true,
          payoutDate: true,
          payments: {
            orderBy: {
              createdAt: "desc"
            }
          },
          payout: true
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({
      error: "Account not found"
    });
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    paypalEmail: user.paypalEmail,
    role: user.role,
    createdAt: user.createdAt,
    memberships: user.memberships
  });
});

/* --------------------------------
   CIRCLES
--------------------------------- */

app.get("/api/circles", async (_, res) => {
  const circles = await prisma.circle.findMany({
    include: {
      _count: {
        select: {
          memberships: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json(circles);
});

/* --------------------------------
   CREATE CIRCLE
--------------------------------- */

app.post(
  "/api/circles",
  auth,
  async (req, res) => {
    const parsed = z
      .object({
        name: z.string().min(2).max(80),
        type: z.enum([
          "FAMILY",
          "FRIENDS",
          "SOCIAL_MEDIA",
          "CUSTOM"
        ]),
        capacity: z
          .number()
          .int()
          .min(2)
          .max(1000),
        amountUsd: z
          .number()
          .multipleOf(5)
          .min(5)
          .max(100)
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid circle plan"
      });
    }

    const {
      name,
      type,
      capacity,
      amountUsd
    } = parsed.data;

    if (
      type !== "CUSTOM" &&
      capacity < PLAN_MIN[type]
    ) {
      return res.status(400).json({
        error: `${type} circles require at least ${PLAN_MIN[type]} members`
      });
    }

    const amountCents =
      Math.round(amountUsd * 100);

    if (!validContribution(amountCents)) {
      return res.status(400).json({
        error:
          "Contribution must be $5–$100 USD in $5 increments"
      });
    }

    const code =
      `${type.slice(0, 4)}-${Date.now()
        .toString(36)
        .toUpperCase()}`;

    const circle =
      await prisma.circle.create({
        data: {
          code,
          name: name.trim(),
          type,
          capacity,
          amountCents,
          houseFeeCents: 10000
        }
      });

    res.status(201).json(circle);
  }
);

/* --------------------------------
   PAYOUT DATES
--------------------------------- */

app.get(
  "/api/circles/:id/dates",
  auth,
  async (req, res) => {
    const dates =
      await prisma.payoutDate.findMany({
        where: {
          circleId: req.params.id
        },
        orderBy: {
          payoutAt: "asc"
        }
      });

    res.json(dates);
  }
);

/* --------------------------------
   MEMBERSHIP
--------------------------------- */

app.post(
  "/api/memberships",
  auth,
  async (req, res) => {
    const parsed = z
      .object({
        circleId: z.string(),
        payoutDateId: z.string()
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid selection"
      });
    }

    const {
      circleId,
      payoutDateId
    } = parsed.data;

    const circle =
      await prisma.circle.findUnique({
        where: {
          id: circleId
        }
      });

    const date =
      await prisma.payoutDate.findUnique({
        where: {
          id: payoutDateId
        }
      });

    if (
      !circle ||
      !date ||
      date.circleId !== circle.id
    ) {
      return res.status(400).json({
        error: "Invalid circle/date"
      });
    }

    if (circle.status !== "COLLECTING") {
      return res.status(409).json({
        error: "Circle is closed"
      });
    }

    if (
      !validContribution(
        circle.amountCents
      )
    ) {
      return res.status(409).json({
        error:
          "Circle contribution is outside the allowed range"
      });
    }

    const existing =
      await prisma.membership.findUnique({
        where: {
          userId_circleId: {
            userId: req.user.sub,
            circleId: circle.id
          }
        }
      });

    if (existing) {
      return res.status(409).json({
        error:
          "You already have a membership in this circle"
      });
    }

    const result =
      await prisma.$transaction(
        async tx => {
          const currentCircle =
            await tx.circle.findUnique({
              where: {
                id: circle.id
              },
              include: {
                _count: {
                  select: {
                    memberships: true
                  }
                }
              }
            });

          const currentDate =
            await tx.payoutDate.findUnique({
              where: {
                id: date.id
              }
            });

          if (!currentCircle) {
            throw new Error(
              "Circle no longer exists"
            );
          }

          if (
            currentCircle._count.memberships >=
            currentCircle.capacity
          ) {
            throw new Error(
              "Circle is full"
            );
          }

          if (
            !currentDate ||
            currentDate.reserved >=
              currentDate.capacity
          ) {
            throw new Error(
              "Payout date is full"
            );
          }

          const membership =
            await tx.membership.create({
              data: {
                userId: req.user.sub,
                circleId: circle.id,
                payoutDateId: date.id,
                status: "PAYMENT_PENDING"
              }
            });

          await tx.payoutDate.update({
            where: {
              id: date.id
            },
            data: {
              reserved: {
                increment: 1
              }
            }
          });

          return membership;
        }
      );

    res.json(result);
  }
);

/* --------------------------------
   PAYPAL CREATE ORDER
--------------------------------- */

app.post(
  "/api/paypal/create-order",
  auth,
  async (req, res) => {
    try {
      const parsed = z
        .object({
          membershipId: z.string()
        })
        .safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid membership"
        });
      }

      const membership =
        await prisma.membership.findUnique({
          where: {
            id: parsed.data.membershipId
          },
          include: {
            circle: true,
            payoutDate: true,
            payments: true
          }
        });

      if (
        !membership ||
        membership.userId !== req.user.sub
      ) {
        return res.status(404).json({
          error: "Membership not found"
        });
      }

      if (
        membership.status !==
        "PAYMENT_PENDING"
      ) {
        return res.status(409).json({
          error:
            "This membership is not awaiting payment"
        });
      }

      const existingPayment =
        membership.payments.find(
          payment =>
            payment.status === "CREATED" &&
            payment.paypalOrderId
        );

      if (existingPayment) {
        const access = await paypalToken();

        const existingOrder =
          await fetch(
            `${paypalBase()}/v2/checkout/orders/${encodeURIComponent(
              existingPayment.paypalOrderId
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${access}`
              }
            }
          );

        if (existingOrder.ok) {
          const orderData =
            await existingOrder.json();

          const approvalLink =
            Array.isArray(orderData.links)
              ? orderData.links.find(
                  link =>
                    link.rel === "approve"
                )
              : null;

          if (approvalLink?.href) {
            return res.json({
              id: orderData.id,
              approvalUrl:
                approvalLink.href
            });
          }
        }
      }

      const access =
        await paypalToken();

      const expectedAmount =
        (
          membership.circle.amountCents /
          100
        ).toFixed(2);

      const orderResponse =
        await fetch(
          `${paypalBase()}/v2/checkout/orders`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${access}`,
              "Content-Type":
                "application/json",
              "PayPal-Request-Id":
                `payacircle-${membership.id}-${Date.now()}`
            },
            body: JSON.stringify({
              intent: "CAPTURE",

              purchase_units: [
                {
                  reference_id:
                    membership.id,

                  custom_id:
                    membership.id,

                  amount: {
                    currency_code: "USD",
                    value: expectedAmount
                  },

                  description:
                    `PayaCircle savings contribution — ${membership.circle.code}`
                }
              ],

              application_context: {
                brand_name:
                  "PayaCircle",

                user_action:
                  "PAY_NOW",

                shipping_preference:
                  "NO_SHIPPING",

                return_url:
                  `${process.env.APP_URL || "http://localhost:3000"}/?paypal=success`,

                cancel_url:
                  `${process.env.APP_URL || "http://localhost:3000"}/?paypal=cancel`
              }
            })
          }
        );

      const data =
        await orderResponse.json();

      if (!orderResponse.ok) {
        console.error(
          "PayPal order creation failed:",
          data
        );

        return res.status(502).json({
          error:
            "PayPal order creation failed"
        });
      }

      const approvalLink =
        Array.isArray(data.links)
          ? data.links.find(
              link =>
                link.rel === "approve"
            )
          : null;

      if (!approvalLink?.href) {
        return res.status(502).json({
          error:
            "PayPal approval link unavailable"
        });
      }

      await prisma.payment.create({
        data: {
          userId: req.user.sub,
          circleId: membership.circleId,
          membershipId: membership.id,
          paypalOrderId: data.id,
          amountCents:
            membership.circle.amountCents,
          status: "CREATED"
        }
      });

      res.json({
        id: data.id,
        approvalUrl:
          approvalLink.href
      });

    } catch (error) {
      console.error(
        "PayPal create-order error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to create PayPal payment"
      });
    }
  }
);

/* --------------------------------
   PAYPAL CAPTURE
--------------------------------- */

app.post(
  "/api/paypal/capture-order",
  auth,
  async (req, res) => {
    try {
      const parsed = z
        .object({
          orderId: z.string()
        })
        .safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid order"
        });
      }

      const payment =
        await prisma.payment.findUnique({
          where: {
            paypalOrderId:
              parsed.data.orderId
          },
          include: {
            membership: {
              include: {
                circle: true,
                payoutDate: true
              }
            }
          }
        });

      if (
        !payment ||
        payment.userId !== req.user.sub
      ) {
        return res.status(404).json({
          error: "Payment not found"
        });
      }

      if (
        payment.status === "CAPTURED"
      ) {
        return res.json({
          status: "COMPLETED"
        });
      }

      const access =
        await paypalToken();

      const response =
        await fetch(
          `${paypalBase()}/v2/checkout/orders/${encodeURIComponent(
            parsed.data.orderId
          )}/capture`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${access}`,
              "Content-Type":
                "application/json"
            }
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "PayPal capture failed:",
          data
        );

        return res.status(502).json({
          error:
            "PayPal capture failed"
        });
      }

      const purchaseUnit =
        data?.purchase_units?.[0];

      const capture =
        purchaseUnit?.payments
          ?.captures?.[0];

      if (
        !capture ||
        capture.status !==
          "COMPLETED"
      ) {
        return res.json({
          status:
            capture?.status ||
            data.status ||
            "UNKNOWN"
        });
      }

      const capturedCurrency =
        capture?.amount?.currency_code;

      const capturedValue =
        Number(
          capture?.amount?.value || 0
        );

      const expectedValue =
        Number(
          payment.amountCents / 100
        );

      if (
        capturedCurrency !== "USD" ||
        Math.abs(
          capturedValue -
            expectedValue
        ) > 0.001
      ) {
        await prisma.payment.update({
          where: {
            id: payment.id
          },
          data: {
            status: "FAILED"
          }
        });

        console.error(
          "PayPal amount mismatch",
          {
            expectedCurrency: "USD",
            capturedCurrency,
            expectedValue,
            capturedValue
          }
        );

        return res.status(400).json({
          error:
            "Payment amount could not be verified"
        });
      }

      const fee =
        Number(
          capture
            ?.seller_receivable_breakdown
            ?.paypal_fee
            ?.value || 0
        );

      await prisma.$transaction([
        prisma.payment.update({
          where: {
            id: payment.id
          },
          data: {
            status: "CAPTURED",
            paypalCaptureId:
              capture.id,
            paypalFeeCents:
              Math.round(fee * 100)
          }
        }),

        prisma.membership.update({
          where: {
            id: payment.membershipId
          },
          data: {
            status: "PAID"
          }
        })
      ]);

      res.json({
        status: "COMPLETED"
      });

    } catch (error) {
      console.error(
        "PayPal capture-order error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to complete PayPal payment"
      });
    }
  }
);

/* --------------------------------
   PAYPAL WEBHOOK
--------------------------------- */

/*
  PayPal webhook verification is intentionally
  not trusted here until the webhook signature
  is verified using PayPal's verification API.

  This endpoint currently acknowledges the
  request but does NOT use an unverified webhook
  to mark payments as paid.
*/

app.post(
  "/api/paypal/webhook",
  async (req, res) => {
    console.warn(
      "PayPal webhook received. Signature verification is required before using webhook events."
    );

    res.sendStatus(200);
  }
);

/* --------------------------------
   ADMIN SUMMARY
--------------------------------- */

app.get(
  "/api/admin/summary",
  auth,
  admin,
  async (_, res) => {
    const [
      users,
      circles,
      paid,
      payouts
    ] = await Promise.all([
      prisma.user.count(),

      prisma.circle.count(),

      prisma.payment.count({
        where: {
          status: "CAPTURED"
        }
      }),

      prisma.payout.count()
    ]);

    res.json({
      users,
      circles,
      paidPayments: paid,
      payouts
    });
  }
);

/* --------------------------------
   ERROR HANDLER
--------------------------------- */

app.use(
  (err, req, res, next) => {
    console.error(err);

    res.status(500).json({
      error:
        "Internal server error"
    });
  }
);

/* --------------------------------
   START SERVER
--------------------------------- */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `PayaCircle listening on port ${PORT}`
    );
  }
);
