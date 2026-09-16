async function api(url, opts = {}) {
  const r = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    },
    credentials: "same-origin",
    ...opts
  });

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(d.error || "Request failed");
  }

  return d;
}

const money = n => `$${Number(n / 100).toFixed(0)}`;

const labels = {
  FAMILY: "Family",
  FRIENDS: "Friends",
  SOCIAL_MEDIA: "Social Media",
  CUSTOM: "Custom"
};

function get(id) {
  return document.getElementById(id);
}

function showModal(html) {
  const modalContent = get("modalContent");
  const modal = get("modal");

  if (!modalContent || !modal) return;

  modalContent.innerHTML = html;
  modal.classList.add("show");
}

function hideModal() {
  const modal = get("modal");
  if (modal) modal.classList.remove("show");
}


/* =========================
   AUTH FORMS
========================= */

function showLogin() {
  showModal(`
    <label>MEMBER LOGIN</label>

    <h2>Welcome back</h2>

    <input
      id="loginEmail"
      type="email"
      placeholder="Email"
      autocomplete="email"
    >

    <input
      id="loginPassword"
      type="password"
      placeholder="Password"
      autocomplete="current-password"
    >

    <button id="loginSubmit" class="primary">
      Sign in
    </button>

    <p>
      New member?
      <a href="#" id="switchToRegister">
        Create an account
      </a>
    </p>
  `);

  get("loginSubmit").addEventListener("click", login);

  get("switchToRegister").addEventListener("click", event => {
    event.preventDefault();
    showRegister();
  });
}


function showRegister() {
  showModal(`
    <label>CREATE ACCOUNT</label>

    <h2>Join PayaCircle</h2>

    <input
      id="registerName"
      type="text"
      placeholder="Full name"
      autocomplete="name"
    >

    <input
      id="registerEmail"
      type="email"
      placeholder="Email"
      autocomplete="email"
    >

    <input
      id="registerPassword"
      type="password"
      placeholder="Password (10+ characters)"
      autocomplete="new-password"
    >

    <button id="registerSubmit" class="primary">
      Create account
    </button>

    <p>
      Already a member?
      <a href="#" id="switchToLogin">
        Sign in
      </a>
    </p>

    <small>
      After creating your account, you can join or create
      an eligible savings circle.
    </small>
  `);

  get("registerSubmit").addEventListener("click", register);

  get("switchToLogin").addEventListener("click", event => {
    event.preventDefault();
    showLogin();
  });
}


/* =========================
   LOGIN / REGISTER
========================= */

async function login() {
  try {
    const email = get("loginEmail").value.trim();
    const password = get("loginPassword").value;

    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    hideModal();

    await showDashboard();

  } catch (e) {
    alert(e.message);
  }
}


async function register() {
  try {
    const name = get("registerName").value.trim();
    const email = get("registerEmail").value.trim();
    const password = get("registerPassword").value;

    await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    hideModal();

    await showDashboard();

  } catch (e) {
    alert(e.message);
  }
}


async function logout() {
  try {
    await api("/api/logout", {
      method: "POST"
    });
  } catch (e) {
    console.error(e);
  }

  hideDashboard();
}


/* =========================
   DASHBOARD
========================= */

function showDashboardView() {
  const dashboard = get("dashboard");

  if (!dashboard) return;

  dashboard.style.display = "block";

  dashboard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  document.body.classList.add("member-mode");
}


function hideDashboard() {
  const dashboard = get("dashboard");

  if (dashboard) {
    dashboard.style.display = "none";
  }

  document.body.classList.remove("member-mode");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


async function showDashboard() {
  try {
    const user = await api("/api/me");

    if (!user || !user.id) {
      hideDashboard();
      return;
    }

    renderDashboard(user);

    showDashboardView();

    await loadDashboardCircles(user);

  } catch (e) {
    console.error("Unable to load member account:", e);
    hideDashboard();
    alert("Please sign in again.");
  }
}


/* =========================
   DASHBOARD DATA
========================= */

function renderDashboard(user) {
  const name = get("dashboardName");
  const email = get("dashboardEmail");
  const circleCount = get("dashboardCircleCount");
  const contributions = get("dashboardContributions");
  const nextPayout = get("dashboardNextPayout");

  if (name) {
    name.textContent = user.name || "Member";
  }

  if (email) {
    email.textContent = user.email || "—";
  }

  const memberships = Array.isArray(user.memberships)
    ? user.memberships
    : [];

  if (circleCount) {
    circleCount.textContent = memberships.length;
  }

  let total = 0;

  memberships.forEach(membership => {
    if (Array.isArray(membership.payments)) {
      membership.payments.forEach(payment => {
        if (payment.status === "CAPTURED") {
          total += Number(payment.amountCents || 0);
        }
      });
    }
  });

  if (contributions) {
    contributions.textContent = money(total);
  }

  let upcoming = null;

  memberships.forEach(membership => {
    if (!membership.payoutDate?.payoutAt) return;

    const date = new Date(
      membership.payoutDate.payoutAt
    );

    if (date < new Date()) return;

    if (!upcoming || date < upcoming) {
      upcoming = date;
    }
  });

  if (nextPayout) {
    nextPayout.textContent = upcoming
      ? upcoming.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "—";
  }

  renderMemberships(memberships);
}


function renderMemberships(memberships) {
  const container = get("myMemberships");

  if (!container) return;

  if (!memberships.length) {
    container.innerHTML = `
      <div class="card">
        <h3>No circles yet</h3>

        <p>
          Choose a savings circle below to get started.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = memberships.map(membership => {

    const circle = membership.circle || {};

    const payoutDate =
      membership.payoutDate?.payoutAt
        ? new Date(membership.payoutDate.payoutAt)
        : null;

    const paymentCaptured =
      Array.isArray(membership.payments) &&
      membership.payments.some(
        payment => payment.status === "CAPTURED"
      );

    let status = membership.status || "UNKNOWN";

    if (paymentCaptured) {
      status = "PAID";
    }

    return `
      <article class="card membership-card">

        <label>
          ${labels[circle.type] || circle.type || "Circle"}
        </label>

        <h3>
          ${circle.name || circle.code || "Savings Circle"}
        </h3>

        <p>
          Contribution:
          <strong>
            ${money(circle.amountCents || 0)}
          </strong>
        </p>

        <p>
          Payout date:
          <strong>
            ${
              payoutDate
                ? payoutDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                : "Not selected"
            }
          </strong>
        </p>

        <p>
          Status:
          <strong>
            ${status.replaceAll("_", " ")}
          </strong>
        </p>

        ${
          status === "PAYMENT_PENDING"
            ? `
              <button
                class="primary pay-membership"
                data-membership-id="${membership.id}"
              >
                Complete payment
              </button>
            `
            : ""
        }

      </article>
    `;
  }).join("");

  document.querySelectorAll(".pay-membership").forEach(button => {
    button.addEventListener("click", () => {
      openPayment(button.dataset.membershipId);
    });
  });
}


/* =========================
   AVAILABLE CIRCLES
========================= */

async function loadDashboardCircles() {
  try {
    const circles = await api("/api/circles");

    const container = get("dashboardCircles");

    if (!container) return;

    if (!circles.length) {
      container.innerHTML = `
        <div class="card">
          <h3>No circles available</h3>

          <p>
            You can create your own savings circle.
          </p>

          <button id="emptyCreateCircle" class="primary">
            Create a circle
          </button>
        </div>
      `;

      get("emptyCreateCircle").addEventListener(
        "click",
        showCreate
      );

      return;
    }

    container.innerHTML = circles.map(circle => {

      const reserved = Number(
        circle._count?.memberships || 0
      );

      const capacity = Number(circle.capacity || 0);

      const available = capacity - reserved;

      return `
        <article class="card circle-plan">

          <label>
            ${labels[circle.type] || circle.type}
          </label>

          <h3>
            ${circle.name || "PayaCircle Plan"}
          </h3>

          <div class="plan-price">
            ${money(circle.amountCents)}
          </div>

          <p>
            Contribution amount
          </p>

          <p>
            ${reserved}/${capacity} members reserved
          </p>

          <p>
            ${
              available > 0
                ? `${available} position${available === 1 ? "" : "s"} available`
                : "Circle is full"
            }
          </p>

          <button
            class="primary choose-circle"
            data-circle-id="${circle.id}"
            ${available <= 0 ? "disabled" : ""}
          >
            ${available > 0 ? "Choose this plan" : "Circle full"}
          </button>

        </article>
      `;

    }).join("");

    document.querySelectorAll(".choose-circle").forEach(button => {
      button.addEventListener("click", () => {
        chooseCircle(button.dataset.circleId);
      });
    });

  } catch (e) {
    console.error(
      "Unable to load dashboard circles:",
      e
    );
  }
}


/* =========================
   CREATE CIRCLE
========================= */

function showCreate() {
  showModal(`
    <label>CREATE A CIRCLE</label>

    <h2>Your group, your plan</h2>

    <input
      id="cname"
      type="text"
      placeholder="Circle name"
    >

    <select id="ctype">
      <option value="FAMILY">
        Family — 10+ members
      </option>

      <option value="FRIENDS">
        Friends — 15+ members
      </option>

      <option value="SOCIAL_MEDIA">
        Social Media — 50+ members
      </option>

      <option value="CUSTOM">
        Custom — choose your size
      </option>
    </select>

    <input
      id="capacity"
      type="number"
      min="2"
      max="1000"
      value="10"
      placeholder="Number of members"
    >

    <select id="amount">
      <option value="5">$5</option>
      <option value="10">$10</option>
      <option value="15">$15</option>
      <option value="20">$20</option>
      <option value="25">$25</option>
      <option value="30">$30</option>
      <option value="35">$35</option>
      <option value="40">$40</option>
      <option value="45">$45</option>
      <option value="50">$50</option>
      <option value="55">$55</option>
      <option value="60">$60</option>
      <option value="65">$65</option>
      <option value="70">$70</option>
      <option value="75">$75</option>
      <option value="80">$80</option>
      <option value="85">$85</option>
      <option value="90">$90</option>
      <option value="95">$95</option>
      <option value="100">$100</option>
    </select>

    <button
      id="createCircleSubmit"
      class="primary"
    >
      Create circle
    </button>

    <small>
      Contributions are $5–$100 USD in $5 increments.
    </small>
  `);

  get("createCircleSubmit").addEventListener(
    "click",
    createCircle
  );
}


async function createCircle() {
  try {
    const name = get("cname").value.trim();
    const type = get("ctype").value;
    const capacity = Number(get("capacity").value);
    const amountUsd = Number(get("amount").value);

    const circle = await api("/api/circles", {
      method: "POST",
      body: JSON.stringify({
        name,
        type,
        capacity,
        amountUsd
      })
    });

    hideModal();

    alert(`Circle ${circle.name} created.`);

    await showDashboard();

  } catch (e) {
    alert(e.message);
  }
}


/* =========================
   CHOOSE CIRCLE
========================= */

async function chooseCircle(circleId) {
  try {
    const dates = await api(
      `/api/circles/${encodeURIComponent(circleId)}/dates`
    );

    if (!dates.length) {
      showModal(`
        <label>PAYOUT SCHEDULE</label>

        <h2>No payout dates yet</h2>

        <p>
          This circle does not have payout dates configured yet.
        </p>
      `);

      return;
    }

    const availableDates = dates.filter(
      date =>
        Number(date.reserved) <
        Number(date.capacity)
    );

    if (!availableDates.length) {
      showModal(`
        <label>PAYOUT SCHEDULE</label>

        <h2>No dates available</h2>

        <p>
          All payout dates for this circle are currently reserved.
        </p>
      `);

      return;
    }

    showModal(`
      <label>CHOOSE YOUR PAYOUT DATE</label>

      <h2>Reserve your payout position</h2>

      <p>
        Select an available scheduled payout date.
      </p>

      <div id="payoutDates">

        ${availableDates.slice(0, 50).map(date => `

          <button
            class="primary payout-date"
            data-circle-id="${circleId}"
            data-date-id="${date.id}"
            style="width:100%;margin:5px 0;padding:12px"
          >

            ${new Date(date.payoutAt).toLocaleDateString(
              undefined,
              {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric"
              }
            )}

            · ${date.reserved}/${date.capacity}

          </button>

        `).join("")}

      </div>
    `);

    document.querySelectorAll(".payout-date").forEach(button => {
      button.addEventListener("click", () => {
        reserveMembership(
          button.dataset.circleId,
          button.dataset.dateId
        );
      });
    });

  } catch (e) {
    alert(e.message);
  }
}


/* =========================
   RESERVE MEMBERSHIP
========================= */

async function reserveMembership(
  circleId,
  payoutDateId
) {
  try {
    const membership = await api(
      "/api/memberships",
      {
        method: "POST",
        body: JSON.stringify({
          circleId,
          payoutDateId
        })
      }
    );

    hideModal();

    await showDashboard();

    openPayment(membership.id);

  } catch (e) {
    alert(e.message);
  }
}


/* =========================
   PAYMENT
========================= */

let currentMembershipId = null;


async function openPayment(membershipId) {
  try {
    const user = await api("/api/me");

    const membership = user.memberships?.find(
      item => item.id === membershipId
    );

    if (!membership) {
      throw new Error("Membership not found.");
    }

    const paymentPanel = get("paymentPanel");
    const paymentDetails = get("paymentDetails");

    if (!paymentPanel || !paymentDetails) return;

    currentMembershipId = membershipId;

    const circle = membership.circle || {};

    const payoutDate =
      membership.payoutDate?.payoutAt
        ? new Date(membership.payoutDate.payoutAt)
        : null;

    paymentDetails.innerHTML = `
      <div class="payment-summary">

        <div>
          <span>Circle</span>

          <strong>
            ${circle.name || circle.code || "Savings Circle"}
          </strong>
        </div>

        <div>
          <span>Contribution</span>

          <strong>
            ${money(circle.amountCents || 0)}
          </strong>
        </div>

        <div>
          <span>Payout date</span>

          <strong>
            ${
              payoutDate
                ? payoutDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                : "Not selected"
            }
          </strong>
        </div>

      </div>
    `;

    paymentPanel.style.display = "block";

    paymentPanel.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } catch (e) {
    alert(e.message);
  }
}


async function startPayPalPayment() {
  if (!currentMembershipId) {
    alert("Please select a membership first.");
    return;
  }

  const button = get("paypalButton");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Connecting to PayPal...";
    }

    const result = await api(
      "/api/paypal/create-order",
      {
        method: "POST",
        body: JSON.stringify({
          membershipId: currentMembershipId
        })
      }
    );

    if (result.approvalUrl) {
      window.location.href = result.approvalUrl;
      return;
    }

    throw new Error(
      "PayPal did not return an approval link."
    );

  } catch (e) {

    alert(e.message);

    if (button) {
      button.disabled = false;
      button.textContent = "Pay with PayPal";
    }
  }
}


/* =========================
   PAYPAL RETURN
========================= */

async function handlePayPalReturn() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const paypalStatus =
    params.get("paypal");

  const orderId =
    params.get("token");

  if (paypalStatus === "cancel") {

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    showModal(`
      <label>PAYMENT CANCELLED</label>

      <h2>Payment was cancelled</h2>

      <p>
        Your membership is still reserved and
        remains payment-pending.
      </p>

      <button
        class="primary"
        onclick="hideModal()"
      >
        Return to dashboard
      </button>
    `);

    return;
  }

  if (
    paypalStatus !== "success" ||
    !orderId
  ) {
    return;
  }

  try {

    showModal(`
      <label>PAYPAL PAYMENT</label>

      <h2>Confirming your payment...</h2>

      <p>
        Please wait while PayaCircle confirms
        your PayPal transaction.
      </p>
    `);

    const result = await api(
      "/api/paypal/capture-order",
      {
        method: "POST",

        body: JSON.stringify({
          orderId
        })
      }
    );

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    if (
      result.status === "COMPLETED"
    ) {

      hideModal();

      const success = get(
        "paymentSuccess"
      );

      if (success) {
        success.style.display = "flex";

        success.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }

      await showDashboard();

      const refreshedSuccess =
        get("paymentSuccess");

      if (refreshedSuccess) {
        refreshedSuccess.style.display = "flex";
      }

    } else {

      showModal(`
        <label>PAYMENT STATUS</label>

        <h2>Payment was not completed</h2>

        <p>
          PayPal returned the status:
          <strong>${result.status || "UNKNOWN"}</strong>
        </p>

        <button
          class="primary"
          onclick="hideModal()"
        >
          Return to dashboard
        </button>
      `);

    }

  } catch (e) {

    console.error(
      "PayPal capture error:",
      e
    );

    showModal(`
      <label>PAYMENT ERROR</label>

      <h2>We could not confirm the payment</h2>

      <p>
        Please check your PayPal account before
        attempting another payment.
      </p>

      <p>
        Error:
        ${e.message}
      </p>

      <button
        class="primary"
        onclick="hideModal()"
      >
        Return to dashboard
      </button>
    `);
  }
}


/* =========================
   NAVIGATION
========================= */

function setupNavigation() {

  const registerButtons =
    document.querySelectorAll(
      ".nav-cta, .app-promo .cta, .final-cta .cta"
    );

  registerButtons.forEach(button => {

    button.addEventListener(
      "click",
      event => {

        event.preventDefault();

        showRegister();

      }
    );

  });


  const loginButton =
    document.querySelector(
      ".nav-login"
    );

  if (loginButton) {

    loginButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        showLogin();

      }
    );

  }


  const howButton =
    document.querySelector(
      ".hero .ghost"
    );

  if (howButton) {

    howButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        const section =
          document.querySelector(
            "#how"
          );

        if (section) {

          section.scrollIntoView({
            behavior: "smooth"
          });

        }

      }
    );

  }


  const closeButton =
    document.querySelector(
      ".modal .x"
    );

  if (closeButton) {

    closeButton.addEventListener(
      "click",
      hideModal
    );

  }


  const modal = get("modal");

  if (modal) {

    modal.addEventListener(
      "click",
      event => {

        if (event.target === modal) {
          hideModal();
        }

      }
    );

  }


  const logoutButton =
    get("dashboardLogout");

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      logout
    );

  }


  const createButton =
    get("dashboardCreateCircle");

  if (createButton) {

    createButton.addEventListener(
      "click",
      showCreate
    );

  }


  const paymentButton =
    get("paypalButton");

  if (paymentButton) {

    paymentButton.addEventListener(
      "click",
      startPayPalPayment
    );

  }


  const cancelPayment =
    get("cancelPayment");

  if (cancelPayment) {

    cancelPayment.addEventListener(
      "click",
      () => {

        currentMembershipId = null;

        const panel =
          get("paymentPanel");

        if (panel) {
          panel.style.display = "none";
        }

      }
    );

  }

}


/* =========================
   INITIAL LOAD
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    setupNavigation();

    await load();

    await handlePayPalReturn();

    try {

      const user =
        await api("/api/me");

      if (user?.id) {

        renderDashboard(user);

        showDashboardView();

        await loadDashboardCircles(
          user
        );

      }

    } catch {
      /*
        Visitor is not signed in.
        Keep the public homepage visible.
      */
    }

  }
);


/* =========================
   PUBLIC CIRCLE LIST
========================= */

async function load() {

  try {

    const circles =
      await api("/api/circles");

    const el =
      get("circlesGrid");

    if (!el) return;

    if (!circles.length) {

      el.innerHTML = `
        <div class="card">

          <h3>
            No circles available yet
          </h3>

          <p>
            Create an account to start
            your own savings circle.
          </p>

        </div>
      `;

      return;
    }


    el.innerHTML =
      circles.map(circle => `

        <article class="card">

          <label>
            ${labels[circle.type] || circle.type}
          </label>

          <h3>
            ${money(circle.amountCents)}
          </h3>

          <p>
            ${circle.capacity}-member circle ·
            ${circle._count?.memberships || 0}/${circle.capacity}
            reserved
          </p>

          <button
            class="view-circle"
            data-circle-id="${circle.id}"
          >
            View payout dates
          </button>

        </article>

      `).join("");


    document.querySelectorAll(
      ".view-circle"
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectCircle(
            button.dataset.circleId
          );

        }
      );

    });

  } catch (e) {

    console.error(
      "Unable to load circles:",
      e
    );

  }

}


/* =========================
   PUBLIC CIRCLE DATES
========================= */

async function selectCircle(id) {

  try {

    const dates =
      await api(
        `/api/circles/${encodeURIComponent(id)}/dates`
      );


    if (!dates.length) {

      showModal(`

        <label>SCHEDULED PAYOUT</label>

        <h2>No payout dates yet</h2>

        <p>
          This circle does not have payout dates configured yet.
        </p>

      `);

      return;

    }


    showModal(`

      <label>SCHEDULED PAYOUT</label>

      <h2>Choose your date</h2>

      <p>
        Sign in or create your account to reserve
        an available payout date.
      </p>

      <div id="payoutDates">

        ${dates.slice(0, 12).map(date => `

          <button
            class="primary public-payout-date"
            data-circle-id="${id}"
            style="width:100%;margin:5px 0;padding:12px"
          >

            ${new Date(
              date.payoutAt
            ).toLocaleDateString(
              undefined,
              {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric"
              }
            )}

            · ${date.reserved}/${date.capacity}

          </button>

        `).join("")}

      </div>

    `);


    document.querySelectorAll(
      ".public-payout-date"
    ).forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          try {

            await api("/api/me");

            chooseCircle(
              button.dataset.circleId
            );

          } catch {

            showLogin();

          }

        }
      );

    });

  } catch (e) {

    alert(e.message);

  }

}
