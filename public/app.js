const API = "/api";

let currentUser = null;
let currentMembership = null;
let currentCircle = null;
let currentPayoutDate = null;
let paypalReturnHandled = false;

const $ = (selector, root = document) => {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
};

const $$ = (selector, root = document) => {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }

  return data;
}

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
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
  const value = String(name || "Member").trim();

  if (!value) return "M";

  const parts = value.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function humanize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getTypeLabel(type) {
  const labels = {
    FAMILY: "Family",
    FRIENDS: "Friends",
    SOCIAL_MEDIA: "Social Media",
    CUSTOM: "Custom"
  };

  return labels[type] || humanize(type);
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("paid") ||
    value.includes("approved") ||
    value.includes("captured") ||
    value.includes("completed")
  ) {
    return "success";
  }

  if (
    value.includes("pending") ||
    value.includes("scheduled") ||
    value.includes("reserved")
  ) {
    return "pending";
  }

  if (
    value.includes("failed") ||
    value.includes("cancel") ||
    value.includes("refund")
  ) {
    return "danger";
  }

  return "secure";
}

function getStatusLabel(status) {
  return humanize(status);
}

function showToast(message, type = "info") {
  let toast = $("#pcToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pcToast";
    toast.className = "pc-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");

  clearTimeout(window.__pcToastTimer);

  window.__pcToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function setLoading(button, loading, text = "Please wait...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}


/* =========================================================
   AUTH MODAL
   ========================================================= */

function openAuthModal(mode = "register") {
  const modal = $("#authModal");

  if (!modal) return;

  modal.style.display = "flex";
  modal.classList.add("open");

  if (mode === "login") {
    openLogin();
  } else {
    openRegister();
  }
}

function closeAuthModal() {
  const modal = $("#authModal");

  if (!modal) return;

  modal.style.display = "none";
  modal.classList.remove("open");
}

function openRegister() {
  const registerForm = $("#registerForm");
  const loginForm = $("#loginForm");
  const registerTab = $("#registerTab");
  const loginTab = $("#loginTab");
  const title = $("#authModalTitle");

  if (registerForm) registerForm.style.display = "block";
  if (loginForm) loginForm.style.display = "none";

  if (registerTab) registerTab.classList.add("active");
  if (loginTab) loginTab.classList.remove("active");

  if (title) title.textContent = "Create your account";

  openAuthModalWithoutRecursion();
}

function openLogin() {
  const registerForm = $("#registerForm");
  const loginForm = $("#loginForm");
  const registerTab = $("#registerTab");
  const loginTab = $("#loginTab");
  const title = $("#authModalTitle");

  if (registerForm) registerForm.style.display = "none";
  if (loginForm) loginForm.style.display = "block";

  if (registerTab) registerTab.classList.remove("active");
  if (loginTab) loginTab.classList.add("active");

  if (title) title.textContent = "Sign in to your account";

  openAuthModalWithoutRecursion();
}

function openAuthModalWithoutRecursion() {
  const modal = $("#authModal");

  if (!modal) return;

  modal.style.display = "flex";
  modal.classList.add("open");
}

function bindAuthButtons() {
  const loginButtons = [
    "#headerSignIn",
    "#heroSignIn",
    "#footerSignIn"
  ];

  const registerButtons = [
    "#headerGetStarted",
    "#heroGetStarted",
    "#promoGetStarted",
    "#finalGetStarted"
  ];

  loginButtons.forEach(selector => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();

      if (currentUser) {
        showDashboard();
      } else {
        openLogin();
      }
    });
  });

  registerButtons.forEach(selector => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();

      if (currentUser) {
        showDashboard();
      } else {
        openRegister();
      }
    });
  });

  const closeButton = $("#closeAuthModal");

  if (closeButton) {
    closeButton.addEventListener("click", event => {
      event.preventDefault();
      closeAuthModal();
    });
  }

  const registerTab = $("#registerTab");

  if (registerTab) {
    registerTab.addEventListener("click", event => {
      event.preventDefault();
      openRegister();
    });
  }

  const loginTab = $("#loginTab");

  if (loginTab) {
    loginTab.addEventListener("click", event => {
      event.preventDefault();
      openLogin();
    });
  }

  const modal = $("#authModal");

  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeAuthModal();
      }
    });
  }
}


/* =========================================================
   REGISTER
   ========================================================= */

async function register(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#registerMessage");

  const name = $("#registerName")?.value.trim();
  const email = $("#registerEmail")?.value.trim();
  const password = $("#registerPassword")?.value;

  if (!name || !email || !password) {
    if (message) {
      message.textContent = "Please complete all fields.";
      message.className = "form-message error";
    }

    return;
  }

  setLoading(button, true, "Creating account...");

  if (message) {
    message.textContent = "";
    message.className = "form-message";
  }

  try {
    const data = await api("/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    if (message) {
      message.textContent = data.message || "Account created successfully.";
      message.className = "form-message success";
    }

    await loadCurrentUser();

    closeAuthModal();

    if (currentUser) {
      showDashboard();
    }
  } catch (error) {
    if (message) {
      message.textContent = error.message;
      message.className = "form-message error";
    }
  } finally {
    setLoading(button, false);
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#loginMessage");

  const email = $("#loginEmail")?.value.trim();
  const password = $("#loginPassword")?.value;

  if (!email || !password) {
    if (message) {
      message.textContent = "Please enter your email and password.";
      message.className = "form-message error";
    }

    return;
  }

  setLoading(button, true, "Signing in...");

  if (message) {
    message.textContent = "";
    message.className = "form-message";
  }

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    if (message) {
      message.textContent = data.message || "Signed in successfully.";
      message.className = "form-message success";
    }

    await loadCurrentUser();

    closeAuthModal();

    if (currentUser) {
      showDashboard();
    }
  } catch (error) {
    if (message) {
      message.textContent = error.message;
      message.className = "form-message error";
    }
  } finally {
    setLoading(button, false);
  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {
  try {
    await api("/logout", {
      method: "POST"
    });
  } catch {
    // Continue to clear the local session even if the request fails.
  }

  currentUser = null;
  currentMembership = null;
  currentCircle = null;
  currentPayoutDate = null;

  hideDashboard();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  showToast("You have been signed out.", "success");
}


/* =========================================================
   DASHBOARD VISIBILITY
   ========================================================= */

function hideDashboard() {
  const dashboard = $("#dashboard");
  const publicSite = $("#publicSite");

  if (dashboard) dashboard.style.display = "none";
  if (publicSite) publicSite.style.display = "";

  document.body.classList.remove("account-view");
}

function showDashboardElements() {
  const dashboard = $("#dashboard");
  const publicSite = $("#publicSite");

  if (publicSite) publicSite.style.display = "none";

  if (dashboard) {
    dashboard.style.display = "block";
  }

  document.body.classList.add("account-view");
}

async function showDashboard() {
  if (!currentUser) {
    openLogin();
    return;
  }

  showDashboardElements();

  await refreshDashboard();

  activateAccountPanel("overview");
}


/* =========================================================
   CURRENT USER
   ========================================================= */

async function loadCurrentUser() {
  try {
    const data = await api("/me");

    currentUser = data.user || data;

    return currentUser;
  } catch {
    currentUser = null;
    return null;
  }
}


/* =========================================================
   DASHBOARD USER DISPLAY
   ========================================================= */

function renderUserInformation() {
  if (!currentUser) return;

  const name = currentUser.name || "Member";
  const email = currentUser.email || "—";
  const userInitials = initials(name);

  const nameTargets = [
    "#dashboardUserName",
    "#profileMenuName",
    "#profileName"
  ];

  nameTargets.forEach(selector => {
    const element = $(selector);

    if (element) {
      element.textContent = name;
    }
  });

  const emailTargets = [
    "#dashboardUserEmail",
    "#profileMenuEmail",
    "#profileEmail"
  ];

  emailTargets.forEach(selector => {
    const element = $(selector);

    if (element) {
      element.textContent = email;
    }
  });

  const paypalEmail = $("#profilePaypalEmail");

  if (paypalEmail) {
    paypalEmail.textContent =
      currentUser.paypalEmail || "Not provided";
  }

  $$(".dashboardUserInitials").forEach(element => {
    element.textContent = userInitials;
  });

  const welcomeName = $("#dashboardWelcomeName");

  if (welcomeName) {
    welcomeName.textContent = name.split(/\s+/)[0];
  }
}


/* =========================================================
   ACCOUNT NAVIGATION
   ========================================================= */

function activateAccountPanel(panelName) {
  if (!panelName) panelName = "overview";

  $$(".account-panel").forEach(panel => {
    const isActive = panel.dataset.panel === panelName;

    panel.classList.toggle("active", isActive);
    panel.style.display = isActive ? "block" : "none";
  });

  $$("[data-account-panel]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.accountPanel === panelName
    );
  });

  const paymentPanel = $("#paymentPanel");
  const paymentSuccess = $("#paymentSuccess");

  if (paymentPanel) {
    paymentPanel.style.display = "none";
  }

  if (paymentSuccess) {
    paymentSuccess.style.display = "none";
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function bindAccountNavigation() {
  $$("[data-account-panel]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      const panel = button.dataset.accountPanel;

      if (panel) {
        activateAccountPanel(panel);
      }
    });
  });
}


/* =========================================================
   DASHBOARD REFRESH
   ========================================================= */

async function refreshDashboard() {
  if (!currentUser) return;

  renderUserInformation();

  await Promise.allSettled([
    loadMemberships(),
    loadTransactions(),
    loadPayouts()
  ]);

  renderOverview();
}


/* =========================================================
   CIRCLES
   ========================================================= */

async function loadPublicCircles() {
  const container = $("#publicCircles");

  if (!container) return;

  try {
    const data = await api("/circles");

    const circles = Array.isArray(data)
      ? data
      : data.circles || [];

    if (!circles.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◎</div>
          <strong>No circles available yet</strong>
          <span>New savings circles will appear here.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = circles.map(circle => `
      <article class="circle-card">
        <div class="circle-card-top">
          <span class="circle-type">${escapeHTML(getTypeLabel(circle.type))}</span>
          <span class="status-badge ${getStatusClass(circle.status)}">
            ${escapeHTML(humanize(circle.status || "Available"))}
          </span>
        </div>

        <h3>${escapeHTML(circle.name || "Savings Circle")}</h3>

        <div class="circle-card-amount">
          ${money(circle.amountCents)}
          <small>contribution</small>
        </div>

        <div class="circle-card-details">
          <span>${escapeHTML(String(circle.capacity || 0))} members</span>
          <span>${escapeHTML(String(circle.code || ""))}</span>
        </div>

        <button
          class="primary full-width public-circle-button"
          data-circle-id="${escapeHTML(circle.id)}"
        >
          View Circle
        </button>
      </article>
    `).join("");

    $$(".public-circle-button").forEach(button => {
      button.addEventListener("click", () => {
        openCircleDetails(button.dataset.circleId);
      });
    });
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <strong>Unable to load circles</strong>
        <span>Please try again shortly.</span>
      </div>
    `;
  }
}

async function loadCirclesPage() {
  const container = $("#circlesPageGrid");

  if (!container) return;

  try {
    const data = await api("/circles");

    const circles = Array.isArray(data)
      ? data
      : data.circles || [];

    if (!circles.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◎</div>
          <strong>No circles available</strong>
          <span>There are currently no savings circles to display.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = circles.map(circle => `
      <article class="circle-card">
        <div class="circle-card-top">
          <span class="circle-type">${escapeHTML(getTypeLabel(circle.type))}</span>
          <span class="status-badge ${getStatusClass(circle.status)}">
            ${escapeHTML(humanize(circle.status || "Available"))}
          </span>
        </div>

        <h3>${escapeHTML(circle.name || "Savings Circle")}</h3>

        <div class="circle-card-amount">
          ${money(circle.amountCents)}
          <small>contribution</small>
        </div>

        <div class="circle-card-details">
          <span>Capacity: ${escapeHTML(String(circle.capacity || 0))}</span>
          <span>${escapeHTML(circle.code || "")}</span>
        </div>

        <button
          class="primary full-width join-circle-button"
          data-circle-id="${escapeHTML(circle.id)}"
        >
          Join Circle
        </button>
      </article>
    `).join("");

    $$(".join-circle-button").forEach(button => {
      button.addEventListener("click", () => {
        openCircleDetails(button.dataset.circleId);
      });
    });
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <strong>Unable to load circles</strong>
        <span>Please refresh and try again.</span>
      </div>
    `;
  }
}

async function openCircleDetails(circleId) {
  if (!circleId) return;

  const modal = $("#circleDetailsModal");
  const content = $("#circleDetailsContent");

  if (!modal || !content) return;

  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">◌</div>
      <strong>Loading circle</strong>
      <span>Please wait...</span>
    </div>
  `;

  modal.style.display = "flex";
  modal.classList.add("open");

  try {
    const data = await api(`/circles/${encodeURIComponent(circleId)}`);

    const circle = data.circle || data;

    currentCircle = circle;

    let dates = [];

    try {
      const dateData = await api(
        `/circles/${encodeURIComponent(circleId)}/dates`
      );

      dates = Array.isArray(dateData)
        ? dateData
        : dateData.dates || [];
    } catch {
      dates = [];
    }

    content.innerHTML = `
      <div class="modal-header">
        <div class="modal-logo">◎</div>
        <div>
          <div class="eyebrow">${escapeHTML(getTypeLabel(circle.type))}</div>
          <h2>${escapeHTML(circle.name || "Savings Circle")}</h2>
        </div>
      </div>

      <div class="circle-detail-summary">
        <div>
          <span>Contribution</span>
          <strong>${money(circle.amountCents)}</strong>
        </div>

        <div>
          <span>Members</span>
          <strong>${escapeHTML(String(circle.capacity || 0))}</strong>
        </div>
      </div>

      <div class="circle-detail-section">
        <div class="eyebrow">PAYOUT DATE</div>
        <h3>Choose your payout date</h3>

        <div class="payout-date-options">
          ${
            dates.length
              ? dates.map(date => `
                <button
                  type="button"
                  class="payout-date-option"
                  data-payout-date-id="${escapeHTML(date.id)}"
                  data-payout-date="${escapeHTML(date.payoutAt)}"
                >
                  <strong>${escapeHTML(formatDate(date.payoutAt))}</strong>
                  <span>
                    ${escapeHTML(String(date.reserved || 0))}
                    /
                    ${escapeHTML(String(date.capacity || 1))}
                    reserved
                  </span>
                </button>
              `).join("")
              : `
                <div class="empty-state compact">
                  <strong>No payout dates available</strong>
                  <span>Please check again later.</span>
                </div>
              `
          }
        </div>
      </div>

      <div class="circle-detail-actions">
        <button
          class="primary full-width"
          id="continueCircleButton"
          ${dates.length ? "" : "disabled"}
        >
          Continue
        </button>
      </div>
    `;

    currentPayoutDate = null;

    $$(".payout-date-option", content).forEach(button => {
      button.addEventListener("click", () => {
        $$(".payout-date-option", content).forEach(item => {
          item.classList.remove("selected");
        });

        button.classList.add("selected");

        currentPayoutDate = {
          id: button.dataset.payoutDateId,
          payoutAt: button.dataset.payoutDate
        };
      });
    });

    const continueButton = $("#continueCircleButton", content);

    if (continueButton) {
      continueButton.addEventListener("click", async () => {
        if (!currentPayoutDate) {
          showToast("Please choose a payout date.", "info");
          return;
        }

        if (!currentUser) {
          closeCircleDetailsModal();
          openLogin();
          return;
        }

        await reserveMembership(
          circle.id,
          currentPayoutDate.id
        );
      });
    }
  } catch (error) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <strong>Unable to open circle</strong>
        <span>${escapeHTML(error.message)}</span>
      </div>
    `;
  }
}

function closeCircleDetailsModal() {
  const modal = $("#circleDetailsModal");

  if (!modal) return;

  modal.style.display = "none";
  modal.classList.remove("open");
}

async function reserveMembership(circleId, payoutDateId) {
  try {
    const data = await api("/memberships", {
      method: "POST",
      body: JSON.stringify({
        circleId,
        payoutDateId
      })
    });

    currentMembership = data.membership || data;

    closeCircleDetailsModal();

    await showPaymentPanel(currentMembership);
  } catch (error) {
    showToast(error.message, "error");
  }
}


/* =========================================================
   MEMBERSHIPS
   ========================================================= */

async function loadMemberships() {
  try {
    const data = await api("/memberships");

    const memberships = Array.isArray(data)
      ? data
      : data.memberships || [];

    currentMembership = memberships[0] || null;

    renderMemberships(memberships);

    return memberships;
  } catch {
    renderMemberships([]);
    return [];
  }
}

function renderMemberships(memberships) {
  const container = $("#dashboardCircles");

  if (!container) return;

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <strong>No active circles yet</strong>
        <span>Choose a savings circle to get started.</span>
        <button
          class="primary"
          data-account-panel="circles"
        >
          Browse Circles
        </button>
      </div>
    `;

    const browseButton = container.querySelector(
      "[data-account-panel='circles']"
    );

    if (browseButton) {
      browseButton.addEventListener("click", () => {
        activateAccountPanel("circles");
      });
    }

    return;
  }

  container.innerHTML = memberships.map(membership => {
    const circle = membership.circle || {};
    const payoutDate = membership.payoutDate || {};

    return `
      <article class="account-circle-card">
        <div class="account-circle-card-top">
          <span class="circle-type">
            ${escapeHTML(getTypeLabel(circle.type))}
          </span>

          <span class="status-badge ${getStatusClass(membership.status)}">
            ${escapeHTML(getStatusLabel(membership.status))}
          </span>
        </div>

        <h3>${escapeHTML(circle.name || "Savings Circle")}</h3>

        <div class="account-circle-meta">
          <div>
            <span>Contribution</span>
            <strong>${money(circle.amountCents)}</strong>
          </div>

          <div>
            <span>Payout</span>
            <strong>${escapeHTML(formatDate(payoutDate.payoutAt))}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");
}


/* =========================================================
   TRANSACTIONS
   ========================================================= */

async function loadTransactions() {
  try {
    const data = await api("/payments");

    const payments = Array.isArray(data)
      ? data
      : data.payments || data.transactions || [];

    renderTransactions(payments);

    return payments;
  } catch {
    renderTransactions([]);
    return [];
  }
}

function renderTransactions(payments) {
  const containers = [
    "#contributionTransactions",
    "#contributionsPageList"
  ];

  containers.forEach(selector => {
    const container = $(selector);

    if (!container) return;

    if (!payments.length) {
      container.innerHTML = `
        <div class="empty-state compact">
          <div class="empty-icon">↙</div>
          <strong>No transactions yet</strong>
          <span>Your confirmed contributions will appear here.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = payments.map(payment => `
      <div class="transaction-row">
        <div>
          <strong>${escapeHTML(payment.circle?.name || "PayaCircle")}</strong>
          <span>${escapeHTML(formatDateTime(payment.createdAt))}</span>
        </div>

        <div>
          <strong>${money(payment.amountCents)}</strong>
          <span class="status-badge ${getStatusClass(payment.status)}">
            ${escapeHTML(getStatusLabel(payment.status))}
          </span>
        </div>
      </div>
    `).join("");
  });

  const total = payments.reduce(
    (sum, payment) => sum + (Number(payment.amountCents) || 0),
    0
  );

  const paid = payments.filter(
    payment => payment.status === "CAPTURED"
  ).length;

  const pending = payments.filter(
    payment =>
      payment.status === "CREATED" ||
      payment.status === "APPROVED"
  ).length;

  const totalElement = $("#contributionTotal");
  const paidElement = $("#contributionPaidCount");
  const pendingElement = $("#contributionPendingCount");

  if (totalElement) totalElement.textContent = money(total);
  if (paidElement) paidElement.textContent = String(paid);
  if (pendingElement) pendingElement.textContent = String(pending);
}


/* =========================================================
   PAYOUTS
   ========================================================= */

async function loadPayouts() {
  try {
    const data = await api("/payouts");

    const payouts = Array.isArray(data)
      ? data
      : data.payouts || [];

    renderPayouts(payouts);

    return payouts;
  } catch {
    renderPayouts([]);
    return [];
  }
}

function renderPayouts(payouts) {
  const container = $("#payoutTimeline");

  if (!container) return;

  if (!payouts.length) {
    container.innerHTML = `
      <div class="empty-state compact">
        <div class="empty-icon">↗</div>
        <strong>No payouts yet</strong>
        <span>
          Your payout schedule will appear here after joining a circle.
        </span>
      </div>
    `;

    return;
  }

  container.innerHTML = payouts.map(payout => `
    <div class="payout-timeline-item">
      <div class="payout-timeline-icon">↗</div>

      <div class="payout-timeline-content">
        <strong>${money(payout.amountCents)}</strong>
        <span>${escapeHTML(formatDate(payout.payoutDate?.payoutAt))}</span>
      </div>

      <span class="status-badge ${getStatusClass(payout.status)}">
        ${escapeHTML(getStatusLabel(payout.status))}
      </span>
    </div>
  `).join("");

  const next = payouts
    .filter(payout => payout.status === "SCHEDULED")
    .sort((a, b) => {
      return new Date(a.payoutDate?.payoutAt || 0) -
        new Date(b.payoutDate?.payoutAt || 0);
    })[0];

  const nextAmount = $("#payoutPageNextAmount");
  const nextDate = $("#payoutPageNextDate");

  if (next) {
    if (nextAmount) {
      nextAmount.textContent = money(next.amountCents);
    }

    if (nextDate) {
      nextDate.textContent = formatDate(
        next.payoutDate?.payoutAt
      );
    }
  }
}


/* =========================================================
   OVERVIEW
   ========================================================= */

function renderOverview() {
  const memberships = currentMembership
    ? [currentMembership]
    : [];

  const totalSavings = memberships.reduce((sum, membership) => {
    return sum +
      (Number(membership.circle?.amountCents) || 0);
  }, 0);

  const savingsElement = $("#accountTotalSavings");
  const balanceElement = $("#accountAvailableBalance");
  const countElement = $("#dashboardCircleCount");

  if (savingsElement) {
    savingsElement.textContent = money(totalSavings);
  }

  if (balanceElement) {
    balanceElement.textContent = money(totalSavings);
  }

  if (countElement) {
    countElement.textContent = String(memberships.length);
  }

  const nextPayout =
    memberships
      .map(membership => membership.payoutDate?.payoutAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0];

  const nextPayoutElement = $("#dashboardNextPayout");
  const overviewPayoutDate = $("#overviewPayoutDate");
  const overviewPayoutDetails = $("#overviewPayoutDetails");

  if (nextPayout) {
    const formatted = formatDate(nextPayout);

    if (nextPayoutElement) {
      nextPayoutElement.textContent = formatted;
    }

    if (overviewPayoutDate) {
      overviewPayoutDate.textContent = formatted;
    }

    if (overviewPayoutDetails) {
      overviewPayoutDetails.textContent =
        "Your next scheduled PayaCircle payout.";
    }
  }
}


/* =========================================================
   PAYMENT PANEL
   ========================================================= */

async function showPaymentPanel(membership) {
  const panel = $("#paymentPanel");
  const details = $("#paymentDetails");

  if (!panel || !membership) return;

  const circle = membership.circle || currentCircle || {};

  if (details) {
    details.innerHTML = `
      <div class="payment-detail-row">
        <span>Circle</span>
        <strong>${escapeHTML(circle.name || "Savings Circle")}</strong>
      </div>

      <div class="payment-detail-row">
        <span>Contribution</span>
        <strong>${money(circle.amountCents)}</strong>
      </div>

      <div class="payment-detail-row">
        <span>Payout date</span>
        <strong>${escapeHTML(
          formatDate(membership.payoutDate?.payoutAt)
        )}</strong>
      </div>
    `;
  }

  $$(".account-panel").forEach(item => {
    item.style.display = "none";
    item.classList.remove("active");
  });

  panel.style.display = "block";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   PAYPAL
   ========================================================= */

async function startPayPalPayment() {
  if (!currentMembership) {
    showToast("Please choose a savings circle first.", "error");
    return;
  }

  const button = $("#paypalButton");

  setLoading(button, true, "Connecting to PayPal...");

  try {
    const data = await api("/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({
        membershipId: currentMembership.id
      })
    });

    if (data.approvalUrl) {
      window.location.href = data.approvalUrl;
      return;
    }

    if (data.links) {
      const approvalLink = data.links.find(
        link =>
          link.rel === "approve" ||
          link.rel === "payer-action"
      );

      if (approvalLink?.href) {
        window.location.href = approvalLink.href;
        return;
      }
    }

    throw new Error("PayPal approval link was not returned.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

async function handlePayPalReturn() {
  if (paypalReturnHandled) return;

  const params = new URLSearchParams(window.location.search);

  const token =
    params.get("token") ||
    params.get("orderID");

  const payerId =
    params.get("PayerID") ||
    params.get("payerId");

  if (!token && !payerId) return;

  paypalReturnHandled = true;

  try {
    await api("/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({
        orderId: token,
        payerId
      })
    });

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    const panel = $("#paymentPanel");
    const success = $("#paymentSuccess");

    if (panel) panel.style.display = "none";

    if (success) {
      success.style.display = "block";
    }

    await refreshDashboard();

    showToast("Payment confirmed successfully.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}


/* =========================================================
   CREATE CIRCLE
   ========================================================= */

function openCircleModal() {
  const modal = $("#circleModal");

  if (!modal) return;

  modal.style.display = "flex";
  modal.classList.add("open");
}

function closeCircleModal() {
  const modal = $("#circleModal");

  if (!modal) return;

  modal.style.display = "none";
  modal.classList.remove("open");
}

async function createCircle(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#circleMessage");

  const name = $("#circleName")?.value.trim();
  const type = $("#circleType")?.value;
  const amount = Number($("#circleAmount")?.value);
  const capacity = Number($("#circleCapacity")?.value);

  if (!name || !type || !amount || !capacity) {
    if (message) {
      message.textContent = "Please complete all fields.";
      message.className = "form-message error";
    }

    return;
  }

  setLoading(button, true, "Creating circle...");

  try {
    const data = await api("/circles", {
      method: "POST",
      body: JSON.stringify({
        name,
        type,
        amount,
        capacity
      })
    });

    if (message) {
      message.textContent =
        data.message || "Circle created successfully.";
      message.className = "form-message success";
    }

    form.reset();

    setTimeout(() => {
      closeCircleModal();
      loadCirclesPage();
      loadPublicCircles();
    }, 700);
  } catch (error) {
    if (message) {
      message.textContent = error.message;
      message.className = "form-message error";
    }
  } finally {
    setLoading(button, false);
  }
}


/* =========================================================
   CIRCLE FILTERS
   ========================================================= */

function bindCircleFilters() {
  $$(".circle-filter").forEach(button => {
    button.addEventListener("click", async () => {
      $$(".circle-filter").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      const filter = button.dataset.circleFilter;

      await loadCirclesPage();

      if (filter === "all") return;

      const cards = $$("#circlesPageGrid .circle-card");

      cards.forEach(card => {
        const status =
          card.querySelector(".status-badge")?.textContent
            ?.toLowerCase() || "";

        if (filter === "active") {
          card.style.display =
            status.includes("paid") ||
            status.includes("active")
              ? ""
              : "none";
        }

        if (filter === "pending") {
          card.style.display =
            status.includes("pending")
              ? ""
              : "none";
        }
      });
    });
  });
}


/* =========================================================
   PROFILE MENU
   ========================================================= */

function bindProfileMenu() {
  const trigger = $("#accountProfileTrigger");
  const menu = $("#accountProfileMenu");
  const mobileButton = $("#mobileProfileButton");

  function toggleMenu() {
    if (!menu) return;

    menu.style.display =
      menu.style.display === "block"
        ? "none"
        : "block";
  }

  if (trigger) {
    trigger.addEventListener("click", event => {
      event.preventDefault();
      toggleMenu();
    });
  }

  if (mobileButton) {
    mobileButton.addEventListener("click", event => {
      event.preventDefault();
      toggleMenu();
    });
  }

  document.addEventListener("click", event => {
    if (!menu) return;

    if (
      menu.style.display === "block" &&
      !menu.contains(event.target) &&
      event.target !== trigger &&
      event.target !== mobileButton
    ) {
      menu.style.display = "none";
    }
  });
}


/* =========================================================
   LOGOUT BUTTONS
   ========================================================= */

function bindLogoutButtons() {
  [
    "#dashboardLogout",
    "#profileMenuLogout"
  ].forEach(selector => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();
      logout();
    });
  });
}


/* =========================================================
   CREATE CIRCLE BUTTONS
   ========================================================= */

function bindCreateCircleButtons() {
  [
    "#dashboardCreateCircle",
    "#circlesCreateButton"
  ].forEach(selector => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();

      if (!currentUser) {
        openLogin();
        return;
      }

      openCircleModal();
    });
  });
}


/* =========================================================
   MODAL CLOSE BUTTONS
   ========================================================= */

function bindModalButtons() {
  const closeCircle = $("#closeCircleModal");

  if (closeCircle) {
    closeCircle.addEventListener("click", event => {
      event.preventDefault();
      closeCircleModal();
    });
  }

  const closeDetails = $("#closeCircleDetailsModal");

  if (closeDetails) {
    closeDetails.addEventListener("click", event => {
      event.preventDefault();
      closeCircleDetailsModal();
    });
  }

  const circleModal = $("#circleModal");

  if (circleModal) {
    circleModal.addEventListener("click", event => {
      if (event.target === circleModal) {
        closeCircleModal();
      }
    });
  }

  const detailsModal = $("#circleDetailsModal");

  if (detailsModal) {
    detailsModal.addEventListener("click", event => {
      if (event.target === detailsModal) {
        closeCircleDetailsModal();
      }
    });
  }
}


/* =========================================================
   PAYMENT BUTTONS
   ========================================================= */

function bindPaymentButtons() {
  const paypalButton = $("#paypalButton");

  if (paypalButton) {
    paypalButton.addEventListener("click", event => {
      event.preventDefault();
      startPayPalPayment();
    });
  }

  const cancelPayment = $("#cancelPayment");

  if (cancelPayment) {
    cancelPayment.addEventListener("click", event => {
      event.preventDefault();

      const panel = $("#paymentPanel");

      if (panel) {
        panel.style.display = "none";
      }

      activateAccountPanel("circles");
    });
  }
}


/* =========================================================
   PUBLIC NAVIGATION
   ========================================================= */

function bindPublicNavigation() {
  $$(".public-nav a, .footer-links a").forEach(link => {
    link.addEventListener("click", event => {
      const href = link.getAttribute("href");

      if (!href || !href.startsWith("#")) return;

      const target = $(href);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  const publicBrand = $("#publicBrand");

  if (publicBrand) {
    publicBrand.addEventListener("click", event => {
      const href = publicBrand.getAttribute("href");

      if (href === "/") {
        event.preventDefault();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    });
  }

  const accountBrand = $("#accountBrand");

  if (accountBrand) {
    accountBrand.addEventListener("click", event => {
      event.preventDefault();
      activateAccountPanel("overview");
    });
  }
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function bindNotifications() {
  [
    "#accountNotifications",
    "#mobileNotifications"
  ].forEach(selector => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();

      showToast(
        "No new notifications.",
        "info"
      );
    });
  });
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeApp() {
  try {
    bindAuthButtons();
    bindAccountNavigation();
    bindCircleFilters();
    bindProfileMenu();
    bindLogoutButtons();
    bindCreateCircleButtons();
    bindModalButtons();
    bindPaymentButtons();
    bindPublicNavigation();
    bindNotifications();

    const registerForm = $("#registerForm");

    if (registerForm) {
      registerForm.addEventListener("submit", register);
    }

    const loginForm = $("#loginForm");

    if (loginForm) {
      loginForm.addEventListener("submit", login);
    }

    const circleForm = $("#circleForm");

    if (circleForm) {
      circleForm.addEventListener("submit", createCircle);
    }

    await loadCurrentUser();

    if (currentUser) {
      showDashboard();
    } else {
      hideDashboard();
      await loadPublicCircles();
    }

    await handlePayPalReturn();
  } catch (error) {
    console.error("PayaCircle initialization error:", error);

    showToast(
      "PayaCircle loaded, but some features could not initialize.",
      "error"
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}
