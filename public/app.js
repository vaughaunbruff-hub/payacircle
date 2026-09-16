const API = "/api";

let currentUser = null;
let currentMembership = null;
let currentCircle = null;
let currentPayoutDate = null;
let paypalReturnHandled = false;

const $ = (selector, root = document) => {
  try {
    return root.querySelector(selector);
  } catch (_) {
    return null;
  }
};

const $$ = (selector, root = document) => {
  try {
    return [...root.querySelectorAll(selector)];
  } catch (_) {
    return [];
  }
};

async function api(path, options = {}) {
  const config = {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };

  if (config.body && typeof config.body !== "string") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API}${path}`, config);

  let data = {};

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const error = new Error(
      data.error || `Request failed (${response.status})`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function money(cents = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(cents || 0) / 100);
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "PC";

  return parts
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function humanize(value = "") {
  return String(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getTypeLabel(type) {
  const labels = {
    FAMILY: "Family",
    FRIENDS: "Friends",
    SOCIAL_MEDIA: "Social Media",
    CUSTOM: "Custom"
  };

  return labels[type] || "Circle";
}

function getStatusClass(status = "") {
  return String(status)
    .toLowerCase()
    .replaceAll("_", "-");
}

function getStatusLabel(status = "") {
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
  toast.className = `pc-toast pc-toast-${type} pc-toast-show`;

  clearTimeout(window.__pcToastTimer);

  window.__pcToastTimer = setTimeout(() => {
    toast.classList.remove("pc-toast-show");
  }, 3500);
}

function setLoading(button, loading, loadingText = "Please wait...") {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

    button.disabled = true;
    button.innerHTML = loadingText;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

/* AUTH */

function openModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.add("active");
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");

  if (!$(".modal.active")) {
    document.body.classList.remove("modal-open");
  }
}

function closeAllModals() {
  $$(".modal.active").forEach(modal => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  });

  document.body.classList.remove("modal-open");
}

function switchAuth(mode) {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");
  const loginTitle = $("#loginTitle");
  const registerTitle = $("#registerTitle");

  if (mode === "register") {
    if (loginForm) loginForm.hidden = true;
    if (registerForm) registerForm.hidden = false;
    if (loginTitle) loginTitle.hidden = true;
    if (registerTitle) registerTitle.hidden = false;
  } else {
    if (loginForm) loginForm.hidden = false;
    if (registerForm) registerForm.hidden = true;
    if (loginTitle) loginTitle.hidden = false;
    if (registerTitle) registerTitle.hidden = true;
  }
}

function openLogin() {
  switchAuth("login");
  openModal("authModal");
}

function openRegister() {
  switchAuth("register");
  openModal("authModal");
}

function bindAuthButtons() {
  $$("[data-open-login]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      openLogin();
    });
  });

  $$("[data-open-register]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      openRegister();
    });
  });

  $$("[data-close-modal]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      const modal = button.closest(".modal");

      if (modal) {
        closeModal(modal.id);
      }
    });
  });

  $$(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  const showLogin = $("#showLogin");
  const showRegister = $("#showRegister");

  if (showLogin) {
    showLogin.addEventListener("click", event => {
      event.preventDefault();
      switchAuth("login");
    });
  }

  if (showRegister) {
    showRegister.addEventListener("click", event => {
      event.preventDefault();
      switchAuth("register");
    });
  }
}

/* REGISTER */

async function registerUser(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  const name = form
    .querySelector('[name="name"]')
    ?.value.trim();

  const email = form
    .querySelector('[name="email"]')
    ?.value.trim();

  const password = form
    .querySelector('[name="password"]')
    ?.value;

  if (!name || !email || !password) {
    showToast("Please complete all fields.", "error");
    return;
  }

  setLoading(button, true, "Creating account...");

  try {
    const data = await api("/register", {
      method: "POST",
      body: {
        name,
        email,
        password
      }
    });

    currentUser = data;

    closeAllModals();

    showToast(
      "Account created successfully.",
      "success"
    );

    await showDashboard();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

/* LOGIN */

async function loginUser(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');

  const email = form
    .querySelector('[name="email"]')
    ?.value.trim();

  const password = form
    .querySelector('[name="password"]')
    ?.value;

  if (!email || !password) {
    showToast(
      "Please enter your email and password.",
      "error"
    );
    return;
  }

  setLoading(button, true, "Signing in...");

  try {
    const data = await api("/login", {
      method: "POST",
      body: {
        email,
        password
      }
    });

    currentUser = data;

    closeAllModals();

    showToast(
      "Signed in successfully.",
      "success"
    );

    await showDashboard();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

/* LOGOUT */

async function logoutUser() {
  try {
    await api("/logout", {
      method: "POST"
    });
  } catch (_) {}

  currentUser = null;
  currentMembership = null;
  currentCircle = null;
  currentPayoutDate = null;

  hideDashboard();

  showToast(
    "You have been signed out.",
    "success"
  );
}

/* DASHBOARD VISIBILITY */

function hideDashboard() {
  const dashboard = $("#dashboard");

  if (dashboard) {
    dashboard.hidden = true;
    dashboard.classList.remove("active");
  }

  $$("body > *").forEach(element => {
    if (
      element.id !== "dashboard" &&
      element.id !== "pcToast"
    ) {
      element.hidden = false;
    }
  });

  document.body.classList.remove("dashboard-active");
}

function showDashboardElements() {
  $$("body > *").forEach(element => {
    if (
      element.id !== "dashboard" &&
      element.id !== "pcToast"
    ) {
      element.hidden = true;
    }
  });

  const dashboard = $("#dashboard");

  if (dashboard) {
    dashboard.hidden = false;
    dashboard.classList.add("active");
  }

  document.body.classList.add("dashboard-active");
}

async function showDashboard() {
  showDashboardElements();

  try {
    await refreshDashboard();
    activateAccountPanel("overview");
  } catch (error) {
    console.error("Dashboard error:", error);

    showToast(
      "Your account loaded, but some dashboard information could not be loaded.",
      "error"
    );
  }
}

/* CURRENT USER */

async function loadCurrentUser() {
  try {
    const user = await api("/me");

    currentUser = user;

    return user;
  } catch (error) {
    if (error.status === 401) {
      currentUser = null;
    }

    return null;
  }
}

/* DASHBOARD DATA */

async function refreshDashboard() {
  const user = await loadCurrentUser();

  if (!user) {
    hideDashboard();
    return;
  }

  currentUser = user;

  renderUserHeader();
  renderDashboardOverview();
  renderMemberships();
  renderTransactions();
  renderPayouts();
  renderProfile();
}

/* USER HEADER */

function renderUserHeader() {
  if (!currentUser) return;

  const name = currentUser.name || "Member";
  const email = currentUser.email || "";

  [
    "#dashboardUserName",
    "#accountUserName"
  ].forEach(selector => {
    const element = $(selector);

    if (element) {
      element.textContent = name;
    }
  });

  const profileName = $("#profileName");

  if (profileName) {
    profileName.value = name;
  }

  [
    "#dashboardUserEmail",
    "#accountUserEmail"
  ].forEach(selector => {
    const element = $(selector);

    if (element) {
      element.textContent = email;
    }
  });

  const profileEmail = $("#profileEmail");

  if (profileEmail) {
    profileEmail.value = email;
  }

  $$(".dashboardUserInitials").forEach(element => {
    element.textContent = initials(name);
  });
}

/* OVERVIEW */

function renderDashboardOverview() {
  if (!currentUser) return;

  const memberships = Array.isArray(
    currentUser.memberships
  )
    ? currentUser.memberships
    : [];

  const paidMemberships = memberships.filter(
    membership =>
      membership.status === "PAID" ||
      membership.status === "PAYOUT_SCHEDULED" ||
      membership.status === "PAID_OUT"
  );

  const totalSavings = paidMemberships.reduce(
    (total, membership) =>
      total +
      Number(
        membership.circle?.amountCents || 0
      ),
    0
  );

  const completedPayouts = memberships.filter(
    membership =>
      membership.status === "PAID_OUT"
  );

  const payoutTotal = completedPayouts.reduce(
    (total, membership) =>
      total +
      Number(
        membership.circle?.amountCents || 0
      ),
    0
  );

  const activeContribution = memberships
    .filter(
      membership =>
        membership.status !== "CANCELLED"
    )
    .reduce(
      (total, membership) =>
        total +
        Number(
          membership.circle?.amountCents || 0
        ),
      0
    );

  const totalSavingsElement =
    $("#accountTotalSavings");

  if (totalSavingsElement) {
    totalSavingsElement.textContent =
      money(totalSavings);
  }

  const balanceElement =
    $("#accountAvailableBalance");

  if (balanceElement) {
    balanceElement.textContent =
      money(payoutTotal);
  }

  const contributionElement =
    $("#accountContributionTotal");

  if (contributionElement) {
    contributionElement.textContent =
      money(activeContribution);
  }

  const circlesElement =
    $("#accountCircleCount");

  if (circlesElement) {
    circlesElement.textContent =
      memberships.length;
  }

  const payoutElement =
    $("#accountPayoutTotal");

  if (payoutElement) {
    payoutElement.textContent =
      money(payoutTotal);
  }

  const progress =
    memberships.length > 0
      ? Math.min(
          100,
          Math.round(
            (paidMemberships.length /
              memberships.length) *
              100
          )
        )
      : 0;

  const progressElement =
    $("#accountProgress");

  if (progressElement) {
    progressElement.textContent =
      `${progress}%`;
  }

  $$(".accountProgressBar").forEach(bar => {
    bar.style.width = `${progress}%`;
  });

  renderRecentActivity(memberships);
}

/* RECENT ACTIVITY */

function renderRecentActivity(
  memberships = []
) {
  const container = $("#recentActivity");

  if (!container) return;

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">○</div>
        <h3>No activity yet</h3>
        <p>Join your first savings circle to get started.</p>
      </div>
    `;

    return;
  }

  const sorted = [...memberships]
    .sort(
      (a, b) =>
        new Date(
          b.updatedAt || b.createdAt || 0
        ) -
        new Date(
          a.updatedAt || a.createdAt || 0
        )
    )
    .slice(0, 5);

  container.innerHTML = sorted
    .map(membership => {
      const circle =
        membership.circle || {};

      return `
        <div class="transaction-row">
          <div class="transaction-icon">◎</div>

          <div class="transaction-info">
            <strong>
              ${escapeHTML(
                circle.name ||
                circle.code ||
                "Savings Circle"
              )}
            </strong>

            <span>
              ${escapeHTML(
                getStatusLabel(
                  membership.status
                )
              )}
            </span>
          </div>

          <div class="transaction-amount">
            ${money(circle.amountCents)}
          </div>
        </div>
      `;
    })
    .join("");
}

/* ACCOUNT NAVIGATION */

function activateAccountPanel(
  panelName
) {
  const panels =
    $$("[data-account-panel]");

  panels.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.accountPanel ===
        panelName
    );
  });

  const sections =
    $$(".account-panel");

  sections.forEach(section => {
    section.hidden =
      section.dataset.panel !==
      panelName;
  });

  const title =
    $("#accountPanelTitle");

  const titles = {
    overview: "My Account",
    circles: "My Savings Circles",
    contributions: "Contributions",
    payouts: "Payouts",
    "payment-methods":
      "Payment Methods",
    profile: "Profile",
    settings: "Account Settings",
    security: "Security",
    help: "Help & Support"
  };

  if (title) {
    title.textContent =
      titles[panelName] ||
      "My Account";
  }

  const main =
    $("#accountMain");

  if (main) {
    try {
      main.scrollTop = 0;
    } catch (_) {}
  }

  if (panelName === "circles") {
    loadDashboardCircles();
  }

  if (panelName === "contributions") {
    renderTransactions();
  }

  if (panelName === "payouts") {
    renderPayouts();
  }

  if (
    panelName ===
    "payment-methods"
  ) {
    renderPaymentMethods();
  }
}

function bindAccountNavigation() {
  $$("[data-account-panel]")
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();

          activateAccountPanel(
            button.dataset.accountPanel
          );

          $$(".account-sidebar")
            .forEach(sidebar => {
              sidebar.classList.remove(
                "open"
              );
            });
        }
      );
    });

  $$("[data-account-home]")
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          activateAccountPanel(
            "overview"
          );
        }
      );
    });

  $$("[data-mobile-menu]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const sidebar =
            $(".account-sidebar");

          if (sidebar) {
            sidebar.classList.toggle(
              "open"
            );
          }
        }
      );
    });
}

/* CIRCLES */

async function loadDashboardCircles() {
  const container =
    $("#dashboardCircles");

  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">...</div>
      <p>Loading savings circles...</p>
    </div>
  `;

  try {
    const circles =
      await api("/circles");

    renderCircles(circles);
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Unable to load circles</h3>
        <p>${escapeHTML(
          error.message
        )}</p>
      </div>
    `;
  }
}

function renderCircles(
  circles = []
) {
  const container =
    $("#dashboardCircles");

  if (!container) return;

  if (!Array.isArray(circles) ||
      !circles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <h3>No savings circles available</h3>
        <p>New circles will appear here when they are available.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = circles
    .map(circle => {
      const count =
        Number(
          circle._count?.memberships || 0
        );

      const capacity =
        Number(circle.capacity || 0);

      const progress =
        capacity > 0
          ? Math.min(
              100,
              Math.round(
                (count / capacity) * 100
              )
            )
          : 0;

      return `
        <article class="dashboard-circle-card">
          <div class="circle-meta">
            <span class="circle-type">
              ${escapeHTML(
                getTypeLabel(
                  circle.type
                )
              )}
            </span>

            <span class="circle-status ${getStatusClass(
              circle.status
            )}">
              ${escapeHTML(
                getStatusLabel(
                  circle.status
                )
              )}
            </span>
          </div>

          <h3>
            ${escapeHTML(
              circle.name ||
              "PayaCircle Savings Circle"
            )}
          </h3>

          <p class="circle-code">
            Circle code:
            ${escapeHTML(
              circle.code || ""
            )}
          </p>

          <div class="circle-detail">
            <span>Contribution</span>
            <strong>
              ${money(
                circle.amountCents
              )}
            </strong>
          </div>

          <div class="circle-detail">
            <span>Members</span>
            <strong>
              ${count} / ${capacity}
            </strong>
          </div>

          <div class="circle-progress">
            <div
              class="circle-progress-bar"
              style="width:${progress}%"
            ></div>
          </div>

          <div class="circle-progress-label">
            ${progress}% filled
          </div>

          <button
            class="circle-choose-button"
            type="button"
            data-choose-circle="${escapeHTML(
              circle.id
            )}"
          >
            View Circle
          </button>
        </article>
      `;
    })
    .join("");

  $$("[data-choose-circle]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          openCircleDetails(
            button.dataset.chooseCircle
          );
        }
      );
    });
}

async function openCircleDetails(
  circleId
) {
  try {
    const circles =
      await api("/circles");

    const circle =
      Array.isArray(circles)
        ? circles.find(
            item =>
              item.id === circleId
          )
        : null;

    if (!circle) {
      showToast(
        "Circle could not be found.",
        "error"
      );
      return;
    }

    currentCircle = circle;

    await showCircleSelection(
      circle
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function showCircleSelection(
  circle
) {
  const container =
    $("#circleSelectionContent");

  if (!container) {
    activateAccountPanel(
      "circles"
    );
    return;
  }

  container.innerHTML = `
    <div class="payment-summary">
      <h3>
        ${escapeHTML(
          circle.name ||
          "Savings Circle"
        )}
      </h3>

      <p>
        ${escapeHTML(
          getTypeLabel(
            circle.type
          )
        )}
        · ${money(
          circle.amountCents
        )}
        contribution
      </p>
    </div>

    <div
      class="circle-details"
      id="circleDateOptions"
    >
      <div class="empty-state">
        <p>Loading payout dates...</p>
      </div>
    </div>
  `;

  activateAccountPanel(
    "circles"
  );

  try {
    const dates =
      await api(
        `/circles/${encodeURIComponent(
          circle.id
        )}/dates`
      );

    renderCircleDates(
      circle,
      dates
    );
  } catch (error) {
    const datesContainer =
      $("#circleDateOptions");

    if (datesContainer) {
      datesContainer.innerHTML = `
        <div class="empty-state">
          <h3>Payout dates are not available yet</h3>
          <p>${escapeHTML(
            error.message
          )}</p>
        </div>
      `;
    }
  }
}

function renderCircleDates(
  circle,
  dates = []
) {
  const container =
    $("#circleDateOptions");

  if (!container) return;

  if (
    !Array.isArray(dates) ||
    !dates.length
  ) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <h3>No payout dates available</h3>
        <p>This circle does not have payout dates configured yet.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="circle-date-list">
      ${dates
        .map(date => {
          const available =
            Number(
              date.reserved || 0
            ) <
            Number(
              date.capacity || 0
            );

          return `
            <label class="circle-date-option ${
              available
                ? ""
                : "disabled"
            }">
              <input
                type="radio"
                name="payoutDate"
                value="${escapeHTML(
                  date.id
                )}"
                ${
                  available
                    ? ""
                    : "disabled"
                }
              >

              <span class="circle-date-content">
                <strong>
                  ${escapeHTML(
                    formatDate(
                      date.payoutAt
                    )
                  )}
                </strong>

                <small>
                  ${
                    available
                      ? `${
                          Number(
                            date.capacity
                          ) -
                          Number(
                            date.reserved
                          )
                        } spot(s) available`
                      : "Fully reserved"
                  }
                </small>
              </span>
            </label>
          `;
        })
        .join("")}
    </div>

    <button
      class="circle-choose-button"
      id="reserveCircleButton"
      type="button"
    >
      Continue to Payment
    </button>
  `;

  const reserveButton =
    $("#reserveCircleButton");

  if (reserveButton) {
    reserveButton.addEventListener(
      "click",
      () => {
        const selected =
          $('input[name="payoutDate"]:checked');

        if (!selected) {
          showToast(
            "Please select a payout date.",
            "error"
          );
          return;
        }

        const selectedDate =
          dates.find(
            date =>
              date.id ===
              selected.value
          );

        if (!selectedDate) {
          showToast(
            "The selected payout date is no longer available.",
            "error"
          );
          return;
        }

        currentPayoutDate =
          selectedDate;

        reserveMembership(
          circle,
          selectedDate
        );
      }
    );
  }
}

/* MEMBERSHIP */

async function reserveMembership(
  circle,
  payoutDate
) {
  const button =
    $("#reserveCircleButton");

  setLoading(
    button,
    true,
    "Reserving..."
  );

  try {
    const membership =
      await api(
        "/memberships",
        {
          method: "POST",
          body: {
            circleId:
              circle.id,
            payoutDateId:
              payoutDate.id
          }
        }
      );

    currentMembership =
      membership;

    showToast(
      "Your payout position has been reserved.",
      "success"
    );

    await refreshDashboard();

    await openPaymentPanel(
      membership.id,
      circle,
      payoutDate
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  } finally {
    setLoading(
      button,
      false
    );
  }
}

/* MEMBERSHIPS */

function renderMemberships() {
  const container =
    $("#membershipList");

  if (!container) return;

  const memberships =
    Array.isArray(
      currentUser?.memberships
    )
      ? currentUser.memberships
      : [];

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <h3>You haven't joined a circle yet</h3>
        <p>Choose a savings circle to start building your savings.</p>

        <button
          class="setting-action"
          type="button"
          data-go-circles
        >
          Browse Circles
        </button>
      </div>
    `;

    $$("[data-go-circles]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            activateAccountPanel(
              "circles"
            );
          }
        );
      });

    return;
  }

  container.innerHTML =
    memberships
      .map(membership => {
        const circle =
          membership.circle ||
          {};

        const date =
          membership.payoutDate ||
          {};

        return `
          <div class="membership-row">
            <div class="membership-icon">
              ◎
            </div>

            <div class="membership-main">
              <div class="membership-info">
                <strong>
                  ${escapeHTML(
                    circle.name ||
                    circle.code ||
                    "Savings Circle"
                  )}
                </strong>

                <span>
                  ${escapeHTML(
                    getTypeLabel(
                      circle.type
                    )
                  )}
                  · ${money(
                    circle.amountCents
                  )}
                </span>

                <small>
                  Payout:
                  ${escapeHTML(
                    formatDate(
                      date.payoutAt
                    )
                  )}
                </small>
              </div>

              <span class="status-badge ${getStatusClass(
                membership.status
              )}">
                ${escapeHTML(
                  getStatusLabel(
                    membership.status
                  )
                )}
              </span>
            </div>
          </div>
        `;
      })
      .join("");
}

/* TRANSACTIONS */

function renderTransactions() {
  const container =
    $("#contributionTransactions");

  if (!container) return;

  const memberships =
    Array.isArray(
      currentUser?.memberships
    )
      ? currentUser.memberships
      : [];

  if (!memberships.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◇</div>
        <h3>No contributions yet</h3>
        <p>Your contribution history will appear here.</p>
      </div>
    `;

    return;
  }

  const rows = [];

  memberships.forEach(
    membership => {
      const circle =
        membership.circle ||
        {};

      const payments =
        Array.isArray(
          membership.payments
        )
          ? membership.payments
          : [];

      if (payments.length) {
        payments.forEach(
          payment => {
            rows.push({
              date:
                payment.createdAt,
              title:
                circle.name ||
                circle.code ||
                "Savings Circle",
              status:
                payment.status,
              amount:
                payment.amountCents
            });
          }
        );
      } else {
        rows.push({
          date:
            membership.createdAt,
          title:
            circle.name ||
            circle.code ||
            "Savings Circle",
          status:
            membership.status,
          amount:
            circle.amountCents
        });
      }
    }
  );

  rows.sort(
    (a, b) =>
      new Date(b.date || 0) -
      new Date(a.date || 0)
  );

  container.innerHTML =
    rows
      .map(transaction => {
        return `
          <div class="transaction-row">
            <div class="transaction-icon">
              ↗
            </div>

            <div class="transaction-info">
              <strong>
                ${escapeHTML(
                  transaction.title
                )}
              </strong>

              <span>
                ${escapeHTML(
                  getStatusLabel(
                    transaction.status
                  )
                )}
                ·
                ${escapeHTML(
                  formatDate(
                    transaction.date
                  )
                )}
              </span>
            </div>

            <div class="transaction-amount">
              ${money(
                transaction.amount
              )}
            </div>
          </div>
        `;
      })
      .join("");
}

/* PAYOUTS */

function renderPayouts() {
  const container =
    $("#payoutTimeline");

  if (!container) return;

  const memberships =
    Array.isArray(
      currentUser?.memberships
    )
      ? currentUser.memberships
      : [];

  const payoutItems =
    memberships
      .filter(
        membership =>
          membership.payoutDate
      )
      .sort(
        (a, b) =>
          new Date(
            a.payoutDate.payoutAt
          ) -
          new Date(
            b.payoutDate.payoutAt
          )
      );

  if (!payoutItems.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <h3>No payouts scheduled</h3>
        <p>Your payout schedule will appear here after joining a circle.</p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    payoutItems
      .map(membership => {
        const circle =
          membership.circle ||
          {};

        const payout =
          membership.payout;

        const date =
          membership.payoutDate;

        const status =
          payout?.status ||
          membership.status ||
          "SCHEDULED";

        return `
          <div class="payout-item">
            <div class="payout-dot"></div>

            <div class="payout-info">
              <strong>
                ${escapeHTML(
                  circle.name ||
                  circle.code ||
                  "Savings Circle"
                )}
              </strong>

              <span>
                ${escapeHTML(
                  formatDate(
                    date.payoutAt
                  )
                )}
              </span>

              <small>
                ${escapeHTML(
                  getStatusLabel(
                    status
                  )
                )}
              </small>
            </div>

            <div class="payout-value">
              ${money(
                payout?.amountCents ||
                circle.amountCents
              )}
            </div>
          </div>
        `;
      })
      .join("");
}

/* PAYMENT METHODS */

function renderPaymentMethods() {
  const container =
    $("#paymentMethodList");

  if (!container) return;

  container.innerHTML = `
    <div class="payment-summary">
      <div>
        <strong>PayPal</strong>

        <p>
          Pay securely through PayPal when you make a PayaCircle contribution.
        </p>
      </div>

      <span class="status-badge paid">
        Available
      </span>
    </div>
  `;
}

/* PROFILE */

function renderProfile() {
  if (!currentUser) return;

  const name =
    $("#profileName");

  const email =
    $("#profileEmail");

  const paypalEmail =
    $("#profilePaypalEmail");

  if (name) {
    name.value =
      currentUser.name || "";
  }

  if (email) {
    email.value =
      currentUser.email || "";
  }

  if (paypalEmail) {
    paypalEmail.value =
      currentUser.paypalEmail || "";
  }
}

/* PAYPAL */

async function openPaymentPanel(
  membershipId,
  circle,
  payoutDate
) {
  currentMembership = {
    ...(currentMembership || {}),
    id: membershipId
  };

  currentCircle = circle;
  currentPayoutDate =
    payoutDate;

  const panel =
    $("#paymentPanel");

  if (!panel) {
    activateAccountPanel(
      "payment-methods"
    );
    return;
  }

  const title =
    $("#paymentCircleName");

  const amount =
    $("#paymentAmount");

  const date =
    $("#paymentPayoutDate");

  if (title) {
    title.textContent =
      circle.name ||
      circle.code ||
      "PayaCircle";
  }

  if (amount) {
    amount.textContent =
      money(circle.amountCents);
  }

  if (date) {
    date.textContent =
      formatDate(
        payoutDate.payoutAt
      );
  }

  activateAccountPanel(
    "payment-methods"
  );

  panel.hidden = false;

  const payButton =
    $("#paypalPayButton");

  if (payButton) {
    payButton.disabled = false;
    payButton.textContent =
      "Continue with PayPal";

    payButton.onclick =
      () =>
        beginPayPalPayment(
          membershipId
        );
  }
}

async function beginPayPalPayment(
  membershipId
) {
  const button =
    $("#paypalPayButton");

  setLoading(
    button,
    true,
    "Connecting to PayPal..."
  );

  try {
    const data =
      await api(
        "/paypal/create-order",
        {
          method: "POST",
          body: {
            membershipId
          }
        }
      );

    if (!data.approvalUrl) {
      throw new Error(
        "PayPal approval link was not returned."
      );
    }

    showToast(
      "Opening PayPal Sandbox...",
      "success"
    );

    window.location.href =
      data.approvalUrl;
  } catch (error) {
    showToast(
      error.message,
      "error"
    );

    setLoading(
      button,
      false
    );
  }
}

/* PAYPAL RETURN */

async function handlePayPalReturn() {
  if (paypalReturnHandled) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const paypalStatus =
    params.get("paypal");

  const token =
    params.get("token");

  if (
    paypalStatus !== "success" &&
    paypalStatus !== "cancel"
  ) {
    return;
  }

  paypalReturnHandled = true;

  if (
    paypalStatus === "cancel"
  ) {
    showToast(
      "PayPal payment was cancelled.",
      "info"
    );

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    return;
  }

  if (!token) {
    showToast(
      "PayPal returned without an order ID.",
      "error"
    );

    return;
  }

  try {
    await loadCurrentUser();

    if (!currentUser) {
      showToast(
        "Please sign in again to complete the payment.",
        "error"
      );

      return;
    }

    const result =
      await api(
        "/paypal/capture-order",
        {
          method: "POST",
          body: {
            orderId: token
          }
        }
      );

    if (
      result.status ===
      "COMPLETED"
    ) {
      showToast(
        "Payment confirmed successfully.",
        "success"
      );
    } else {
      showToast(
        `PayPal returned status: ${
          result.status ||
          "unknown"
        }`,
        "info"
      );
    }

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    await showDashboard();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

/* CREATE CIRCLE */

async function createCircle(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const button =
    form.querySelector(
      'button[type="submit"]'
    );

  const name =
    form.querySelector(
      '[name="name"]'
    )?.value.trim();

  const type =
    form.querySelector(
      '[name="type"]'
    )?.value;

  const capacityValue =
    form.querySelector(
      '[name="capacity"]'
    )?.value;

  const amountValue =
    form.querySelector(
      '[name="amountUsd"]'
    )?.value;

  const capacity =
    Number(capacityValue);

  const amountUsd =
    Number(amountValue);

  if (
    !name ||
    !type ||
    !Number.isInteger(
      capacity
    ) ||
    !amountUsd ||
    amountUsd <= 0
  ) {
    showToast(
      "Please complete the circle details.",
      "error"
    );

    return;
  }

  setLoading(
    button,
    true,
    "Creating circle..."
  );

  try {
    await api(
      "/circles",
      {
        method: "POST",
        body: {
          name,
          type,
          capacity,
          amountUsd
        }
      }
    );

    showToast(
      "Savings circle created successfully.",
      "success"
    );

    form.reset();

    await loadDashboardCircles();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  } finally {
    setLoading(
      button,
      false
    );
  }
}

/* PUBLIC CIRCLES */

async function loadPublicCircles() {
  const container =
    $("#publicCircles") ||
    $("#circleGrid") ||
    $("#circlesGrid");

  if (!container) return;

  try {
    const circles =
      await api("/circles");

    if (
      !Array.isArray(circles) ||
      !circles.length
    ) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No circles available yet</h3>
          <p>Check back soon for new savings circles.</p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      circles
        .slice(0, 6)
        .map(circle => {
          const count =
            Number(
              circle._count
                ?.memberships || 0
            );

          return `
            <article class="circle-card">
              <span class="circle-type">
                ${escapeHTML(
                  getTypeLabel(
                    circle.type
                  )
                )}
              </span>

              <h3>
                ${escapeHTML(
                  circle.name ||
                  "PayaCircle Savings Circle"
                )}
              </h3>

              <p>
                ${money(
                  circle.amountCents
                )}
                contribution
              </p>

              <small>
                ${count} /
                ${Number(
                  circle.capacity || 0
                )}
                members
              </small>
            </article>
          `;
        })
        .join("");
  } catch (_) {}
}

/* PUBLIC NAVIGATION */

function bindPublicNavigation() {
  $$("a[href^='#']")
    .forEach(link => {
      link.addEventListener(
        "click",
        event => {
          const targetId =
            link.getAttribute(
              "href"
            );

          if (
            !targetId ||
            targetId === "#" ||
            document.body.classList.contains(
              "dashboard-active"
            )
          ) {
            return;
          }

          let target = null;

          try {
            target =
              document.querySelector(
                targetId
              );
          } catch (_) {
            return;
          }

          if (!target) return;

          event.preventDefault();

          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      );
    });
}

/* MOBILE MENU */

function bindMobileMenu() {
  const toggle =
    $("[data-mobile-toggle]") ||
    $("#mobileMenuToggle");

  const menu =
    $("[data-mobile-menu-public]") ||
    $("#mobileMenu");

  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener(
    "click",
    () => {
      menu.classList.toggle(
        "open"
      );
    }
  );
}

/* FORMS */

function bindForms() {
  const registerForm =
    $("#registerForm");

  if (
    registerForm &&
    !registerForm.dataset.bound
  ) {
    registerForm.dataset.bound =
      "true";

    registerForm.addEventListener(
      "submit",
      registerUser
    );
  }

  const loginForm =
    $("#loginForm");

  if (
    loginForm &&
    !loginForm.dataset.bound
  ) {
    loginForm.dataset.bound =
      "true";

    loginForm.addEventListener(
      "submit",
      loginUser
    );
  }

  const createCircleForm =
    $("#createCircleForm") ||
    $("#circleForm");

  if (
    createCircleForm &&
    !createCircleForm.dataset.bound
  ) {
    createCircleForm.dataset.bound =
      "true";

    createCircleForm.addEventListener(
      "submit",
      createCircle
    );
  }
}

/* LOGOUT */

function bindLogoutButtons() {
  $$("[data-logout]")
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          logoutUser();
        }
      );
    });
}

/* GET STARTED */

function bindGetStarted() {
  $$("[data-get-started]")
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();

          if (currentUser) {
            showDashboard();
          } else {
            openRegister();
          }
        }
      );
    });
}

/* REFRESH */

function bindRefreshButtons() {
  $$("[data-refresh-dashboard]")
    .forEach(button => {
      button.addEventListener(
        "click",
        async event => {
          event.preventDefault();

          setLoading(
            button,
            true,
            "Refreshing..."
          );

          try {
            await refreshDashboard();

            showToast(
              "Account refreshed.",
              "success"
            );
          } catch (error) {
            showToast(
              error.message,
              "error"
            );
          } finally {
            setLoading(
              button,
              false
            );
          }
        }
      );
    });
}

/* INITIALIZATION */

async function initializeApp() {
  try {
    bindAuthButtons();
    bindAccountNavigation();
    bindForms();
    bindLogoutButtons();
    bindGetStarted();
    bindRefreshButtons();
    bindPublicNavigation();
    bindMobileMenu();

    const user =
      await loadCurrentUser();

    if (user) {
      await showDashboard();
    } else {
      await loadPublicCircles();
    }

    await handlePayPalReturn();
  } catch (error) {
    console.error(
      "PayaCircle initialization error:",
      error
    );

    const publicSite =
      $("#publicSite");

    const dashboard =
      $("#dashboard");

    if (
      publicSite &&
      !currentUser
    ) {
      publicSite.hidden = false;
    }

    if (
      dashboard &&
      currentUser
    ) {
      dashboard.hidden = false;
    }

    showToast(
      "PayaCircle loaded with limited functionality. Please refresh the page.",
      "error"
    );
  }
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp,
    { once: true }
  );
} else {
  initializeApp();
}
