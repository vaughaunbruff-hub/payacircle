const API = "/api";

let currentUser = null;
let currentMembershipId = null;
let currentCircle = null;
let currentDates = [];
let dashboardData = null;

const $ = id => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function money(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  const parts = String(name || "Member")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "M";

  return parts
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");
}

/* =========================
   MODAL
========================= */

function showModal(content) {
  const modal = $("modal");

  if (!modal) return;

  modal.innerHTML = `
    <div class="modalbox">
      <button class="x" id="modalClose" aria-label="Close">×</button>
      ${content}
    </div>
  `;

  modal.classList.add("show");

  $("modalClose")?.addEventListener("click", hideModal);
}

function hideModal() {
  const modal = $("modal");

  if (!modal) return;

  modal.classList.remove("show");
  modal.innerHTML = "";
}

/* =========================
   AUTH
========================= */

async function registerUser(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const name = form.querySelector('[name="name"]')?.value.trim();
  const email = form.querySelector('[name="email"]')?.value.trim();
  const password = form.querySelector('[name="password"]')?.value;

  try {
    const result = await api("/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    currentUser = result;

    hideModal();

    await showDashboard();

  } catch (error) {
    alert(error.message);
  }
}

async function loginUser(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const email = form.querySelector('[name="email"]')?.value.trim();
  const password = form.querySelector('[name="password"]')?.value;

  try {
    const result = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    currentUser = result;

    hideModal();

    await showDashboard();

  } catch (error) {
    alert(error.message);
  }
}

async function logoutUser() {
  try {
    await api("/logout", {
      method: "POST"
    });
  } catch {
    // Continue with local UI reset.
  }

  currentUser = null;
  dashboardData = null;
  currentMembershipId = null;
  currentCircle = null;

  hideDashboard();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================
   AUTH MODALS
========================= */

function openLogin() {
  showModal(`
    <div class="eyebrow">MEMBER ACCOUNT</div>
    <h2>Welcome back</h2>
    <p>Sign in to manage your PayaCircle savings.</p>

    <form id="loginForm">
      <label>Email</label>
      <input
        name="email"
        type="email"
        autocomplete="email"
        required
        placeholder="you@example.com"
      />

      <label>Password</label>
      <input
        name="password"
        type="password"
        autocomplete="current-password"
        required
        placeholder="Your password"
      />

      <button class="primary" type="submit">
        Sign in securely
      </button>
    </form>
  `);

  $("loginForm")?.addEventListener("submit", loginUser);
}

function openRegister() {
  showModal(`
    <div class="eyebrow">JOIN PAYACIRCLE</div>
    <h2>Create your account</h2>
    <p>Start managing your savings circles from one secure account.</p>

    <form id="registerForm">
      <label>Full name</label>
      <input
        name="name"
        autocomplete="name"
        required
        minlength="2"
        maxlength="80"
        placeholder="Your full name"
      />

      <label>Email address</label>
      <input
        name="email"
        type="email"
        autocomplete="email"
        required
        placeholder="you@example.com"
      />

      <label>Password</label>
      <input
        name="password"
        type="password"
        autocomplete="new-password"
        required
        minlength="10"
        placeholder="At least 10 characters"
      />

      <button class="primary" type="submit">
        Create secure account
      </button>
    </form>
  `);

  $("registerForm")?.addEventListener("submit", registerUser);
}

/* =========================
   PUBLIC CIRCLES
========================= */

async function loadPublicCircles() {
  const container = $("circleCards");

  if (!container) return;

  try {
    const circles = await api("/circles");

    if (!Array.isArray(circles) || !circles.length) {
      container.innerHTML = `
        <div class="card">
          <h3>No circles yet</h3>
          <p>New savings circles will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = circles.map(circle => {
      const members = circle._count?.memberships || 0;

      return `
        <article class="card">
          <div class="circle-meta">
            <span class="circle-type">
              ${escapeHTML(circle.type || "CUSTOM")}
            </span>
            <span class="circle-status">
              ${members}/${circle.capacity}
            </span>
          </div>

          <h3>${money(circle.amountCents)}</h3>

          <p>
            ${escapeHTML(circle.name || circle.code || "Savings Circle")}
          </p>

          <button
            type="button"
            class="public-circle-select"
            data-circle-id="${escapeHTML(circle.id)}"
          >
            View circle
          </button>
        </article>
      `;
    }).join("");

    container.querySelectorAll(".public-circle-select").forEach(button => {
      button.addEventListener("click", async () => {
        try {
          await getCircleDates(button.dataset.circleId);
        } catch (error) {
          alert(error.message);
        }
      });
    });

  } catch (error) {
    console.error("Public circles:", error);
  }
}

/* =========================
   DASHBOARD VISIBILITY
========================= */

function showDashboardContainer() {
  const dashboard = $("dashboard");

  if (dashboard) {
    dashboard.style.display = "block";
  }

  document
    .querySelectorAll("body > section:not(#dashboard)")
    .forEach(section => {
      if (
        section.id !== "dashboard" &&
        !section.classList.contains("modal")
      ) {
        section.dataset.publicHidden = section.style.display || "";
        section.style.display = "none";
      }
    });

  document
    .querySelectorAll("body > header, body > .announcement, body > footer")
    .forEach(element => {
      element.dataset.publicHidden = element.style.display || "";
      element.style.display = "none";
    });
}

function hideDashboard() {
  const dashboard = $("dashboard");

  if (dashboard) {
    dashboard.style.display = "none";
  }

  document
    .querySelectorAll("[data-public-hidden]")
    .forEach(element => {
      element.style.display = element.dataset.publicHidden || "";
      delete element.dataset.publicHidden;
    });

  loadPublicCircles();

  if (typeof setupPublicNavigation === "function") {
    setupPublicNavigation();
  }
}

/* =========================
   DASHBOARD LOADING
========================= */

async function showDashboard() {
  showDashboardContainer();

  try {
    const user = await api("/me");

    currentUser = user;
    dashboardData = user;

    renderDashboard(user);
    setupAccountNavigation();
    await loadDashboardCircles();

    switchAccountPanel("overview");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    console.error("Dashboard:", error);

    if (error.message === "Authentication required" ||
        error.message === "Invalid session") {
      hideDashboard();
      return;
    }

    alert(error.message);
  }
}

/* =========================
   DASHBOARD HEADER
========================= */

function renderDashboard(user) {
  const name = escapeHTML(user?.name || "Member");
  const email = escapeHTML(user?.email || "—");

  if ($("dashboardName")) {
    $("dashboardName").textContent = name;
  }

  if ($("dashboardEmail")) {
    $("dashboardEmail").textContent = email;
  }

  if ($("dashboardUserName")) {
    $("dashboardUserName").textContent = name;
  }

  if ($("dashboardUserEmail")) {
    $("dashboardUserEmail").textContent = email;
  }

  document
    .querySelectorAll(".dashboardUserInitials")
    .forEach(element => {
      element.textContent = initials(user?.name);
    });

  const memberships = Array.isArray(user?.memberships)
    ? user.memberships
    : [];

  const activeMemberships = memberships.filter(
    membership =>
      membership.status !== "CANCELLED" &&
      membership.status !== "REFUNDED"
  );

  const totalContributions = memberships.reduce((total, membership) => {
    const payments = Array.isArray(membership.payments)
      ? membership.payments
      : [];

    return total + payments
      .filter(payment => payment.status === "CAPTURED")
      .reduce(
        (sum, payment) => sum + Number(payment.amountCents || 0),
        0
      );
  }, 0);

  const nextPayout = activeMemberships
    .map(membership => membership.payoutDate?.payoutAt)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(a).getTime() - new Date(b).getTime()
    )[0];

  if ($("dashboardCircleCount")) {
    $("dashboardCircleCount").textContent =
      activeMemberships.length;
  }

  if ($("dashboardContributions")) {
    $("dashboardContributions").textContent =
      money(totalContributions);
  }

  if ($("dashboardNextPayout")) {
    $("dashboardNextPayout").textContent =
      formatDate(nextPayout);
  }

  renderBalanceCards(
    activeMemberships,
    totalContributions
  );

  renderMemberships(activeMemberships);
  renderTransactions(memberships);
  renderPayouts(activeMemberships);
  renderProfile(user);
}

/* =========================
   BALANCE / OVERVIEW
========================= */

function renderBalanceCards(memberships, totalContributions) {
  const totalSavings = memberships.reduce(
    (total, membership) => {
      const payments = Array.isArray(membership.payments)
        ? membership.payments
        : [];

      return total + payments
        .filter(payment => payment.status === "CAPTURED")
        .reduce(
          (sum, payment) =>
            sum + Number(payment.amountCents || 0),
          0
        );
    },
    0
  );

  const completedPayouts = memberships.reduce(
    (total, membership) =>
      total +
      Number(membership.payout?.amountCents || 0),
    0
  );

  const availableBalance =
    Math.max(totalSavings - completedPayouts, 0);

  const totalTarget = memberships.reduce(
    (total, membership) =>
      total + Number(membership.circle?.amountCents || 0),
    0
  );

  const progress =
    totalTarget > 0
      ? Math.min(
          100,
          Math.round(
            (totalSavings / totalTarget) * 100
          )
        )
      : 0;

  if ($("accountTotalSavings")) {
    $("accountTotalSavings").textContent =
      money(totalSavings);
  }

  if ($("accountAvailableBalance")) {
    $("accountAvailableBalance").textContent =
      money(availableBalance);
  }

  if ($("accountProgress")) {
    $("accountProgress").textContent =
      `${progress}%`;
  }

  document
    .querySelectorAll(".accountProgressBar")
    .forEach(bar => {
      bar.style.width = `${progress}%`;
    });
}

/* =========================
   ACCOUNT NAVIGATION
========================= */

function setupAccountNavigation() {
  document
    .querySelectorAll("[data-account-panel]")
    .forEach(button => {

      if (button.dataset.bound === "true") return;

      button.dataset.bound = "true";

      button.addEventListener("click", () => {
        switchAccountPanel(
          button.dataset.accountPanel
        );
      });
    });

  $("dashboardLogout")
    ?.addEventListener("click", logoutUser);

  $("dashboardCreateCircle")
    ?.addEventListener("click", openCreateCircle);

  $("cancelPayment")
    ?.addEventListener("click", closePaymentPanel);

  $("paypalButton")
    ?.addEventListener("click", startPayPalPayment);
}

function switchAccountPanel(panel) {
  const validPanels = [
    "overview",
    "circles",
    "contributions",
    "payouts",
    "payment-methods",
    "settings",
    "security",
    "help"
  ];

  if (!validPanels.includes(panel)) {
    panel = "overview";
  }

  document
    .querySelectorAll(".account-panel")
    .forEach(section => {
      section.classList.toggle(
        "active",
        section.dataset.panel === panel
      );
    });

  document
    .querySelectorAll("[data-account-panel]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.accountPanel === panel
      );
    });

  const titles = {
    overview: "Overview",
    circles: "My Circles",
    contributions: "Contributions",
    payouts: "Payouts",
    "payment-methods": "Payment Methods",
    settings: "Profile & Settings",
    security: "Security",
    help: "Help & Support"
  };

  const title = $("accountPanelTitle");

  if (title) {
    title.textContent = titles[panel];
  }

  const accountMain = $("accountMain");

  if (accountMain) {
    accountMain.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

/* =========================
   CIRCLES
========================= */

async function loadDashboardCircles() {
  const container = $("dashboardCircles");

  if (!container) return;

  try {
    const circles = await api("/circles");

    if (!Array.isArray(circles) || !circles.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◎</div>
          <h3>No savings circles yet</h3>
          <p>
            Create your first circle or check back when
            new circles become available.
          </p>
          <button
            class="primary"
            type="button"
            id="emptyCreateCircle"
          >
            Create a circle
          </button>
        </div>
      `;

      $("emptyCreateCircle")
        ?.addEventListener(
          "click",
          openCreateCircle
        );

      return;
    }

    container.innerHTML = circles.map(circle => {
      const members =
        circle._count?.memberships || 0;

      const capacity =
        Number(circle.capacity || 0);

      const percentage =
        capacity > 0
          ? Math.min(
              100,
              Math.round(
                (members / capacity) * 100
              )
            )
          : 0;

      return `
        <article class="card dashboard-circle-card">

          <div class="circle-meta">
            <span class="circle-type">
              ${escapeHTML(circle.type || "CUSTOM")}
            </span>

            <span class="circle-status">
              ${members}/${capacity} members
            </span>
          </div>

          <h3>
            ${escapeHTML(
              circle.name ||
              circle.code ||
              "Savings Circle"
            )}
          </h3>

          <p>
            Contribute
            <strong>${money(circle.amountCents)}</strong>
            toward your savings circle.
          </p>

          <div class="circle-details">

            <div class="circle-detail">
              <small>Contribution</small>
              <strong>
                ${money(circle.amountCents)}
              </strong>
            </div>

            <div class="circle-detail">
              <small>Members</small>
              <strong>
                ${members}/${capacity}
              </strong>
            </div>

          </div>

          <div class="circle-progress">
            <b style="width:${percentage}%"></b>
          </div>

          <div class="circle-progress-label">
            <span>${percentage}% filled</span>
            <span>${escapeHTML(circle.code || "")}</span>
          </div>

          <button
            type="button"
            class="circle-choose-button"
            data-circle-id="${escapeHTML(circle.id)}"
          >
            Choose this circle
          </button>

        </article>
      `;
    }).join("");

    container
      .querySelectorAll(".circle-choose-button")
      .forEach(button => {

        button.addEventListener("click", async () => {

          try {
            await getCircleDates(
              button.dataset.circleId
            );
          } catch (error) {
            alert(error.message);
          }

        });

      });

  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Unable to load circles</h3>
        <p>${escapeHTML(error.message)}</p>
      </div>
    `;
  }
}

async function getCircleDates(circleId) {
  try {
    const circles = await api("/circles");

    const circle = circles.find(
      item => item.id === circleId
    );

    if (!circle) {
      throw new Error("Circle not found.");
    }

    const dates = await api(
      `/circles/${encodeURIComponent(circleId)}/dates`
    );

    currentCircle = circle;
    currentDates = Array.isArray(dates)
      ? dates
      : [];

    if (!currentDates.length) {
      showModal(`
        <div class="eyebrow">SAVINGS CIRCLE</div>
        <h2>${escapeHTML(
          circle.name ||
          circle.code ||
          "Savings Circle"
        )}</h2>

        <p>
          This circle does not have any payout dates
          available yet.
        </p>

        <button
          class="primary"
          id="closeCircleNotice"
          type="button"
        >
          Continue
        </button>
      `);

      $("closeCircleNotice")
        ?.addEventListener(
          "click",
          hideModal
        );

      return;
    }

    openCircleSelection(circle, currentDates);

  } catch (error) {
    throw error;
  }
}

function openCircleSelection(circle, dates) {
  showModal(`
    <div class="eyebrow">CHOOSE YOUR CIRCLE</div>

    <h2>
      ${escapeHTML(
        circle.name ||
        circle.code ||
        "Savings Circle"
      )}
    </h2>

    <p>
      Contribution:
      <strong>${money(circle.amountCents)}</strong>
    </p>

    <label>Choose your payout date</label>

    <select id="payoutDateSelect">
      <option value="">Select a payout date</option>

      ${dates.map(date => `
        <option value="${escapeHTML(date.id)}"
          ${Number(date.reserved) >= Number(date.capacity)
            ? "disabled"
            : ""}
        >
          ${formatDate(date.payoutAt)}
          — ${date.reserved}/${date.capacity} reserved
        </option>
      `).join("")}

    </select>

    <button
      class="primary"
      id="reserveMembershipButton"
      type="button"
    >
      Continue
    </button>
  `);

  $("reserveMembershipButton")
    ?.addEventListener(
      "click",
      reserveMembership
    );
}

async function reserveMembership() {
  const payoutDateId =
    $("payoutDateSelect")?.value;

  if (!currentCircle || !payoutDateId) {
    alert("Please choose a payout date.");
    return;
  }

  try {
    const membership = await api(
      "/memberships",
      {
        method: "POST",
        body: JSON.stringify({
          circleId: currentCircle.id,
          payoutDateId
        })
      }
    );

    currentMembershipId = membership.id;

    hideModal();

    await refreshDashboard();

    openPaymentPanel(
      currentMembershipId
    );

  } catch (error) {
    alert(error.message);
  }
}

/* =========================
   CREATE CIRCLE
========================= */

function openCreateCircle() {
  showModal(`
    <div class="eyebrow">CREATE A CIRCLE</div>

    <h2>Build your savings circle</h2>

    <p>
      Set the contribution amount and number of
      members for your new circle.
    </p>

    <form id="createCircleForm">

      <label>Circle name</label>
      <input
        name="name"
        required
        minlength="2"
        maxlength="80"
        placeholder="Family Savings"
      />

      <label>Circle type</label>
      <select name="type" required>
        <option value="FAMILY">Family</option>
        <option value="FRIENDS">Friends</option>
        <option value="SOCIAL_MEDIA">Social Media</option>
        <option value="CUSTOM">Custom</option>
      </select>

      <label>Members</label>
      <input
        name="capacity"
        type="number"
        min="2"
        max="1000"
        value="10"
        required
      />

      <label>Contribution</label>
      <select name="amountUsd" required>
        ${Array.from(
          { length: 20 },
          (_, index) => {
            const amount =
              (index + 1) * 5;

            return `
              <option value="${amount}">
                $${amount}.00 USD
              </option>
            `;
          }
        ).join("")}
      </select>

      <button
        class="primary"
        type="submit"
      >
        Create circle
      </button>

    </form>
  `);

  $("createCircleForm")
    ?.addEventListener(
      "submit",
      createCircle
    );
}

async function createCircle(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const name =
    form.querySelector('[name="name"]')
      ?.value.trim();

  const type =
    form.querySelector('[name="type"]')
      ?.value;

  const capacity =
    Number(
      form.querySelector('[name="capacity"]')
        ?.value
    );

  const amountUsd =
    Number(
      form.querySelector('[name="amountUsd"]')
        ?.value
    );

  try {
    await api("/circles", {
      method: "POST",
      body: JSON.stringify({
        name,
        type,
        capacity,
        amountUsd
      })
    });

    hideModal();

    await loadDashboardCircles();

    showModal(`
      <div class="eyebrow">CIRCLE CREATED</div>
      <h2>Your savings circle is ready.</h2>
      <p>
        Your circle has been created successfully.
      </p>

      <button
        class="primary"
        id="circleCreatedClose"
        type="button"
      >
        View my circles
      </button>
    `);

    $("circleCreatedClose")
      ?.addEventListener(
        "click",
        () => {
          hideModal();
          switchAccountPanel("circles");
        }
      );

  } catch (error) {
    alert(error.message);
  }
}

/* =========================
   MEMBERSHIPS
========================= */

function renderMemberships(memberships) {
  const container = $("myMemberships");

  if (!container) return;

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <h3>Your circles will appear here</h3>
        <p>
          Join a savings circle to start building
          your PayaCircle history.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = memberships.map(
    membership => {

      const circle =
        membership.circle || {};

      const status =
        membership.status || "UNKNOWN";

      const paymentStatus =
        getMembershipPaymentStatus(
          membership
        );

      return `
        <div class="membership-row">

          <div class="membership-main">

            <div class="membership-icon">
              ◎
            </div>

            <div>
              <strong>
                ${escapeHTML(
                  circle.name ||
                  circle.code ||
                  "Savings Circle"
                )}
              </strong>

              <span>
                ${escapeHTML(
                  circle.type ||
                  "CUSTOM"
                )}
              </span>
            </div>

          </div>

          <div class="membership-info">
            <small>Contribution</small>
            <strong>
              ${money(circle.amountCents)}
            </strong>
          </div>

          <div class="membership-info">
            <small>Payout</small>
            <strong>
              ${formatDate(
                membership.payoutDate?.payoutAt
              )}
            </strong>
          </div>

          <div class="membership-info">
            <small>Status</small>
            <span class="status-badge ${statusClass(paymentStatus)}">
              ${escapeHTML(paymentStatus)}
            </span>
          </div>

          <div>
            ${
              status === "PAYMENT_PENDING"
                ? `
                  <button
                    class="setting-action pay-membership-button"
                    type="button"
                    data-membership-id="${escapeHTML(
                      membership.id
                    )}"
                  >
                    Pay now
                  </button>
                `
                : `
                  <button
                    class="setting-action view-membership-button"
                    type="button"
                    data-membership-id="${escapeHTML(
                      membership.id
                    )}"
                  >
                    View
                  </button>
                `
            }
          </div>

        </div>
      `;
    }
  ).join("");

  container
    .querySelectorAll(".pay-membership-button")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          currentMembershipId =
            button.dataset.membershipId;

          openPaymentPanel(
            currentMembershipId
          );
        }
      );
    });

  container
    .querySelectorAll(".view-membership-button")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const membership =
            memberships.find(
              item =>
                item.id ===
                button.dataset.membershipId
            );

          if (membership) {
            showMembershipDetails(
              membership
            );
          }
        }
      );
    });
}

function getMembershipPaymentStatus(
  membership
) {
  if (
    membership.status === "PAID" ||
    membership.status === "PAYOUT_SCHEDULED" ||
    membership.status === "PAID_OUT"
  ) {
    return "Paid";
  }

  if (membership.status === "PAYMENT_PENDING") {
    return "Pending";
  }

  if (membership.status === "REFUNDED") {
    return "Refunded";
  }

  if (membership.status === "CANCELLED") {
    return "Cancelled";
  }

  const payments =
    Array.isArray(membership.payments)
      ? membership.payments
      : [];

  if (
    payments.some(
      payment =>
        payment.status === "FAILED"
    )
  ) {
    return "Failed";
  }

  return "Pending";
}

function statusClass(status) {
  const value =
    String(status || "")
      .toLowerCase();

  if (value === "paid") {
    return "status-paid";
  }

  if (value === "pending") {
    return "status-pending";
  }

  if (value === "failed") {
    return "status-failed";
  }

  if (value === "refunded") {
    return "status-refunded";
  }

  return "status-pending";
}

function showMembershipDetails(membership) {
  const circle =
    membership.circle || {};

  showModal(`
    <div class="eyebrow">MY CIRCLE</div>

    <h2>
      ${escapeHTML(
        circle.name ||
        circle.code ||
        "Savings Circle"
      )}
    </h2>

    <div class="payment-summary">

      <div>
        <small>Contribution</small>
        <strong>
          ${money(circle.amountCents)}
        </strong>
      </div>

      <div>
        <small>Payout date</small>
        <strong>
          ${formatDate(
            membership.payoutDate?.payoutAt
          )}
        </strong>
      </div>

      <div>
        <small>Status</small>
        <strong>
          ${escapeHTML(
            getMembershipPaymentStatus(
              membership
            )
          )}
        </strong>
      </div>

    </div>

    <button
      class="primary"
      id="membershipDetailsClose"
      type="button"
    >
      Close
    </button>
  `);

  $("membershipDetailsClose")
    ?.addEventListener(
      "click",
      hideModal
    );
}

/* =========================
   CONTRIBUTIONS
========================= */

function renderTransactions(memberships) {
  const container =
    $("contributionTransactions");

  if (!container) return;

  const transactions = [];

  memberships.forEach(membership => {

    const payments =
      Array.isArray(membership.payments)
        ? membership.payments
        : [];

    payments.forEach(payment => {
      transactions.push({
        ...payment,
        circle:
          membership.circle?.name ||
          membership.circle?.code ||
          "Savings Circle"
      });
    });

  });

  transactions.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  if (!transactions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">↗</div>
        <h3>No contributions yet</h3>
        <p>
          Confirmed contributions will appear here.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML =
    transactions.map(transaction => {

      const status =
        transaction.status || "CREATED";

      return `
        <div class="transaction-row">

          <div class="transaction-icon">
            $
          </div>

          <div class="transaction-info">
            <strong>
              ${escapeHTML(transaction.circle)}
            </strong>

            <span>
              ${formatDateTime(
                transaction.createdAt
              )}
              · PayPal
            </span>
          </div>

          <div class="transaction-amount">

            <strong>
              ${money(transaction.amountCents)}
            </strong>

            <span class="status-badge ${statusClass(
              status === "CAPTURED"
                ? "Paid"
                : status === "FAILED"
                ? "Failed"
                : "Pending"
            )}">
              ${
                status === "CAPTURED"
                  ? "Paid"
                  : status === "FAILED"
                  ? "Failed"
                  : "Pending"
              }
            </span>

          </div>

        </div>
      `;
    }).join("");
}

/* =========================
   PAYOUTS
========================= */

function renderPayouts(memberships) {
  const container =
    $("payoutTimeline");

  if (!container) return;

  const payouts = memberships
    .filter(
      membership =>
        membership.payoutDate
    )
    .map(membership => ({
      membership,
      date:
        membership.payoutDate?.payoutAt
    }))
    .sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

  if (!payouts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <h3>No payouts scheduled</h3>
        <p>
          Your scheduled payout information will
          appear here.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML =
    payouts.map(item => {

      const membership =
        item.membership;

      const circle =
        membership.circle || {};

      const amount =
        Number(circle.amountCents || 0);

      const payoutStatus =
        membership.status === "PAID_OUT"
          ? "Completed"
          : membership.status === "PAYOUT_SCHEDULED"
          ? "Scheduled"
          : "Upcoming";

      return `
        <div class="payout-item">

          <div class="payout-dot">
            $
          </div>

          <div class="payout-info">

            <strong>
              ${escapeHTML(
                circle.name ||
                circle.code ||
                "Savings Circle"
              )}
            </strong>

            <span>
              ${formatDate(item.date)}
            </span>

          </div>

          <div class="payout-value">

            <strong>
              ${money(amount)}
            </strong>

            <span>
              ${payoutStatus}
            </span>

          </div>

        </div>
      `;
    }).join("");
}

/* =========================
   PROFILE
========================= */

function renderProfile(user) {
  if ($("profileName")) {
    $("profileName").textContent =
      user?.name || "Member";
  }

  if ($("profileEmail")) {
    $("profileEmail").textContent =
      user?.email || "—";
  }

  if ($("profilePaypalEmail")) {
    $("profilePaypalEmail").textContent =
      user?.paypalEmail ||
      "Not connected";
  }
}

/* =========================
   PAYMENT PANEL
========================= */

function openPaymentPanel(membershipId) {
  const panel =
    $("paymentPanel");

  const details =
    $("paymentDetails");

  if (!panel || !details) return;

  const membership =
    currentUser?.memberships?.find(
      item =>
        item.id === membershipId
    );

  if (!membership) {
    alert("Membership could not be found.");
    return;
  }

  const circle =
    membership.circle || {};

  details.innerHTML = `
    <div class="payment-summary">

      <div>
        <small>Circle</small>
        <strong>
          ${escapeHTML(
            circle.name ||
            circle.code ||
            "Savings Circle"
          )}
        </strong>
      </div>

      <div>
        <small>Contribution</small>
        <strong>
          ${money(circle.amountCents)}
        </strong>
      </div>

      <div>
        <small>Payout date</small>
        <strong>
          ${formatDate(
            membership.payoutDate?.payoutAt
          )}
        </strong>
      </div>

    </div>
  `;

  panel.style.display = "block";

  panel.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function closePaymentPanel() {
  const panel =
    $("paymentPanel");

  if (panel) {
    panel.style.display = "none";
  }

  currentMembershipId = null;
}

/* =========================
   PAYPAL
========================= */

async function startPayPalPayment() {
  if (!currentMembershipId) {
    alert("Please select a membership first.");
    return;
  }

  const button =
    $("paypalButton");

  try {

    if (button) {
      button.disabled = true;
      button.textContent =
        "Connecting to PayPal...";
    }

    const result =
      await api(
        "/paypal/create-order",
        {
          method: "POST",
          body: JSON.stringify({
            membershipId:
              currentMembershipId
          })
        }
      );

    if (result.approvalUrl) {
      window.location.href =
        result.approvalUrl;

      return;
    }

    throw new Error(
      "PayPal did not return an approval link."
    );

  } catch (error) {

    alert(error.message);

    if (button) {
      button.disabled = false;
      button.textContent =
        "Pay with PayPal";
    }
  }
}

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
      <div class="eyebrow">
        PAYMENT CANCELLED
      </div>

      <h2>
        Payment was cancelled
      </h2>

      <p>
        Your membership is still reserved and
        remains payment-pending.
      </p>

      <button
        class="primary"
        id="cancelReturnButton"
        type="button"
      >
        Return to dashboard
      </button>
    `);

    $("cancelReturnButton")
      ?.addEventListener(
        "click",
        hideModal
      );

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
      <div class="eyebrow">
        PAYPAL PAYMENT
      </div>

      <h2>
        Confirming your payment...
      </h2>

      <p>
        Please wait while PayaCircle confirms
        your PayPal transaction.
      </p>
    `);

    const result =
      await api(
        "/paypal/capture-order",
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
      result.status ===
      "COMPLETED"
    ) {

      hideModal();

      const success =
        $("paymentSuccess");

      if (success) {
        success.style.display = "flex";

        success.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }

      await showDashboard();

      const refreshedSuccess =
        $("paymentSuccess");

      if (refreshedSuccess) {
        refreshedSuccess.style.display =
          "flex";
      }

    } else {

      showModal(`
        <div class="eyebrow">
          PAYMENT STATUS
        </div>

        <h2>
          Payment was not completed
        </h2>

        <p>
          PayPal returned the status:
          <strong>
            ${escapeHTML(
              result.status ||
              "UNKNOWN"
            )}
          </strong>
        </p>

        <button
          class="primary"
          id="paymentStatusClose"
          type="button"
        >
          Return to dashboard
        </button>
      `);

      $("paymentStatusClose")
        ?.addEventListener(
          "click",
          hideModal
        );
    }

  } catch (error) {

    console.error(
      "PayPal capture error:",
      error
    );

    showModal(`
      <div class="eyebrow">
        PAYMENT ERROR
      </div>

      <h2>
        We could not confirm the payment
      </h2>

      <p>
        Please check your PayPal account before
        attempting another payment.
      </p>

      <p>
        Error:
        ${escapeHTML(error.message)}
      </p>

      <button
        class="primary"
        id="paymentErrorClose"
        type="button"
      >
        Return to dashboard
      </button>
    `);

    $("paymentErrorClose")
      ?.addEventListener(
        "click",
        hideModal
      );
  }
}

/* =========================
   REFRESH
========================= */

async function refreshDashboard() {
  const user =
    await api("/me");

  currentUser = user;
  dashboardData = user;

  renderDashboard(user);
  await loadDashboardCircles();
}

/* =========================
   PUBLIC NAVIGATION
========================= */

function setupPublicNavigation() {

  document
    .querySelectorAll(
      "[data-login], .nav-login"
    )
    .forEach(button => {

      if (button.dataset.loginBound === "true") {
        return;
      }

      button.dataset.loginBound = "true";

      button.addEventListener(
        "click",
        openLogin
      );
    });

  document
    .querySelectorAll(
      "[data-register], .nav-cta, .cta"
    )
    .forEach(button => {

      if (
        button.id === "paypalButton" ||
        button.dataset.registerBound === "true"
      ) {
        return;
      }

      button.dataset.registerBound = "true";

      button.addEventListener(
        "click",
        event => {

          if (
            button.closest("#dashboard")
          ) {
            return;
          }

          event.preventDefault();
          openRegister();
        }
      );
    });
}

/* =========================
   INITIALIZATION
========================= */

async function load() {

  setupPublicNavigation();

  await loadPublicCircles();

  try {

    const user =
      await api("/me");

    currentUser = user;

    await showDashboard();

  } catch {
    hideDashboard();
  }

  await handlePayPalReturn();
}

document.addEventListener(
  "DOMContentLoaded",
  load
);
