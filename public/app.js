const API = "/api";

let currentUser = null;
let currentCircle = null;

/* --------------------------------
   HELPERS
--------------------------------- */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/* --------------------------------
   API
--------------------------------- */

async function api(path, options = {}) {
  const fetchOptions = {
    credentials: "include",
    ...options,
    headers: {
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

/* --------------------------------
   VISIBILITY
--------------------------------- */

function show(element) {
  if (!element) return;

  element.hidden = false;
  element.style.display = "";
}

function hide(element) {
  if (!element) return;

  element.hidden = true;
  element.style.display = "none";
}

/* --------------------------------
   AUTH MODAL
--------------------------------- */

function openAuthModal(mode = "login") {
  const modal = $("#authModal");

  if (!modal) return;

  show(modal);

  if (mode === "register") {
    openRegister();
  } else {
    openLogin();
  }
}

function closeAuthModal() {
  const modal = $("#authModal");

  if (!modal) return;

  hide(modal);
}

function openLogin() {
  const login = $("#loginForm");
  const register = $("#registerForm");
  const title = $("#authModalTitle");

  if (login) show(login);
  if (register) hide(register);

  if (title) {
    title.textContent = "Welcome back";
  }
}

function openRegister() {
  const login = $("#loginForm");
  const register = $("#registerForm");
  const title = $("#authModalTitle");

  if (login) hide(login);
  if (register) show(register);

  if (title) {
    title.textContent = "Create your account";
  }
}

/* --------------------------------
   AUTH BUTTONS
--------------------------------- */

function bindAuthButtons() {
  const signInButtons = [
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

  signInButtons.forEach((selector) => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthModal("login");
    });
  });

  registerButtons.forEach((selector) => {
    const button = $(selector);

    if (!button) return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthModal("register");
    });
  });

  const close = $("#closeAuthModal");

  if (close) {
    close.addEventListener("click", closeAuthModal);
  }

  const switchLogin = $("#switchToLogin");

  if (switchLogin) {
    switchLogin.addEventListener("click", (event) => {
      event.preventDefault();
      openLogin();
    });
  }

  const switchRegister = $("#switchToRegister");

  if (switchRegister) {
    switchRegister.addEventListener("click", (event) => {
      event.preventDefault();
      openRegister();
    });
  }
}

/* --------------------------------
   REGISTER
--------------------------------- */

async function registerUser(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const name =
    form.querySelector('[name="name"]')?.value?.trim() || "";

  const email =
    form.querySelector('[name="email"]')?.value?.trim() || "";

  const password =
    form.querySelector('[name="password"]')?.value || "";

  const message = $("#registerMessage");

  if (!name || !email || !password) {
    if (message) {
      message.textContent = "Please complete all fields.";
    }

    return;
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
        error.message || "Unable to create account.";
    }
  }
}

/* --------------------------------
   LOGIN
--------------------------------- */

async function loginUser(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const email =
    form.querySelector('[name="email"]')?.value?.trim() || "";

  const password =
    form.querySelector('[name="password"]')?.value || "";

  const message = $("#loginMessage");
  const submitButton = form.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (!email || !password) {
    if (message) {
      message.textContent =
        "Please enter your email and password.";
    }

    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.dataset.originalText =
      submitButton.textContent || "";
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

    closeAuthModal();

    await loadAccount();
  } catch (error) {
    if (message) {
      message.textContent =
        error.message || "Unable to sign in.";
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        submitButton.dataset.originalText ||
        "Sign In";
    }
  }
}

/* --------------------------------
   LOGOUT
--------------------------------- */

async function logout() {
  try {
    await api("/logout", {
      method: "POST"
    });
  } catch {
    // Continue logging out locally.
  }

  currentUser = null;
  currentCircle = null;

  showPublicSite();
}

/* --------------------------------
   CURRENT USER
--------------------------------- */

async function getCurrentUser() {
  try {
    return await api("/me");
  } catch {
    return null;
  }
}

/* --------------------------------
   PUBLIC / ACCOUNT VIEWS
--------------------------------- */

function showPublicSite() {
  const publicSite = $("#publicSite");
  const dashboard = $("#accountDashboard");

  if (publicSite) show(publicSite);
  if (dashboard) hide(dashboard);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showAccountDashboard() {
  const publicSite = $("#publicSite");
  const dashboard = $("#accountDashboard");

  if (publicSite) hide(publicSite);
  if (dashboard) show(dashboard);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* --------------------------------
   LOAD ACCOUNT
--------------------------------- */

async function loadAccount() {
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
}

/* --------------------------------
   USER INFORMATION
--------------------------------- */

function renderUserInformation(user) {
  $$("[data-user-name]").forEach((element) => {
    element.textContent = user.name || "Member";
  });

  $$("[data-user-email]").forEach((element) => {
    element.textContent = user.email || "";
  });
}

/* --------------------------------
   BALANCE
--------------------------------- */

function renderAccountBalance(user) {
  const memberships = Array.isArray(user.memberships)
    ? user.memberships
    : [];

  const paid = memberships.filter((membership) =>
    ["PAID", "PAYOUT_SCHEDULED"].includes(
      membership.status
    )
  );

  const total = paid.reduce(
    (sum, membership) =>
      sum + Number(membership.circle?.amountCents || 0),
    0
  );

  $$("[data-account-balance]").forEach((element) => {
    element.textContent = money(total);
  });
}

/* --------------------------------
   MEMBERSHIPS
--------------------------------- */

function renderMemberships(user) {
  const container = $("#membershipsList");

  if (!container) return;

  const memberships = Array.isArray(user.memberships)
    ? user.memberships
    : [];

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">+</div>
        <strong>No circles yet</strong>
        <span>Join a savings circle to get started.</span>
      </div>
    `;

    return;
  }

  container.innerHTML = memberships
    .map((membership) => {
      const circle = membership.circle || {};
      const payoutDate = membership.payoutDate;

      const canCancel =
        circle.status === "COLLECTING" &&
        ![
          "CANCELLED",
          "REFUNDED",
          "PAID_OUT"
        ].includes(membership.status);

      return `
        <article
          class="account-circle-card"
          data-membership-card="${escapeHTML(
            membership.id
          )}"
        >
          <div class="account-circle-main">
            <div>
              <span class="eyebrow">
                ${escapeHTML(circle.type || "Circle")}
              </span>

              <h3>
                ${escapeHTML(
                  circle.name ||
                    circle.code ||
                    "PayaCircle"
                )}
              </h3>

              <p>
                Contribution:
                <strong>
                  ${money(circle.amountCents)}
                </strong>
              </p>

              <p>
                Payout date:
                <strong>
                  ${
                    payoutDate
                      ? formatDate(payoutDate.payoutAt)
                      : "Not selected"
                  }
                </strong>
              </p>
            </div>

            <div class="account-circle-status">
              <span class="status-badge status-${escapeHTML(
                String(membership.status || "").toLowerCase()
              )}">
                ${escapeHTML(
                  prettyStatus(membership.status)
                )}
              </span>

              <span class="status-badge">
                ${escapeHTML(
                  prettyStatus(circle.status)
                )}
              </span>
            </div>
          </div>

          <div class="account-circle-actions">
            <button
              type="button"
              class="secondary circle-view-button"
              data-circle-id="${escapeHTML(
                circle.id || ""
              )}"
            >
              View Circle
            </button>

            ${
              canCancel
                ? `
                  <button
                    type="button"
                    class="danger-outline cancel-membership-button"
                    data-membership-id="${escapeHTML(
                      membership.id
                    )}"
                  >
                    Cancel Membership
                  </button>
                `
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  $$(".circle-view-button").forEach((button) => {
    button.addEventListener("click", () => {
      openCircleDetails(button.dataset.circleId);
    });
  });

  $$(".cancel-membership-button").forEach((button) => {
    button.addEventListener("click", () => {
      confirmCancellation(
        button.dataset.membershipId
      );
    });
  });
}

/* --------------------------------
   STATUS
--------------------------------- */

function prettyStatus(value) {
  if (!value) return "Unknown";

  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* --------------------------------
   CANCELLATION
--------------------------------- */

function confirmCancellation(membershipId) {
  if (!membershipId) return;

  const memberships =
    currentUser?.memberships || [];

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

  const button = Array.from(
    document.querySelectorAll(
      ".cancel-membership-button"
    )
  ).find(
    (element) =>
      element.dataset.membershipId === membershipId
  );

  if (button) {
    button.disabled = true;
    button.textContent = "Cancelling...";
  }

  try {
    const result = await api(
      `/memberships/${encodeURIComponent(
        membershipId
      )}/cancel`,
      {
        method: "POST"
      }
    );

    alert(
      result.message ||
        "Your membership has been cancelled."
    );

    currentUser = await getCurrentUser();

    if (!currentUser) {
      showPublicSite();
      return;
    }

    renderUserInformation(currentUser);
    renderMemberships(currentUser);
    renderAccountBalance(currentUser);
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

/* --------------------------------
   PUBLIC CIRCLES
--------------------------------- */

async function loadPublicCircles() {
  const container = $("#publicCircles");

  if (!container) return;

  try {
    const circles = await api("/circles");

    if (!Array.isArray(circles) || !circles.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No circles available</strong>
          <span>New savings circles will appear here.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = circles
      .map(
        (circle) => `
          <article class="public-circle-card">
            <span class="eyebrow">
              ${escapeHTML(circle.type || "CUSTOM")}
            </span>

            <h3>
              ${escapeHTML(
                circle.name ||
                  circle.code ||
                  "PayaCircle"
              )}
            </h3>

            <p>
              Contribution:
              <strong>
                ${money(circle.amountCents)}
              </strong>
            </p>

            <p>
              Members:
              <strong>
                ${
                  circle._count?.memberships || 0
                } / ${circle.capacity}
              </strong>
            </p>

            <button
              type="button"
              class="primary full-width public-circle-button"
              data-circle-id="${escapeHTML(
                circle.id
              )}"
            >
              View Circle
            </button>
          </article>
        `
      )
      .join("");

    $$(".public-circle-button").forEach((button) => {
      button.addEventListener("click", () => {
        openCircleDetails(
          button.dataset.circleId
        );
      });
    });
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Unable to load circles</strong>
        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

/* --------------------------------
   CIRCLE DETAILS
--------------------------------- */

async function openCircleDetails(circleId) {
  if (!circleId) return;

  const modal = $("#circleDetailsModal");
  const content = $("#circleDetailsContent");

  if (!modal || !content) return;

  show(modal);

  content.innerHTML = `
    <div class="loading-state">
      Loading circle...
    </div>
  `;

  try {
    const data = await api(
      `/circles/${encodeURIComponent(circleId)}`
    );

    const circle = data.circle || data;

    if (!circle || !circle.id) {
      throw new Error("Circle could not be found.");
    }

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
      <div class="circle-detail">
        <span class="eyebrow">
          ${escapeHTML(circle.type || "CUSTOM")}
        </span>

        <h2>
          ${escapeHTML(
            circle.name ||
              circle.code ||
              "PayaCircle"
          )}
        </h2>

        <p>
          Contribution:
          <strong>
            ${money(circle.amountCents)}
          </strong>
        </p>

        <p>
          Members:
          <strong>
            ${
              circle._count?.memberships || 0
            } / ${circle.capacity}
          </strong>
        </p>

        <p>
          Status:
          <strong>
            ${escapeHTML(
              prettyStatus(circle.status)
            )}
          </strong>
        </p>

        ${
          dates.length
            ? `
              <div class="circle-date-list">
                <h3>
                  Available payout dates
                </h3>

                ${dates
                  .map(
                    (date) => `
                      <label class="payout-date-option">
                        <input
                          type="radio"
                          name="payoutDate"
                          value="${escapeHTML(
                            date.id
                          )}"
                        />

                        <span>
                          ${escapeHTML(
                            formatDate(
                              date.payoutAt
                            )
                          )}
                        </span>

                        <small>
                          ${
                            date.reserved || 0
                          } /
                          ${
                            date.capacity || 1
                          }
                          reserved
                        </small>
                      </label>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="empty-state">
                <strong>
                  No payout dates available yet
                </strong>

                <span>
                  Please check again later.
                </span>
              </div>
            `
        }

        <div class="circle-detail-actions">
          ${
            currentUser
              ? `
                <button
                  type="button"
                  class="primary"
                  id="joinCircleButton"
                >
                  Join This Circle
                </button>
              `
              : `
                <button
                  type="button"
                  class="primary"
                  id="circleSignInButton"
                >
                  Sign In to Join
                </button>
              `
          }
        </div>
      </div>
    `;

    const joinButton = $("#joinCircleButton");

    if (joinButton) {
      joinButton.addEventListener(
        "click",
        reserveMembership
      );
    }

    const signInButton =
      $("#circleSignInButton");

    if (signInButton) {
      signInButton.addEventListener(
        "click",
        () => {
          closeCircleDetails();
          openAuthModal("login");
        }
      );
    }
  } catch (error) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>

        <strong>
          Unable to open circle
        </strong>

        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

/* --------------------------------
   CLOSE CIRCLE
--------------------------------- */

function closeCircleDetails() {
  const modal = $("#circleDetailsModal");

  if (modal) {
    hide(modal);
  }
}

/* --------------------------------
   RESERVE MEMBERSHIP
--------------------------------- */

async function reserveMembership() {
  if (!currentUser) {
    closeCircleDetails();
    openAuthModal("login");
    return;
  }

  if (!currentCircle) return;

  const selected = document.querySelector(
    'input[name="payoutDate"]:checked'
  );

  if (!selected) {
    alert("Please select a payout date.");
    return;
  }

  const button = $("#joinCircleButton");

  if (button) {
    button.disabled = true;
    button.textContent = "Joining...";
  }

  try {
    await api("/memberships", {
      method: "POST",
      body: JSON.stringify({
        circleId: currentCircle.id,
        payoutDateId: selected.value
      })
    });

    alert(
      "Your circle membership has been reserved."
    );

    closeCircleDetails();

    await loadAccount();
  } catch (error) {
    alert(
      error.message ||
        "Unable to join this circle."
    );

    if (button) {
      button.disabled = false;
      button.textContent = "Join This Circle";
    }
  }
}

/* --------------------------------
   PAYMENTS
--------------------------------- */

async function loadPayments() {
  const container = $("#paymentsList");

  if (!container) return;

  try {
    const payments = await api("/payments");

    if (!Array.isArray(payments) || !payments.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No payments yet</strong>
          <span>
            Your PayaCircle payments will appear here.
          </span>
        </div>
      `;
      return;
    }

    container.innerHTML = payments
      .map(
        (payment) => `
          <article class="transaction-row">
            <div>
              <strong>
                ${escapeHTML(
                  payment.circle?.name ||
                    payment.circle?.code ||
                    "PayaCircle"
                )}
              </strong>

              <span>
                ${formatDateTime(payment.createdAt)}
              </span>
            </div>

            <strong>
              ${money(payment.amountCents)}
            </strong>

            <span class="status-badge">
              ${escapeHTML(
                prettyStatus(payment.status)
              )}
            </span>
          </article>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>
          Unable to load payments
        </strong>

        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

/* --------------------------------
   PAYOUTS
--------------------------------- */

async function loadPayouts() {
  const container = $("#payoutsList");

  if (!container) return;

  try {
    const payouts = await api("/payouts");

    if (!Array.isArray(payouts) || !payouts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No payouts yet</strong>
          <span>
            Your scheduled and completed payouts will appear here.
          </span>
        </div>
      `;
      return;
    }

    container.innerHTML = payouts
      .map(
        (payout) => `
          <article class="transaction-row">
            <div>
              <strong>
                ${escapeHTML(
                  payout.circle?.name ||
                    payout.circle?.code ||
                    "PayaCircle"
                )}
              </strong>

              <span>
                ${
                  payout.payoutDate
                    ? formatDate(
                        payout.payoutDate.payoutAt
                      )
                    : "Date pending"
                }
              </span>
            </div>

            <strong>
              ${money(payout.amountCents)}
            </strong>

            <span class="status-badge">
              ${escapeHTML(
                prettyStatus(payout.status)
              )}
            </span>
          </article>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>
          Unable to load payouts
        </strong>

        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

/* --------------------------------
   ACCOUNT NAVIGATION
--------------------------------- */

function activateAccountPanel(panelName) {
  $$("[data-account-panel]").forEach((panel) => {
    const target = panel.dataset.accountPanel;

    if (target === panelName) {
      show(panel);
    } else {
      hide(panel);
    }
  });

  $$("[data-account-nav]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.accountNav === panelName
    );
  });
}

function bindAccountNavigation() {
  $$("[data-account-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      activateAccountPanel(
        button.dataset.accountNav
      );
    });
  });
}

/* --------------------------------
   PROFILE MENU
--------------------------------- */

function bindProfileMenu() {
  const button = $("#profileMenuButton");
  const menu = $("#profileMenu");

  if (!button || !menu) return;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", () => {
    menu.hidden = true;
  });
}

/* --------------------------------
   LOGOUT BUTTONS
--------------------------------- */

function bindLogoutButtons() {
  $$("[data-logout]").forEach((button) => {
    button.addEventListener("click", logout);
  });

  const logoutButton = $("#logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
}

/* --------------------------------
   MODALS
--------------------------------- */

function bindModalButtons() {
  const closeCircle =
    $("#closeCircleDetailsModal");

  if (closeCircle) {
    closeCircle.addEventListener(
      "click",
      closeCircleDetails
    );
  }

  const authModal = $("#authModal");

  if (authModal) {
    authModal.addEventListener(
      "click",
      (event) => {
        if (event.target === authModal) {
          closeAuthModal();
        }
      }
    );
  }

  const circleModal =
    $("#circleDetailsModal");

  if (circleModal) {
    circleModal.addEventListener(
      "click",
      (event) => {
        if (event.target === circleModal) {
          closeCircleDetails();
        }
      }
    );
  }
}

/* --------------------------------
   FORMS
--------------------------------- */

function bindForms() {
  const loginForm = $("#loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      loginUser
    );
  }

  const registerForm =
    $("#registerForm");

  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      registerUser
    );
  }
}

/* --------------------------------
   PUBLIC NAVIGATION
--------------------------------- */

function bindPublicNavigation() {
  $$("[data-scroll-to]").forEach((button) => {
    button.addEventListener("click", () => {
      const selector = button.dataset.scrollTo;

      if (!selector) return;

      const target =
        document.querySelector(selector);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  });
}

/* --------------------------------
   PAYPAL
--------------------------------- */

async function createPayPalOrder(
  circleId,
  membershipId
) {
  return api("/paypal/create-order", {
    method: "POST",
    body: JSON.stringify({
      circleId,
      membershipId
    })
  });
}

async function capturePayPalOrder(orderId) {
  return api("/paypal/capture-order", {
    method: "POST",
    body: JSON.stringify({
      orderId
    })
  });
}

/* --------------------------------
   INITIALIZATION
--------------------------------- */

async function initialize() {
  /*
     Bind all interactive controls FIRST.
     This ensures login/register continue
     working even if public circle loading
     encounters a network problem.
  */

  bindAuthButtons();
  bindAccountNavigation();
  bindProfileMenu();
  bindLogoutButtons();
  bindModalButtons();
  bindForms();
  bindPublicNavigation();

  /*
     Public circles are secondary.
     Do not allow them to block login.
  */

  loadPublicCircles().catch((error) => {
    console.error(
      "Public circle loading error:",
      error
    );
  });

  /*
     Check the current session separately.
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

/* --------------------------------
   START
--------------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    initialize().catch((error) => {
      console.error(
        "PayaCircle initialization error:",
        error
      );

      /*
         Keep the public site visible if
         session checking fails.
      */

      showPublicSite();
    });
  }
);
