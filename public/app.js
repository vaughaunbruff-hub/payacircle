const API = "/api";

let currentUser = null;
let currentCircle = null;

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

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

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

function show(element) {
  if (!element) return;

  element.hidden = false;
  element.style.display = "";
  element.classList.remove("hidden");
}

function hide(element) {
  if (!element) return;

  element.hidden = true;
  element.style.display = "none";
}

function showPublicSite() {
  const publicSite = $("#publicSite");
  const accountSite = $("#accountSite");

  show(publicSite);
  hide(accountSite);
}

function switchAuthMode(mode) {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  const loginTab = $("#loginTab");
  const registerTab = $("#registerTab");

  const title = $("#authModalTitle");

  const loginMessage = $("#loginMessage");
  const registerMessage = $("#registerMessage");

  const normalizedMode =
    String(mode).toLowerCase() === "register"
      ? "register"
      : "login";

  if (normalizedMode === "login") {
    if (loginForm) {
      loginForm.style.display = "";
      loginForm.hidden = false;
    }

    if (registerForm) {
      registerForm.style.display = "none";
      registerForm.hidden = true;
    }

    if (loginTab) {
      loginTab.classList.add("active");
      loginTab.setAttribute("aria-selected", "true");
    }

    if (registerTab) {
      registerTab.classList.remove("active");
      registerTab.setAttribute("aria-selected", "false");
    }

    if (title) {
      title.textContent = "Sign in to your account";
    }

    if (loginMessage) {
      loginMessage.textContent = "";
    }
  } else {
    if (registerForm) {
      registerForm.style.display = "";
      registerForm.hidden = false;
    }

   
  const publicSite = $("#publicSite");
  const accountSite = $("#accountSite");

  hide(publicSite);
  show(accountSite);
}

function openAuthModal(mode = "login") {
  const modal = $("#authModal");

  if (!modal) {
    console.error("PayaCircle: authModal was not found.");
    return;
  }

  show(modal);

  switchAuthMode(mode);
}

function closeAuthModal() {
  const modal = $("#authModal");

  if (modal) {
    hide(modal);
  }
}

function switchAuthMode(mode) {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  const loginTab = $("#loginTab");
  const registerTab = $("#registerTab");

  const title = $("#authModalTitle");

  const loginMessage = $("#loginMessage");
  const registerMessage = $("#registerMessage");

  const normalizedMode =
    String(mode).toLowerCase() === "register"
      ? "register"
      : "login";

  if (normalizedMode === "login") {
    if (loginForm) {
      loginForm.style.display = "";
      loginForm.hidden = false;
    }

    if (registerForm) {
      registerForm.style.display = "none";
      registerForm.hidden = true;
    }

    if (loginTab) {
      loginTab.classList.add("active");
      loginTab.setAttribute("aria-selected", "true");
    }

    if (registerTab) {
      registerTab.classList.remove("active");
      registerTab.setAttribute("aria-selected", "false");
    }

    if (title) {
      title.textContent = "Sign in to your account";
    }

    if (loginMessage) {
      loginMessage.textContent = "";
    }
  } else {
    if (registerForm) {
      registerForm.style.display = "";
      registerForm.hidden = false;
    }

    if (loginForm) {
      loginForm.style.display = "none";
      loginForm.hidden = true;
    }

    if (registerTab) {
      registerTab.classList.add("active");
      registerTab.setAttribute("aria-selected", "true");
    }

    if (loginTab) {
      loginTab.classList.remove("active");
      loginTab.setAttribute("aria-selected", "false");
    }

    if (title) {
      title.textContent = "Create your account";
    }

    if (registerMessage) {
      registerMessage.textContent = "";
    }
  }
}
  const loginPanel = $("#loginPanel");
  const registerPanel = $("#registerPanel");

  const loginTab = $("#loginTab");
  const registerTab = $("#registerTab");

  const loginMessage = $("#loginMessage");
  const registerMessage = $("#registerMessage");

  const normalizedMode =
    String(mode).toLowerCase() === "register"
      ? "register"
      : "login";

  if (normalizedMode === "login") {
    if (loginPanel) show(loginPanel);
    if (registerPanel) hide(registerPanel);

    if (loginTab) {
      loginTab.classList.add("active");
      loginTab.setAttribute("aria-selected", "true");
    }

    if (registerTab) {
      registerTab.classList.remove("active");
      registerTab.setAttribute("aria-selected", "false");
    }

    if (loginMessage) loginMessage.textContent = "";
  } else {
    if (registerPanel) show(registerPanel);
    if (loginPanel) hide(loginPanel);

    if (registerTab) {
      registerTab.classList.add("active");
      registerTab.setAttribute("aria-selected", "true");
    }

    if (loginTab) {
      loginTab.classList.remove("active");
      loginTab.setAttribute("aria-selected", "false");
    }

    if (registerMessage) registerMessage.textContent = "";
  }
}

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

    button.type = "button";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAuthModal("login");
    });
  });

  registerButtons.forEach((selector) => {
    const button = $(selector);

    if (!button) return;

    button.type = "button";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAuthModal("register");
    });
  });
}

function bindAuthModal() {
  const loginTab = $("#loginTab");
  const registerTab = $("#registerTab");
  const closeButton = $("#closeAuthModal");

  if (loginTab) {
    loginTab.type = "button";

    loginTab.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      switchAuthMode("login");
    });
  }

  if (registerTab) {
    registerTab.type = "button";

    registerTab.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      switchAuthMode("register");
    });
  }

  if (closeButton) {
    closeButton.type = "button";

    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      closeAuthModal();
    });
  }

  const modal = $("#authModal");

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeAuthModal();
      }
    });
  }

  const showLoginLinks = $$(".show-login");
  const showRegisterLinks = $$(".show-register");

  showLoginLinks.forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      switchAuthMode("login");
    });
  });

  showRegisterLinks.forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      switchAuthMode("register");
    });
  });
}

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
      message.textContent =
        "Please complete all required fields.";
    }

    return;
  }

  const submitButton =
    form.querySelector('button[type="submit"]');

  const originalText =
    submitButton?.textContent || "Create Account";

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

    currentUser = data.user || data;

    if (message) {
      message.textContent =
        "Account created successfully.";
    }

    setTimeout(() => {
      closeAuthModal();
      loadAccount();
    }, 500);
  } catch (error) {
    if (message) {
      message.textContent =
        error.message || "Unable to create account.";
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
}

async function loginUser(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const email =
    form.querySelector('[name="email"]')?.value?.trim() || "";

  const password =
    form.querySelector('[name="password"]')?.value || "";

  const message = $("#loginMessage");

  if (!email || !password) {
    if (message) {
      message.textContent =
        "Please enter your email and password.";
    }

    return;
  }

  const submitButton =
    form.querySelector('button[type="submit"]');

  const originalText =
    submitButton?.textContent || "Sign In";

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

    currentUser = data.user || data;

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
      submitButton.textContent = originalText;
    }
  }
}

function bindForms() {
  const loginForm = $("#loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  const registerForm = $("#registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }
}

async function getCurrentUser() {
  try {
    const data = await api("/me");

    return data.user || data;
  } catch {
    return null;
  }
}

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
    console.error("PayaCircle account error:", error);
    showPublicSite();
  }
}

function renderUserInformation(user) {
  const nameElements = [
    "#accountUserName",
    "#profileUserName",
    "#dashboardUserName"
  ];

  nameElements.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent = user?.name || "Member";
    }
  });

  const emailElements = [
    "#accountUserEmail",
    "#profileUserEmail",
    "#dashboardUserEmail"
  ];

  emailElements.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent = user?.email || "";
    }
  });
}

function renderAccountBalance(user) {
  const element = $("#accountBalance");

  if (!element) return;

  const memberships =
    Array.isArray(user?.memberships)
      ? user.memberships
      : [];

  const activeMemberships =
    memberships.filter(
      (membership) =>
        membership.status !== "CANCELLED" &&
        membership.status !== "REFUNDED"
    );

  const total =
    activeMemberships.reduce(
      (sum, membership) =>
        sum +
        Number(
          membership.circle?.amountCents || 0
        ),
      0
    );

  element.textContent = money(total);
}

function renderMemberships(user) {
  const container = $("#accountMemberships");

  if (!container) return;

  const memberships =
    Array.isArray(user?.memberships)
      ? user.memberships
      : [];

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>No circle memberships yet</strong>
        <span>Choose a circle to get started.</span>
      </div>
    `;

    return;
  }

  container.innerHTML = memberships
    .map((membership) => {
      const circle = membership.circle || {};

      const canCancel =
        membership.status !== "CANCELLED" &&
        membership.status !== "REFUNDED" &&
        circle.status === "COLLECTING";

      return `
        <article class="membership-card">
          <div class="membership-card-header">
            <div>
              <h3>
                ${escapeHTML(
                  circle.name ||
                  circle.code ||
                  "PayaCircle"
                )}
              </h3>

              <span class="membership-status">
                ${escapeHTML(
                  membership.status || "RESERVED"
                )}
              </span>
            </div>

            <strong>
              ${money(circle.amountCents)}
            </strong>
          </div>

          <div class="membership-card-details">
            <div>
              <span>Circle</span>
              <strong>
                ${escapeHTML(circle.code || "—")}
              </strong>
            </div>

            <div>
              <span>Payout date</span>
              <strong>
                ${formatDate(
                  membership.payoutDate?.payoutAt
                )}
              </strong>
            </div>
          </div>

          <div class="membership-card-actions">
            <button
              type="button"
              class="secondary view-circle-button"
              data-circle-id="${escapeHTML(circle.id || "")}"
            >
              View Circle
            </button>

            ${
              canCancel
                ? `
                  <button
                    type="button"
                    class="danger cancel-membership-button"
                    data-membership-id="${escapeHTML(
                      membership.id || ""
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

  $$(".view-circle-button").forEach((button) => {
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

function confirmCancellation(membershipId) {
  if (!membershipId) return;

  const memberships =
    Array.isArray(currentUser?.memberships)
      ? currentUser.memberships
      : [];

  const membership =
    memberships.find(
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

  const button = Array
    .from(
      document.querySelectorAll(
        ".cancel-membership-button"
      )
    )
    .find(
      (element) =>
        element.dataset.membershipId ===
        membershipId
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

    await loadAccount();
  } catch (error) {
    alert(
      error.message ||
      "Unable to cancel membership."
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        "Cancel Membership";
    }
  }
}

async function loadPayments() {
  const container = $("#accountPayments");

  if (!container) return;

  try {
    const data = await api("/payments");

    const payments =
      Array.isArray(data)
        ? data
        : Array.isArray(data.payments)
        ? data.payments
        : [];

    if (!payments.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No payments yet</strong>
          <span>Your payment history will appear here.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = payments
      .map(
        (payment) => `
          <div class="payment-row">
            <div>
              <strong>
                ${money(payment.amountCents)}
              </strong>

              <span>
                ${escapeHTML(
                  payment.status || "—"
                )}
              </span>
            </div>

            <time>
              ${formatDateTime(
                payment.createdAt
              )}
            </time>
          </div>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Payments unavailable</strong>
        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

async function loadPayouts() {
  const container = $("#accountPayouts");

  if (!container) return;

  try {
    const data = await api("/payouts");

    const payouts =
      Array.isArray(data)
        ? data
        : Array.isArray(data.payouts)
        ? data.payouts
        : [];

    if (!payouts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No payouts yet</strong>
          <span>Your payout information will appear here.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = payouts
      .map(
        (payout) => `
          <div class="payout-row">
            <div>
              <strong>
                ${money(payout.amountCents)}
              </strong>

              <span>
                ${escapeHTML(
                  payout.status || "—"
                )}
              </span>
            </div>

            <time>
              ${formatDateTime(
                payout.createdAt
              )}
            </time>
          </div>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Payouts unavailable</strong>
        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

function activateAccountPanel(panelName) {
  const panels = $$(
    "[data-account-panel]"
  );

  panels.forEach((panel) => {
    const active =
      panel.dataset.accountPanel ===
      panelName;

    if (active) {
      show(panel);
    } else {
      hide(panel);
    }
  });

  const links = $$(
    "[data-account-target]"
  );

  links.forEach((link) => {
    const active =
      link.dataset.accountTarget ===
      panelName;

    link.classList.toggle(
      "active",
      active
    );
  });
}

function bindAccountNavigation() {
  $$("[data-account-target]").forEach(
    (link) => {
      link.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          activateAccountPanel(
            link.dataset.accountTarget
          );
        }
      );
    }
  );
}

function bindProfileMenu() {
  const button = $("#profileMenuButton");
  const menu = $("#profileMenu");

  if (!button || !menu) return;

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    menu.classList.toggle("open");
    menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", () => {
    menu.classList.remove("open");
    menu.hidden = true;
  });
}

async function logoutUser() {
  try {
    await api("/logout", {
      method: "POST"
    });
  } catch {
    // Continue to local logout even if server logout fails.
  }

  currentUser = null;
  currentCircle = null;

  showPublicSite();
}

function bindLogoutButtons() {
  $$("[data-logout]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      await logoutUser();
    });
  });

  const logoutButton = $("#logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();
        await logoutUser();
      }
    );
  }
}

function bindModalButtons() {
  $$("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId =
        button.dataset.closeModal;

      const modal = modalId
        ? $(`#${modalId}`)
        : button.closest(".modal");

      hide(modal);
    });
  });

  $$(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        hide(modal);
      }
    });
  });
}

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
          <strong>No circles available</strong>
          <span>New circles will appear here.</span>
        </div>
      `;

      return;
    }

    container.innerHTML = circles
      .map(
        (circle) => `
          <article class="public-circle-card">
            <div>
              <span class="eyebrow">
                ${escapeHTML(
                  circle.type || "CUSTOM"
                )}
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
                ${Number(circle.memberCount || 0)}
                /
                ${Number(circle.capacity || 0)}
              </p>
            </div>

            <button
              type="button"
              class="primary full-width public-circle-button"
              data-circle-id="${escapeHTML(
                circle.id || ""
              )}"
            >
              View Circle
            </button>
          </article>
        `
      )
      .join("");

    $$(".public-circle-button").forEach(
      (button) => {
        button.addEventListener("click", () => {
          openCircleDetails(
            button.dataset.circleId
          );
        });
      }
    );
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
      `/circles/${encodeURIComponent(
        circleId
      )}`
    );

    const circle =
      data.circle || data;

    if (!circle?.id) {
      throw new Error(
        "Circle could not be found."
      );
    }

    currentCircle = circle;

    let dates = [];

    try {
      const dateData = await api(
        `/circles/${encodeURIComponent(
          circleId
        )}/dates`
      );

      dates =
        Array.isArray(dateData)
          ? dateData
          : Array.isArray(dateData.dates)
          ? dateData.dates
          : [];
    } catch {
      dates = [];
    }

    content.innerHTML = `
      <div class="circle-details">
        <span class="eyebrow">
          ${escapeHTML(
            circle.type || "CUSTOM"
          )}
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
          Capacity:
          ${Number(circle.capacity || 0)}
        </p>

        <p>
          Status:
          ${escapeHTML(
            circle.status || "COLLECTING"
          )}
        </p>

        ${
          dates.length
            ? `
              <div class="circle-dates">
                <h3>Available payout dates</h3>

                ${dates
                  .map(
                    (date) => `
                      <label class="date-option">
                        <input
                          type="radio"
                          name="payoutDate"
                          value="${escapeHTML(
                            date.id || ""
                          )}"
                        />

                        <span>
                          ${formatDate(
                            date.payoutAt
                          )}
                        </span>
                      </label>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="empty-state">
                <span>
                  No payout dates are currently available.
                </span>
              </div>
            `
        }

        <button
          type="button"
          class="primary full-width"
          id="reserveCircleButton"
          data-circle-id="${escapeHTML(
            circle.id
          )}"
        >
          Join Circle
        </button>
      </div>
    `;

    const reserveButton =
      $("#reserveCircleButton");

    if (reserveButton) {
      reserveButton.addEventListener(
        "click",
        () => {
          reserveMembership(
            reserveButton.dataset.circleId
          );
        }
      );
    }
  } catch (error) {
    content.innerHTML = `
      <div class="empty-state">
        <strong>Unable to open circle</strong>
        <span>
          ${escapeHTML(error.message)}
        </span>
      </div>
    `;
  }
}

async function reserveMembership(circleId) {
  if (!circleId) return;

  if (!currentUser) {
    closeModalById("circleDetailsModal");
    openAuthModal("login");
    return;
  }

  const selected =
    document.querySelector(
      'input[name="payoutDate"]:checked'
    );

  if (!selected) {
    alert(
      "Please choose a payout date."
    );

    return;
  }

  try {
    await api("/memberships", {
      method: "POST",
      body: JSON.stringify({
        circleId,
        payoutDateId: selected.value
      })
    });

    alert(
      "Your circle membership has been reserved."
    );

    closeModalById("circleDetailsModal");

    await loadAccount();
  } catch (error) {
    alert(
      error.message ||
      "Unable to join circle."
    );
  }
}

function closeModalById(id) {
  const modal = id ? $(`#${id}`) : null;

  if (modal) {
    hide(modal);
  }
}

function bindPublicNavigation() {
  $$("[data-scroll-to]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const target =
        document.getElementById(
          link.dataset.scrollTo
        );

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });
}

function bindPayPalButtons() {
  // PayPal buttons are created only after
  // a membership/payment flow is started.
}

async function initialize() {
  bindAuthButtons();
  bindAuthModal();
  bindAccountNavigation();
  bindProfileMenu();
  bindLogoutButtons();
  bindModalButtons();
  bindForms();
  bindPublicNavigation();
  bindPayPalButtons();

  // Public circles must never prevent
  // authentication from initializing.
  loadPublicCircles().catch((error) => {
    console.error(
      "PayaCircle public circles error:",
      error
    );
  });

  const user = await getCurrentUser();

  if (user) {
    currentUser = user;
    await loadAccount();
  } else {
    showPublicSite();
  }
}

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
