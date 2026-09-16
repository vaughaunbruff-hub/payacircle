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

const APP_URL =
  process.env.APP_URL ||
  `http://localhost:${PORT}`;

const PAYPAL_MODE =
  process.env.PAYPAL_MODE || "sandbox";

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

/* --------------------------------
   SESSION
--------------------------------- */

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
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
    const token = req.cookies.cp_session;

    if (!token) {
      return res.status(401).json({
        error: "Not signed in"
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

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
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal is not configured");
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${paypalBaseUrl()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Unable to connect to PayPal"
    );
  }

  return data.access_token;
}

async function paypalRequest(path, options = {}) {
  const accessToken = await paypalAccessToken();

  const response = await fetch(
    `${paypalBaseUrl()}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.message ||
      data?.details?.[0]?.description ||
      "PayPal request failed";

    const error = new Error(message);
    error.status = response.status;
    error.paypal = data;

    throw error;
  }

  return data;
}

/* --------------------------------
   HEALTH
--------------------------------- */

app.get("/api/health", async (_, res) => {
  res.json({
    ok: true,
    app: "PayaCircle",
    mode: PAYPAL_MODE
  });
});

/* --------------------------------
   REGISTER
--------------------------------- */

app.post("/api/register", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(8).max(100)
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error:
        "Please provide a valid name, email and password of at least 8 characters"
    });
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existing) {
    return res.status(409).json({
      error: "An account with that email already exists"
    });
  }

  const passwordHash = await bcrypt.hash(
    parsed.data.password,
    12
  );

  const user = await prisma.user.create({
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
      email: parsed.data.email.trim().toLowerCase()
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
});

/* --------------------------------
   PUBLIC CIRCLES
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
   SINGLE CIRCLE
--------------------------------- */

app.get("/api/circles/:id", async (req, res) => {
  const circle = await prisma.circle.findUnique({
    where: {
      id: req.params.id
    },
    include: {
      _count: {
        select: {
          memberships: true
        }
      }
    }
  });

  if (!circle) {
    return res.status(404).json({
      error: "Circle not found"
    });
  }

  res.json(circle);
});

/* --------------------------------
   CIRCLE PAYOUT DATES
--------------------------------- */

app.get(
  "/api/circles/:id/dates",
  auth,
  async (req, res) => {
    const dates = await prisma.payoutDate.findMany({
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
   CANCEL MEMBERSHIP
--------------------------------- */

app.post(
  "/api/memberships/:id/cancel",
  auth,
  async (req, res) => {
    const membershipId = req.params.id;

    try {
      const result =
        await prisma.$transaction(
          async (tx) => {
            const membership =
              await tx.membership.findUnique({
                where: {
                  id: membershipId
                },
                include: {
                  circle: true,
                  payoutDate: true
                }
              });

            if (!membership) {
              throw new Error(
                "Membership not found"
              );
            }

            if (
              membership.userId !==
              req.user.id
            ) {
              const error = new Error(
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
              throw new Error(
                "This membership has already been cancelled"
              );
            }

            /*
              A member can only cancel while
              the circle is still collecting
              members.

              Once the circle has moved beyond
              COLLECTING, cancellation is blocked.
            */

            if (
              membership.circle.status !==
              "COLLECTING"
            ) {
              throw new Error(
                "This circle has already started and can no longer be cancelled"
              );
            }

            /*
              Paid memberships are not
              automatically refunded here.
              The payment/refund process must
              be handled separately.
            */

            const hasCapturedPayment =
              await tx.payment.findFirst({
                where: {
                  membershipId:
                    membership.id,
                  status: "CAPTURED"
                }
              });

            if (hasCapturedPayment) {
              const error = new Error(
                "This membership has already been paid. Please contact PayaCircle support to request a refund."
              );

              error.status = 409;
              throw error;
            }

            const updated =
              await tx.membership.update({
                where: {
                  id: membership.id
                },
                data: {
                  status: "CANCELLED"
                },
                include: {
                  circle: true,
                  payoutDate: true
                }
              });

            /*
              Release the payout-date reservation.
            */

            await tx.payoutDate.update({
              where: {
                id: membership.payoutDateId
              },
              data: {
                reserved: {
                  decrement: 1
                }
              }
            });

            return updated;
          }
        );

      res.json({
        ok: true,
        message:
          "Your circle membership has been cancelled.",
        membership: result
      });
    } catch (error) {
      const status =
        error?.status ||
        (error?.message?.includes(
          "not found"
        )
          ? 404
          : error?.message?.includes(
              "cannot be cancelled"
            )
          ? 409
          : error?.message?.includes(
              "already been cancelled"
            )
          ? 409
          : 400);

      res.status(status).json({
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
    const parsed = z
      .object({
        name: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .optional()
          .or(z.literal("")),

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
          .int()
          .min(5)
          .max(100)
          .multipleOf(5)
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid circle information"
      });
    }

    const {
      name,
      type,
      capacity,
      amountUsd
    } = parsed.data;

    if (!validContribution(amountUsd)) {
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

    const code =
      `${type.slice(0, 4)}-` +
      Date.now()
        .toString(36)
        .toUpperCase();

    const circle = await prisma.circle.create({
      data: {
        code,
        name: name || null,
        type,
        amountCents: amountUsd * 100,
        capacity,
        houseFeeCents: 10000
      }
    });

    res.status(201).json(circle);
  }
);

/* --------------------------------
   JOIN / RESERVE MEMBERSHIP
--------------------------------- */

app.post(
  "/api/memberships",
  auth,
  async (req, res) => {
    const parsed = z
      .object({
        circleId: z.string().min(1),
        payoutDateId: z.string().min(1)
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid membership request"
      });
    }

    const {
      circleId,
      payoutDateId
    } = parsed.data;

    try {
      const membership =
        await prisma.$transaction(
          async (tx) => {
            const circle =
              await tx.circle.findUnique({
                where: {
                  id: circleId
                },
                include: {
                  _count: {
                    select: {
                      memberships: true
                    }
                  }
                }
              });

            if (!circle) {
              throw new Error(
                "Circle not found"
              );
            }

            if (
              circle.status !==
              "COLLECTING"
            ) {
              throw new Error(
                "This circle is not accepting new members"
              );
            }

            if (
              circle._count.memberships >=
              circle.capacity
            ) {
              throw new Error(
                "Circle is full"
              );
            }

            const payoutDate =
              await tx.payoutDate.findUnique({
                where: {
                  id: payoutDateId
                }
              });

            if (!payoutDate) {
              throw new Error(
                "Payout date not found"
              );
            }

            if (
              payoutDate.circleId !==
              circleId
            ) {
              throw new Error(
                "Invalid payout date"
              );
            }

            if (
              payoutDate.reserved >=
              payoutDate.capacity
            ) {
              throw new Error(
                "Payout date is full"
              );
            }

            const existing =
              await tx.membership.findUnique({
                where: {
                  userId_circleId: {
                    userId: req.user.id,
                    circleId
                  }
                }
              });

            if (existing) {
              if (
                existing.status ===
                "CANCELLED"
              ) {
                await tx.payoutDate.update({
                  where: {
                    id: existing.payoutDateId
                  },
                  data: {
                    reserved: {
                      increment: 1
                    }
                  }
                });

                return tx.membership.update({
                  where: {
                    id: existing.id
                  },
                  data: {
                    payoutDateId,
                    status:
                      "PAYMENT_PENDING"
                  },
                  include: {
                    circle: true,
                    payoutDate: true
                  }
                });
              }

              return existing;
            }

            await tx.payoutDate.update({
              where: {
                id: payoutDateId
              },
              data: {
                reserved: {
                  increment: 1
                }
              }
            });

            return tx.membership.create({
              data: {
                userId: req.user.id,
                circleId,
                payoutDateId,
                status: "PAYMENT_PENDING"
              },
              include: {
                circle: true,
                payoutDate: true
              }
            });
          }
        );

      res.status(201).json(membership);
    } catch (error) {
      const message =
        error?.message ||
        "Unable to reserve membership";

      const status =
        message.includes("full")
          ? 409
          : message.includes("not found")
          ? 404
          : 400;

      res.status(status).json({
        error: message
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
    const parsed = z
      .object({
        circleId: z.string().min(1),
        membershipId: z
          .string()
          .min(1)
          .optional()
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid PayPal request"
      });
    }

    try {
      const circle =
        await prisma.circle.findUnique({
          where: {
            id: parsed.data.circleId
          }
        });

      if (!circle) {
        return res.status(404).json({
          error: "Circle not found"
        });
      }

      const amount =
        (
          circle.amountCents / 100
        ).toFixed(2);

      const existing =
        await prisma.payment.findFirst({
          where: {
            userId: req.user.id,
            circleId: circle.id,
            status: "CREATED",
            paypalOrderId: {
              not: null
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        });

      if (existing?.paypalOrderId) {
        return res.json({
          orderId:
            existing.paypalOrderId
        });
      }

      const order =
        await paypalRequest(
          "/v2/checkout/orders",
          {
            method: "POST",
            headers: {
              Prefer:
                "return=representation"
            },
            body: JSON.stringify({
              intent: "CAPTURE",
              purchase_units: [
                {
                  reference_id:
                    circle.id,
                  description:
                    `PayaCircle contribution - ${circle.code}`,
                  amount: {
                    currency_code: "USD",
                    value: amount
                  }
                }
              ],
              application_context: {
                brand_name: "PayaCircle",
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
            userId: req.user.id,
            circleId: circle.id,
            membershipId:
              parsed.data.membershipId ||
              null,
            paypalOrderId:
              order.id,
            amountCents:
              circle.amountCents,
            status: "CREATED"
          }
        });

      res.json({
        orderId: order.id,
        paymentId: payment.id,
        approvalUrl:
          order.links?.find(
            (link) =>
              link.rel === "approve"
          )?.href || null
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
    const parsed = z
      .object({
        orderId: z.string().min(1)
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid PayPal order"
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
          error: "Payment not found"
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
          status: "CAPTURED",
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

      if (
        order.status ===
        "COMPLETED"
      ) {
        return res.json({
          ok: true,
          status: "CAPTURED",
          payment
        });
      }

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

      const captureData =
        capture.purchase_units?.[0]
          ?.payments?.captures?.[0];

      const capturedAmount =
        captureData?.amount?.value;

      const capturedCurrency =
        captureData?.amount
          ?.currency_code;

      const expectedAmount =
        (
          payment.amountCents / 100
        ).toFixed(2);

      if (
        capturedCurrency !==
          "USD" ||
        capturedAmount !==
          expectedAmount
      ) {
        await prisma.payment.update({
          where: {
            id: payment.id
          },
          data: {
            status: "FAILED"
          }
        });

        return res.status(400).json({
          error:
            "PayPal payment amount could not be verified"
        });
      }

      const updatedPayment =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.payment.update({
                where: {
                  id: payment.id
                },
                data: {
                  status: "CAPTURED",
                  paypalCaptureId:
                    captureData?.id ||
                    null,
                  paypalFeeCents:
                    captureData
                      ?.seller_receivable_breakdown
                      ?.paypal_fee
                      ?.value
                      ? Math.round(
                          Number(
                            captureData
                              .seller_receivable_breakdown
                              .paypal_fee.value
                          ) * 100
                        )
                      : null
                }
              });

            if (
              payment.membershipId
            ) {
              await tx.membership.update({
                where: {
                  id: payment.membershipId
                },
                data: {
                  status: "PAID"
                }
              });
            }

            return updated;
          }
        );

      res.json({
        ok: true,
        status: "CAPTURED",
        payment:
          updatedPayment
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
            userId: req.user.id,
            status: {
              in: [
                "CREATED",
                "APPROVED"
              ]
            }
          },
          data: {
            status: "FAILED"
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
    console.log(
      "PayPal webhook received:",
      req.body?.event_type || "unknown"
    );

    res.json({
      received: true
    });
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
          userId: req.user.id
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
          userId: req.user.id
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
    ] = await Promise.all([
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `PayaCircle running on port ${PORT}`
  );
});

/* --------------------------------
   CLEAN SHUTDOWN
--------------------------------- */

process.on(
  "SIGINT",
  async () => {
    await prisma.$disconnect();
    process.exit(0);
  }
);

process.on(
  "SIGTERM",
  async () => {
    await prisma.$disconnect();
    process.exit(0);
  }
);
