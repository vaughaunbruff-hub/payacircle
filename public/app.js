const API = "/api";

let currentUser = null;
let selectedCircle = null;
let selectedMembership = null;

/* =========================
   BASIC HELPERS
========================= */

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/* =========================
   API
========================= */

async function api(path, options = {}) {
  const fetchOptions = {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };

  const response = await fetch(`${API}${path}`, fetchOptions);

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

/* =========================
   VISIBILITY
========================= */

function show(element) {
  if (element) {
    element.style.display = "";
  }
}

function hide(element) {
  if (element) {
    element.style.display = "none";
  }
}

function showPublicSite() {
  hide($("#dashboard"));
  show($("#publicSite"));
  closeProfileMenu();
}

function showAccountDashboard() {
  hide($("#publicSite"));
  show($("#dashboard"));
}

/* =========================
   AUTH MODAL
========================= */

function openAuthModal(mode = "register") {
  const modal = $("#authModal");

  if (!modal) return;

  show(modal);
  switchAuthMode(mode);
}

function closeAuthModal() {
  hide($("#authModal"));
}

function switchAuthMode(mode) {
  const registerForm = $("#registerForm");
  const loginForm = $("#loginForm");
  const registerTab = $("#registerTab");
  const loginTab = $("#loginTab");
  const title = $("#authModalTitle");

  if (mode === "login") {
    hide(registerForm);
    show(loginForm);

    if (registerTab) registerTab.classList.remove("active");
    if (loginTab) loginTab.classList.add("active");

    if (title) {
      title.textContent = "Sign in to PayaCircle";
    }
  } else {
    show(registerForm);
    hide(loginForm);

    if (registerTab) registerTab.classList.add("active");
    if (loginTab) loginTab.classList.remove("active");

    if (title) {
      title.textContent = "Create your PayaCircle account";
    }
  }

  const registerMessage = $("#registerMessage");
  const loginMessage = $("#loginMessage");

  if (registerMessage) registerMessage.textContent = "";
  if (loginMessage) loginMessage.textContent = "";
}

/* =========================
   AUTH BUTTONS
========================= */

function bindAuthButtons() {
  const buttons = [
    ["#headerSignIn", "login"],
    ["#headerGetStarted", "register"],
    ["#heroGetStarted", "register"],
    ["#heroSignIn", "login"],
    ["#promoGetStarted", "register"],
    ["#finalGetStarted", "register"],
    ["#footerSignIn", "login"]
  ];

  buttons.forEach(([selector, mode]) => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthModal(mode);
    });
  });

  const registerTab = $("#registerTab");

  if (registerTab) {
    registerTab.addEventListener("click", (event) => {
      event.preventDefault();
      switchAuthMode("register");
    });
  }

  const loginTab = $("#loginTab");

  if (loginTab) {
    loginTab.addEventListener("click", (event) => {
      event.preventDefault();
      switchAuthMode("login");
    });
  }

  const closeButton = $("#closeAuthModal");

  if (closeButton) {
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      closeAuthModal();
    });
  }
}

/* =========================
   REGISTER
========================= */

async function registerUser(event) {
  event.preventDefault();

  const nameInput = $("#registerName");
  const emailInput = $("#registerEmail");
  const passwordInput = $("#registerPassword");

  const message = $("#registerMessage");
  const submitButton =
    event.currentTarget.querySelector('button[type="submit"]');

  const name = nameInput?.value?.trim() || "";
  const email = emailInput?.value?.trim() || "";
  const password = passwordInput?.value || "";

  if (!name || !email || !password) {
    if (message) {
      message.textContent =
        "Please enter your name, email, and password.";
    }
    return;
  }

  if (password.length < 6) {
    if (message) {
      message.textContent =
        "Password must be at least 6 characters.";
    }
    return;
  }

  if (message) {
    message.textContent = "";
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";
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

    currentUser = data;

    closeAuthModal();

    await loadAccount();

  } catch (error) {
    if (message) {
      message.textContent =
        error.message || "Unable to create your account.";
    }
    } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Create Account";
    }
  }
}

/* =========================
   LOGIN
========================= */
/* =========================
   LOGIN
========================= */

async function loginUser(event) {
  event.preventDefault();

  const emailInput = $("#loginEmail");
  const passwordInput = $("#loginPassword");
  const message = $("#loginMessage");
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');

  const email = emailInput?.value?.trim() || "";
  const password = passwordInput?.value || "";

  if (!email || !password) {
    if (message) {
      message.textContent = "Please enter your email and password.";
    }
    return;
  }

  if (message) {
    message.textContent = "";
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";
  }

  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    currentUser = data;

    if (message) {
      message.textContent = "";
    }

    closeAuthModal();
    await loadAccount();

  } catch (error) {
    if (message) {
      message.textContent =
        error.message || "Unable to sign in.";
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Sign In";
    }
  }
}
/* =========================
   CURRENT USER
========================= */

async function getCurrentUser() {
  try {
    const data = await api("/me");

    return data.user || data;
  } catch {
    return null;
  }
}

/* =========================
   ACCOUNT
========================= */

async function loadAccount() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      currentUser = null;
      showPublicSite();
      return;
    }

    currentUser = user;

    showAccountDashboard();

    renderUserInformation(user);
    renderMemberships(user);
    renderAccountBalance(user);

    await Promise.allSettled([
      loadPayments(),
      loadPayouts()
    ]);

    activateAccountPanel("overview");
  } catch (error) {
    console.error("Account loading error:", error);
    showPublicSite();
  }
}

function renderUserInformation(user) {
  const name =
    user.name ||
    user.fullName ||
    user.firstName ||
    "Member";

  const email =
    user.email ||
    "";

  const nameElements = [
    "#dashboardUserName",
    "#profileMenuName"
  ];

  nameElements.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent = name;
    }
  });

  const emailElements = [
    "#dashboardUserEmail",
    "#profileMenuEmail"
  ];

  emailElements.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent = email;
    }
  });
}
/* =========================
   PROFILE MENU
========================= */

function openProfileMenu() {
  const menu = $("#accountProfileMenu");

  if (!menu) return;

  menu.style.display = "block";
  menu.classList.add("open");

  const profileButton = $("#accountProfileTrigger");

  if (profileButton) {
    profileButton.setAttribute("aria-expanded", "true");
  }
}

function closeProfileMenu() {
  const menu = $("#accountProfileMenu");

  if (menu) {
    menu.style.display = "none";
    menu.classList.remove("open");
  }

  const profileButton = $("#accountProfileTrigger");

  if (profileButton) {
    profileButton.setAttribute("aria-expanded", "false");
  }
}

function toggleProfileMenu(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const menu = $("#accountProfileMenu");

  if (!menu) return;

  const isOpen =
    menu.style.display === "block" ||
    menu.classList.contains("open");

  if (isOpen) {
    closeProfileMenu();
  } else {
    openProfileMenu();
  }
}

function bindProfileMenu() {
  const profileButton = $("#accountProfileTrigger");
  const mobileProfileButton = $("#mobileProfileButton");

  if (profileButton) {
    profileButton.addEventListener("click", toggleProfileMenu);
    profileButton.setAttribute("aria-expanded", "false");
  }

  if (mobileProfileButton) {
    mobileProfileButton.addEventListener("click", toggleProfileMenu);
  }

  document.addEventListener("click", (event) => {
    const menu = $("#accountProfileMenu");

    if (!menu || menu.style.display !== "block") {
      return;
    }

    const clickedInsideMenu = menu.contains(event.target);

    const clickedProfileButton =
      profileButton &&
      (
        profileButton === event.target ||
        profileButton.contains(event.target)
      );

    const clickedMobileButton =
      mobileProfileButton &&
      (
        mobileProfileButton === event.target ||
        mobileProfileButton.contains(event.target)
      );

    if (
      !clickedInsideMenu &&
      !clickedProfileButton &&
      !clickedMobileButton
    ) {
      closeProfileMenu();
    }
  });
}
/* =========================
   LOGOUT
========================= */

async function logoutUser(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  try {
    await api("/logout", {
      method: "POST"
    });
  } catch (error) {
    console.warn("Logout request:", error);
  }

  currentUser = null;
  selectedCircle = null;
  selectedMembership = null;

  closeProfileMenu();
  showPublicSite();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function bindLogoutButtons() {
  const logoutButtons = [];

  [
    "#dashboardLogout",
    "#profileMenuLogout",
    "#logoutButton",
    "[data-logout]"
  ].forEach((selector) => {
    $$(selector).forEach((button) => {
      if (!logoutButtons.includes(button)) {
        logoutButtons.push(button);
      }
    });
  });

  logoutButtons.forEach((button) => {
    button.addEventListener("click", logoutUser);
  });
}

/* =========================
   ACCOUNT NAVIGATION
========================= */

function activateAccountPanel(panelName) {
  if (!panelName) {
    panelName = "overview";
  }

  $$("[data-panel]").forEach((panel) => {
    if (panel.dataset.panel === panelName) {
      show(panel);
    } else {
      hide(panel);
    }
  });

  $$("[data-account-panel]").forEach((button) => {
    if (button.dataset.accountPanel === panelName) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });

  closeProfileMenu();
}

function bindAccountNavigation() {
  $$("[data-account-panel]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const panel =
        button.dataset.accountPanel ||
        "overview";

      activateAccountPanel(panel);
    });
  });
}

/* =========================
   MEMBERSHIPS
========================= */

function renderMemberships(user) {
  const container =
    $("#membershipsList") ||
    $("#accountMemberships") ||
    $("#circleMemberships");

  if (!container) return;

  const memberships = Array.isArray(user.memberships)
    ? user.memberships
    : [];

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No memberships yet</h3>
        <p>Join a PayaCircle to see your membership here.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = memberships
    .map((membership) => {
      const circle = membership.circle || {};

      const name =
        circle.name ||
        circle.code ||
        "PayaCircle";

      const status =
        membership.status ||
        "ACTIVE";

      const contribution =
        membership.contribution ||
        membership.amount ||
        circle.contribution ||
        0;

      const canCancel =
        circle.status === "COLLECTING" &&
        status !== "CANCELLED" &&
        status !== "REFUNDED";

      return `
        <div class="membership-card">
          <div class="membership-card-main">
            <h3>${escapeHTML(name)}</h3>

            <p>
              Status:
              <strong>${escapeHTML(status)}</strong>
            </p>

            <p>
              Contribution:
              <strong>${money(contribution)}</strong>
            </p>

            <div class="membership-actions">
              ${
                circle.id
                  ? `
                    <button
                      type="button"
                      class="view-circle-button"
                      data-circle-id="${escapeHTML(circle.id)}"
                    >
                      View Circle
                    </button>
                  `
                  : ""
              }

              ${
                canCancel
                  ? `
                    <button
                      type="button"
                      class="cancel-membership-button"
                      data-membership-id="${escapeHTML(membership.id)}"
                    >
                      Cancel Membership
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  $$(".view-circle-button").forEach((button) => {
    button.addEventListener("click", () => {
      const circleId = button.dataset.circleId;

      if (circleId) {
        openCircleDetails(circleId);
      }
    });
  });

  $$(".cancel-membership-button").forEach((button) => {
    button.addEventListener("click", () => {
      confirmCancellation(button.dataset.membershipId);
    });
  });
}

/* =========================
   CANCELLATION
========================= */

function confirmCancellation(membershipId) {
  if (!membershipId) return;

  const memberships = currentUser?.memberships || [];

  const membership = memberships.find(
    (item) => item.id === membershipId
  );

  if (!membership) {
    alert("Membership could not be found.");
    return;
  }

  const circle = membership.circle || {};

  if (circle.status !== "COLLECTING") {
    alert(
      "This circle has already started and can no longer be cancelled."
    );

    return;
  }

  const circleName =
    circle.name ||
    circle.code ||
    "this circle";

  const confirmed = window.confirm(
    `Cancel your membership in "${circleName}"?\n\nYour reserved payout-date spot will be released.`
  );

  if (!confirmed) return;

  cancelMembership(membershipId);
}

async function cancelMembership(membershipId) {
  if (!membershipId) return;

  const button = $$(".cancel-membership-button").find(
    (element) =>
      element.dataset.membershipId === membershipId
  );

  if (button) {
    button.disabled = true;
    button.textContent = "Cancelling...";
  }

  try {
    const result = await api(
      `/memberships/${encodeURIComponent(membershipId)}/cancel`,
      {
        method: "POST"
      }
    );

    alert(
      result.message ||
      "Your membership has been cancelled."
    );

    await loadAccount();
  } catch (error) {
    alert(
      error.message ||
      "Unable to cancel membership."
    );

    if (button) {
      button.disabled = false;
      button.textContent = "Cancel Membership";
    }
  }
}

/* =========================
   ACCOUNT BALANCE
========================= */

function renderAccountBalance(user) {
  const balance =
    user.balance ??
    user.accountBalance ??
    0;

  const elements = [
    "#accountBalance",
    "#dashboardBalance",
    "#availableBalance"
  ];

  elements.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent = money(balance);
    }
  });
}

/* =========================
   PAYMENTS
========================= */

async function loadPayments() {
  try {
    const data = await api("/payments");

    const payments =
      Array.isArray(data)
        ? data
        : Array.isArray(data.payments)
          ? data.payments
          : [];

    const container =
      $("#paymentsList") ||
      $("#contributionsList");

    if (!container) return;

    if (!payments.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No payments yet</h3>
          <p>Your contribution payments will appear here.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = payments
      .map(
        (payment) => `
          <div class="payment-row">
            <div>
              <strong>${money(
                payment.amount || 0
              )}</strong>
              <small>
                ${formatDateTime(
                  payment.createdAt ||
                  payment.created_at
                )}
              </small>
            </div>

            <span>
              ${escapeHTML(
                payment.status || "—"
              )}
            </span>
          </div>
        `
      )
      .join("");
  } catch (error) {
    console.warn("Payments unavailable:", error);
  }
}

/* =========================
   PAYOUTS
========================= */

async function loadPayouts() {
  try {
    const data = await api("/payouts");

    const payouts =
      Array.isArray(data)
        ? data
        : Array.isArray(data.payouts)
          ? data.payouts
          : [];

    const container = $("#payoutsList");

    if (!container) return;

    if (!payouts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No payouts yet</h3>
          <p>Your payout information will appear here.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = payouts
      .map(
        (payout) => `
          <div class="payout-row">
            <div>
              <strong>${money(
                payout.amount || 0
              )}</strong>

              <small>
                ${formatDate(
                  payout.date ||
                  payout.payoutDate ||
                  payout.createdAt
                )}
              </small>
            </div>

            <span>
              ${escapeHTML(
                payout.status || "—"
              )}
            </span>
          </div>
        `
      )
      .join("");
  } catch (error) {
    console.warn("Payouts unavailable:", error);
  }
}

/* =========================
   PUBLIC CIRCLES
========================= */

async function loadPublicCircles() {
  const container = $("#publicCircles");

  if (!container) return;

  try {
    const data = await api("/circles");

    const circles =
      Array.isArray(data)
        ? data
        : Array.isArray(data.circles)
          ? data.circles
          : [];

    if (!circles.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No circles available</h3>
          <p>New PayaCircles will appear here when available.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = circles
      .map(
        (circle) => `
          <div class="circle-card">
            <h3>${escapeHTML(
              circle.name ||
              circle.code ||
              "PayaCircle"
            )}</h3>

            <p>
              ${escapeHTML(
                circle.type ||
                "Community"
              )}
            </p>

            <p>
              Contribution:
              <strong>
                ${money(
                  circle.contribution ||
                  circle.amount ||
                  0
                )}
              </strong>
            </p>

            <button
              type="button"
              class="public-circle-button"
              data-circle-id="${escapeHTML(circle.id)}"
            >
              View Circle
            </button>
          </div>
        `
      )
      .join("");

    $$(".public-circle-button").forEach((button) => {
      button.addEventListener("click", () => {
        const circleId = button.dataset.circleId;

        if (circleId) {
          openCircleDetails(circleId);
        }
      });
    });
  } catch (error) {
    console.warn("Public circles unavailable:", error);
  }
}

/* =========================
   CIRCLE DETAILS
========================= */

async function openCircleDetails(circleId) {
  if (!circleId) return;

  try {
    const circle = await api(
      `/circles/${encodeURIComponent(circleId)}`
    );

    if (!circle || !circle.id) {
      throw new Error("Circle not found.");
    }

    selectedCircle = circle;

    const modal = $("#circleDetailsModal");
    const content = $("#circleDetailsContent");

    if (!modal || !content) {
      return;
    }

    content.innerHTML = `
      <div class="circle-details">
        <h2>
          ${escapeHTML(
            circle.name ||
            circle.code ||
            "PayaCircle"
          )}
        </h2>

        <p>
          Type:
          ${escapeHTML(
            circle.type ||
            "Community"
          )}
        </p>

        <p>
          Contribution:
          <strong>
            ${money(
              circle.contribution ||
              circle.amount ||
              0
            )}
          </strong>
        </p>

        <p>
          Status:
          <strong>
            ${escapeHTML(
              circle.status ||
              "—"
            )}
          </strong>
        </p>

        <button
          type="button"
          id="joinSelectedCircle"
        >
          Join This Circle
        </button>
      </div>
    `;

    show(modal);

    const joinButton =
      $("#joinSelectedCircle");

    if (joinButton) {
      joinButton.addEventListener(
        "click",
        () => {
          closeCircleDetails();
          openCircleForm(circle);
        }
      );
    }
  } catch (error) {
    alert(
      error.message ||
      "Unable to open this circle."
    );
  }
}

function closeCircleDetails() {
  hide($("#circleDetailsModal"));
}

function openCircleForm(circle) {
  selectedCircle = circle;

  const modal = $("#circleModal");

  if (!modal) return;

  show(modal);

  const form = $("#circleForm");

  if (form) {
    const circleIdInput =
      form.querySelector('[name="circleId"]');

    if (circleIdInput) {
      circleIdInput.value =
        circle.id || "";
    }
  }
}

function openCircleModal() {
  const modal = $("#circleModal");

  if (!modal) {
    console.error("Circle modal not found: #circleModal");
    return;
  }

  show(modal);
}

function closeCircleModal() {
  hide($("#circleModal"));
}

/* =========================
   CIRCLE FORM
========================= */

async function submitCircleMembership(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const circleId =
    form.querySelector('[name="circleId"]')?.value ||
    selectedCircle?.id;

  if (!circleId) {
    alert("Circle could not be identified.");
    return;
  }

  const button =
    form.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = true;
    button.textContent = "Joining...";
  }

  try {
    const data = await api(
      `/circles/${encodeURIComponent(circleId)}/join`,
      {
        method: "POST"
      }
    );

    alert(
      data.message ||
      "Membership created successfully."
    );

    closeCircleModal();

    await loadAccount();
  } catch (error) {
    alert(
      error.message ||
      "Unable to join this circle."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Join Circle";
    }
  }
}

/* =========================
   MODALS
========================= */
function bindModalButtons() {
  const closeCircle =
    $("#closeCircleModal");

  if (closeCircle) {
    closeCircle.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        closeCircleModal();
      }
    );
  }

  const closeCircleDetailsButton =
    $("#closeCircleDetailsModal");

  if (closeCircleDetailsButton) {
    closeCircleDetailsButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        closeCircleDetails();
      }
    );
  }

  const dashboardCreateCircle =
    $("#dashboardCreateCircle");

  if (dashboardCreateCircle) {
    dashboardCreateCircle.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        openCircleModal();
      }
    );
  }

  const circlesCreateButton =
    $("#circlesCreateButton");

  if (circlesCreateButton) {
    circlesCreateButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        openCircleModal();
      }
    );
  }

  const circleForm = $("#circleForm");

  if (circleForm) {
    circleForm.addEventListener(
      "submit",
      submitCircleMembership
    );
  }
}

/* =========================
   PUBLIC NAVIGATION
========================= */

function bindPublicNavigation() {
  $$("[data-scroll-to]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const target =
        button.dataset.scrollTo;

      if (!target) return;

      const element =
        document.querySelector(target);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  });
}

/* =========================
   FORMS
========================= */

function bindForms() {
  const loginForm = $("#loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      loginUser
    );
  }

  const registerForm = $("#registerForm");

  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      registerUser
    );
  }
}

/* =========================
   INITIALIZATION
========================= */

async function initialize() {
  /*
    Bind all buttons FIRST.
    This prevents public-circle loading
    or another API request from stopping
    the profile/sign-in controls.
  */

  bindAuthButtons();
  bindAccountNavigation();
  bindProfileMenu();
  bindLogoutButtons();
  bindModalButtons();
  bindForms();
  bindPublicNavigation();

  /*
    Load public circles without blocking
    the rest of the application.
  */

  loadPublicCircles().catch((error) => {
    console.warn(
      "Public circle loading error:",
      error
    );
  });

  /*
    Check whether the browser already has
    a valid PayaCircle login session.
  */

  const user = await getCurrentUser();

  if (user) {
    currentUser = user;

    showAccountDashboard();
    renderUserInformation(user);
    renderMemberships(user);
    renderAccountBalance(user);

    await Promise.allSettled([
      loadPayments(),
      loadPayouts()
    ]);

    activateAccountPanel("overview");
  } else {
    showPublicSite();
  }
}

/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    initialize().catch((error) => {
      console.error(
        "PayaCircle initialization error:",
        error
      );

      showPublicSite();
    });
  }
);
