const API = "/api";

let currentUser = null;
let selectedCircle = null;
let selectedMembership = null;
let payoutWeekMembership = null;

/* --------------------------------
   HELPERS
--------------------------------- */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));

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
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

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
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        data?.message ||
        `Request failed (${response.status})`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

/* --------------------------------
   VISIBILITY
--------------------------------- */

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

/* --------------------------------
   AUTH MODAL
--------------------------------- */

function openAuthModal(tab = "login") {
  const modal = $("#authModal");

  if (!modal) return;

  show(modal);

  if (tab === "register") {
    $("#registerTab")?.click();
  } else {
    $("#loginTab")?.click();
  }
}

function closeAuthModal() {
  hide($("#authModal"));
}

function setupAuthModal() {
  $("#registerTab")?.addEventListener(
    "click",
    () => {
      $("#registerTab")?.classList.add("active");
      $("#loginTab")?.classList.remove("active");

      show($("#registerForm"));
      hide($("#loginForm"));
    }
  );

  $("#loginTab")?.addEventListener(
    "click",
    () => {
      $("#loginTab")?.classList.add("active");
      $("#registerTab")?.classList.remove("active");

      show($("#loginForm"));
      hide($("#registerForm"));
    }
  );

  $$("[data-close-auth]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        closeAuthModal
      );
    }
  );

  $("#closeAuthModal")?.addEventListener(
    "click",
    closeAuthModal
  );

  $("#authModal")?.addEventListener(
    "click",
    (event) => {
      if (event.target === $("#authModal")) {
        closeAuthModal();
      }
    }
  );
}

/* --------------------------------
   REGISTER
--------------------------------- */

async function registerUser(event) {
  event.preventDefault();

  const name =
    $("#registerName")?.value.trim();

  const email =
    $("#registerEmail")?.value.trim();

  const password =
    $("#registerPassword")?.value;

  const message =
    $("#registerMessage");

  if (message) {
    message.textContent = "";
  }

  try {
    const user = await api(
      "/register",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password
        })
      }
    );

    currentUser = user;

    closeAuthModal();

    await loadAccount();

    showDashboard();

    alert(
      `Welcome to PayaCircle, ${
        user.name?.trim().split(/\s+/)[0] ||
        "Member"
      }!`
    );
  } catch (error) {
    if (message) {
      message.textContent =
        error.message;
    } else {
      alert(error.message);
    }
  }
}

/* --------------------------------
   LOGIN
--------------------------------- */

async function loginUser(event) {
  event.preventDefault();

  const email =
    $("#loginEmail")?.value.trim();

  const password =
    $("#loginPassword")?.value;

  const message =
    $("#loginMessage");

  if (message) {
    message.textContent = "";
  }

  try {
    const user = await api(
      "/login",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password
        })
      }
    );

    currentUser = user;

    closeAuthModal();

    await loadAccount();

    showDashboard();
  } catch (error) {
    if (message) {
      message.textContent =
        error.message;
    } else {
      alert(error.message);
    }
  }
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

async function loadAccount() {
  const user =
    await getCurrentUser();

  if (!user) {
    currentUser = null;
    showPublicSite();
     loadPublicCircles();
    return null;
  }

  currentUser = user;

  renderUserInformation(user);

  renderMemberships(
    user.memberships || []
  );

  await loadPayments();
  await loadPayouts();

  return user;
}

/* --------------------------------
   USER INFORMATION
--------------------------------- */

function renderUserInformation(user) {
  const fullName =
    user.name || "";

  const firstName =
    fullName.trim().split(/\s+/)[0] ||
    "there";

  const nameTargets = [
    "#dashboardUserName",
    "#profileMenuName",
    "#profileName"
  ];

  nameTargets.forEach(
    (selector) => {
      const element = $(selector);

      if (element) {
        element.textContent =
          fullName;
      }
    }
  );

  const emailTargets = [
    "#dashboardUserEmail",
    "#profileMenuEmail",
    "#profileEmail"
  ];

  emailTargets.forEach(
    (selector) => {
      const element = $(selector);

      if (element) {
        element.textContent =
          user.email || "";
      }
    }
  );

  const paypalEmail =
    $("#profilePaypalEmail");

  if (paypalEmail) {
    paypalEmail.textContent =
      user.paypalEmail ||
      "Not provided";
  }

  const initials =
    firstName.charAt(0).toUpperCase();

  $$(".dashboardUserInitials")
    .forEach((element) => {
      element.textContent =
        initials || "M";
    });

  const welcome =
    $("#dashboardWelcomeName");

  if (welcome) {
    welcome.textContent =
      firstName;
  }
}

/* --------------------------------
   PUBLIC / DASHBOARD
--------------------------------- */

function showDashboard() {
  hide($("#publicSite"));
  show($("#dashboard"));
}

function showPublicSite() {
  show($("#publicSite"));
  hide($("#dashboard"));
}

/* --------------------------------
   PROFILE MENU
--------------------------------- */

function setupProfileMenu() {
  const trigger =
    $("#accountProfileTrigger");

  const menu =
    $("#accountProfileMenu");

  function toggleProfileMenu(event) {
    if (event) {
      event.stopPropagation();
    }

    if (!menu) {
      return;
    }

    menu.style.display =
      menu.style.display === "block"
        ? "none"
        : "block";
  }

  if (trigger && menu) {
    trigger.addEventListener(
      "click",
      toggleProfileMenu
    );

    document.addEventListener(
      "click",
      (event) => {
        if (
          !menu.contains(event.target) &&
          event.target !== trigger &&
          !trigger.contains(event.target)
        ) {
          hide(menu);
        }
      }
    );
  }

  const mobileProfile =
    $("#mobileProfileButton");

  if (mobileProfile && menu) {
    mobileProfile.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        menu.style.display =
          menu.style.display === "block"
            ? "none"
            : "block";
      }
    );
  }
}

/* --------------------------------
   LOGOUT
--------------------------------- */

async function logout() {
  try {
    await api(
      "/logout",
      {
        method: "POST"
      }
    );
  } catch {
    // Continue with local logout.
  }

  currentUser = null;
  selectedCircle = null;
  selectedMembership = null;
  payoutWeekMembership = null;

  localStorage.removeItem(
    "payacircle_pending_order"
  );

  closePayoutWeekModal();

  showPublicSite();

  hide($("#accountProfileMenu"));
}

function setupLogout() {
  [
    "#dashboardLogout",
    "#profileMenuLogout",
    "#logoutButton"
  ].forEach(
    (selector) => {
      $(selector)?.addEventListener(
        "click",
        logout
      );
    }
  );
}

/* --------------------------------
   ACCOUNT NAVIGATION
--------------------------------- */

function openAccountPanel(panelName) {
  $$("[data-panel]").forEach(
    (panel) => {
      panel.style.display =
        panel.dataset.panel ===
        panelName
          ? ""
          : "none";
    }
  );

  $$("[data-account-panel]").forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.accountPanel ===
          panelName
      );
    }
  );

  hide($("#accountProfileMenu"));

  if (
    panelName === "circles"
  ) {
    loadPublicCircles();
  }

  if (
    panelName === "payments" ||
    panelName === "contributions"
  ) {
    loadPayments();
  }

  if (
    panelName === "payouts"
  ) {
    loadPayouts();
  }
}

function setupAccountNavigation() {
  $$("[data-account-panel]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAccountPanel(
            button.dataset.accountPanel
          );
        }
      );
    });
}

/* --------------------------------
   MEMBERSHIPS
--------------------------------- */

function membershipStatusLabel(status) {
  const labels = {
    RESERVED:
      "Reserved",

    PAYMENT_PENDING:
      "Payment Pending",

    PAID:
      "Paid",

    PAYOUT_SCHEDULED:
      "Payout Scheduled",

    PAID_OUT:
      "Paid Out",

    CANCELLED:
      "Cancelled",

    REFUNDED:
      "Refunded"
  };

  return (
    labels[status] ||
    status ||
    "Unknown"
  );
}

function membershipNeedsPayoutSelection(
  membership
) {
  return (
    membership?.status === "PAID" &&
    !membership?.payoutDate
  );
}

function renderMemberships(
  memberships
) {
  const containers = [
    $("#dashboardCircles"),
    $("#circlesPageGrid")
  ].filter(Boolean);

  containers.forEach(
    (container) => {
      container.innerHTML = "";

      if (!memberships.length) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>No circles yet</h3>
            <p>Create or join a circle to get started.</p>
          </div>
        `;

        return;
      }

      memberships.forEach(
        (membership) => {
          const circle =
            membership.circle;

          const card =
            document.createElement(
              "div"
            );

          card.className =
            "circle-card";

          const amount =
            circle?.amountCents ||
            0;

          const status =
            membership.status;

          const needsPayoutSelection =
            membershipNeedsPayoutSelection(
              membership
            );

          card.innerHTML = `
            <div class="circle-card-content">

              <div class="eyebrow">
                ${escapeHTML(
                  circle?.type ||
                    "CIRCLE"
                )}
              </div>

              <h3>
                ${escapeHTML(
                  circle?.name ||
                    circle?.code ||
                    "PayaCircle"
                )}
              </h3>

              <p>
                Contribution:
                <strong>
                  ${money(amount)}
                </strong>
              </p>

              <p>
                Status:
                <strong>
                  ${escapeHTML(
                    membershipStatusLabel(
                      status
                    )
                  )}
                </strong>
              </p>

              ${
                membership.payoutDate
                  ? `
                    <p>
                      Payout:
                      <strong>
                        ${formatDate(
                          membership
                            .payoutDate
                            .payoutAt
                        )}
                      </strong>
                    </p>
                  `
                  : ""
              }

              ${
                needsPayoutSelection
                  ? `
                    <div class="payout-selection-notice">
                      <strong>
                        Your circle is full!
                      </strong>

                      <p>
                        Your weekly payout schedule is ready.
                        Choose your preferred payout week.
                      </p>
                    </div>
                  `
                  : ""
              }

              <div class="circle-card-actions">

                <button
                  class="ghost view-circle-button"
                  data-circle-id="${escapeHTML(
                    circle?.id || ""
                  )}"
                >
                  View Circle
                </button>

                ${
                  status ===
                  "PAYMENT_PENDING"
                    ? `
                      <button
                        class="primary pay-membership-button"
                        data-membership-id="${escapeHTML(
                          membership.id
                        )}"
                        data-circle-id="${escapeHTML(
                          circle?.id || ""
                        )}"
                      >
                        Make Payment
                      </button>
                    `
                    : ""
                }

                ${
                  needsPayoutSelection
                    ? `
                      <button
                        class="primary choose-payout-button"
                        data-membership-id="${escapeHTML(
                          membership.id
                        )}"
                        data-circle-id="${escapeHTML(
                          circle?.id || ""
                        )}"
                      >
                        Choose Payout Week
                      </button>
                    `
                    : ""
                }

                ${
                  status !==
                    "CANCELLED" &&
                  status !==
                    "REFUNDED" &&
                  status !==
                    "PAID_OUT"
                    ? `
                      <button
                        class="ghost cancel-membership-button"
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
            </div>
          `;

          container.appendChild(
            card
          );
        }
      );
    }
  );

  $$(".view-circle-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openCircleDetails(
            button.dataset.circleId
          );
        }
      );
    });

  $$(".pay-membership-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const membership =
            memberships.find(
              (item) =>
                item.id ===
                button.dataset
                  .membershipId
            );

          if (!membership) {
            return;
          }

          selectedMembership =
            membership;

          selectedCircle =
            membership.circle;

          await openPaymentPanel(
            membership.circle,
            membership
          );
        }
      );
    });

  $$(".choose-payout-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const membership =
            memberships.find(
              (item) =>
                item.id ===
                button.dataset
                  .membershipId
            );

          if (!membership) {
            return;
          }

          await choosePayoutWeek(
            membership
          );
        }
      );
    });

  $$(".cancel-membership-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          cancelMembership(
            button.dataset
              .membershipId
          );
        }
      );
    });
}

/* --------------------------------
   PAYOUT WEEK MODAL
--------------------------------- */

function openPayoutWeekModal() {
  const modal =
    $("#payoutWeekModal");

  if (!modal) {
    alert(
      "The payout week selector is unavailable. Please refresh the page."
    );

    return;
  }

  show(modal);

  document.body.classList.add(
    "modal-open"
  );
}

function closePayoutWeekModal() {
  const modal =
    $("#payoutWeekModal");

  if (modal) {
    hide(modal);
  }

  document.body.classList.remove(
    "modal-open"
  );

  payoutWeekMembership = null;
}

function renderPayoutWeekOptions(
  dates
) {
  const list =
    $("#payoutWeekList");

  const message =
    $("#payoutWeekMessage");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (message) {
    message.textContent = "";
  }

  if (!dates.length) {
    list.innerHTML = `
      <div class="empty-state compact">
        <div class="empty-icon">↗</div>

        <strong>
          No payout weeks available
        </strong>

        <span>
          Your payout schedule has not been created yet,
          or there are no payout weeks available.
        </span>
      </div>
    `;

    return;
  }

  dates.forEach(
    (date, index) => {
      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      const isReserved =
        Number(
          date.reserved || 0
        ) >=
        Number(
          date.capacity || 1
        );

      button.className =
        "payout-week-option";

      if (isReserved) {
        button.classList.add(
          "payout-week-unavailable"
        );

        button.disabled = true;
      }

      button.dataset.payoutDateId =
        date.id;

      const payoutDate =
        formatDate(
          date.payoutAt
        );

      const payoutTime =
        formatDateTime(
          date.payoutAt
        );

      button.innerHTML = `
        <span class="payout-week-number">
          ${index + 1}
        </span>

        <span class="payout-week-option-content">

          <strong>
            Week ${index + 1}
          </strong>

          <span>
            ${escapeHTML(
              payoutDate
            )}
          </span>

          <small>
            ${escapeHTML(
              payoutTime
            )}
          </small>

          ${
            isReserved
              ? `
                <em class="payout-week-status">
                  Already selected
                </em>
              `
              : `
                <em class="payout-week-status">
                  Available
                </em>
              `
          }

        </span>

        <span class="payout-week-arrow">
          ${
            isReserved
              ? "🔒"
              : "→"
          }
        </span>
      `;

      if (!isReserved) {
        button.addEventListener(
          "click",
          () => {
            selectPayoutWeek(
              date
            );
          }
        );
      }

      list.appendChild(
        button
      );
    }
  );
}

async function choosePayoutWeek(
  membership
) {
  if (!membership?.id) {
    alert(
      "We could not find your membership."
    );

    return;
  }

  const circle =
    membership.circle;

  if (!circle?.id) {
    alert(
      "We could not find your circle."
    );

    return;
  }

  payoutWeekMembership =
    membership;

  selectedMembership =
    membership;

  selectedCircle =
    circle;

  const circleName =
    $("#payoutWeekCircle");

  if (circleName) {
    circleName.innerHTML = `
      <strong>
        ${escapeHTML(
          circle.name ||
            circle.code ||
            "PayaCircle"
        )}
      </strong>

      <span>
        Contribution:
        ${money(
          circle.amountCents
        )}
      </span>
    `;
  }

  const intro =
    $("#payoutWeekIntro");

  if (intro) {
    intro.innerHTML = `
      <strong>
        Your circle is now full!
      </strong>

      <p>
        Your weekly payout schedule has been created.
        Choose the week you would prefer to receive your payout.
      </p>
    `;
  }

  const list =
    $("#payoutWeekList");

  if (list) {
    list.innerHTML = `
      <div class="payment-processing">
        <strong>
          Loading payout schedule...
        </strong>

        <p>
          Please wait while we load the available weeks.
        </p>
      </div>
    `;
  }

  const message =
    $("#payoutWeekMessage");

  if (message) {
    message.textContent = "";
  }

  openPayoutWeekModal();

  try {
    const dates =
      await api(
        `/circles/${encodeURIComponent(
          circle.id
        )}/dates`
      );

    renderPayoutWeekOptions(
      dates || []
    );
  } catch (error) {
    console.error(
      "Payout schedule error:",
      error
    );

    if (list) {
      list.innerHTML = `
        <div class="empty-state compact">
          <div class="empty-icon">!</div>

          <strong>
            Unable to load payout weeks
          </strong>

          <span>
            ${escapeHTML(
              error.message ||
                "Please try again."
            )}
          </span>
        </div>
      `;
    }

    if (message) {
      message.textContent =
        "";
    }
  }
}

async function selectPayoutWeek(
  payoutDate
) {
  const membership =
    payoutWeekMembership;

  if (!membership?.id) {
    alert(
      "Your membership could not be found."
    );

    return;
  }

  if (!payoutDate?.id) {
    alert(
      "That payout week is unavailable."
    );

    return;
  }

  const isReserved =
    Number(
      payoutDate.reserved || 0
    ) >=
    Number(
      payoutDate.capacity || 1
    );

  if (isReserved) {
    alert(
      "That payout week has already been selected."
    );

    return;
  }

  const buttons =
    $$(".payout-week-option");

  buttons.forEach(
    (button) => {
      button.disabled = true;
    }
  );

  const message =
    $("#payoutWeekMessage");

  if (message) {
    message.textContent =
      "Saving your payout week...";
  }

  try {
    const updatedMembership =
      await api(
        `/memberships/${encodeURIComponent(
          membership.id
        )}/payout-date`,
        {
          method: "POST",
          body: JSON.stringify({
            payoutDateId:
              payoutDate.id
          })
        }
      );

    selectedMembership =
      updatedMembership;

    const scheduledDate =
      updatedMembership?.payoutDate
        ?.payoutAt ||
      payoutDate.payoutAt;

    closePayoutWeekModal();

    alert(
      `Your payout week has been scheduled for ${formatDate(
        scheduledDate
      )}.`
    );

    await loadAccount();

    openAccountPanel(
      "payouts"
    );
  } catch (error) {
    console.error(
      "Payout week selection error:",
      error
    );

    buttons.forEach(
      (button) => {
        button.disabled = false;
      }
    );

    if (message) {
      message.textContent =
        error.message ||
        "Unable to schedule this payout week.";
    }
  }
}

function setupPayoutWeekModal() {
  $("#closePayoutWeekModal")
    ?.addEventListener(
      "click",
      closePayoutWeekModal
    );

  $("#cancelPayoutWeek")
    ?.addEventListener(
      "click",
      closePayoutWeekModal
    );

  $("#payoutWeekModal")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("#payoutWeekModal")
        ) {
          closePayoutWeekModal();
        }
      }
    );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closePayoutWeekModal();
      }
    }
  );
}

/* --------------------------------
   MEMBERSHIP CANCELLATION
--------------------------------- */

async function cancelMembership(
  membershipId
) {
  const confirmed =
    confirm(
      "Are you sure you want to cancel this circle membership?"
    );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      `/memberships/${encodeURIComponent(
        membershipId
      )}/cancel`,
      {
        method: "POST"
      }
    );

    alert(
      "Your circle membership has been cancelled."
    );

    await loadAccount();
  } catch (error) {
    alert(error.message);
  }
}

/* --------------------------------
   BALANCE
--------------------------------- */

function renderBalance(
  payments
) {
  const captured =
    payments
      .filter(
        (payment) =>
          payment.status ===
          "CAPTURED"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(
            payment.amountCents || 0
          ),
        0
      );

  const balanceTargets = [
    "#dashboardBalance",
    "#balanceAmount",
    "#accountAvailableBalance"
  ];

  balanceTargets.forEach(
    (selector) => {
      const element = $(selector);

      if (element) {
        element.textContent =
          money(captured);
      }
    }
  );

  const savings =
    $("#accountTotalSavings");

  if (savings) {
    savings.textContent =
      money(captured);
  }
}

/* --------------------------------
   PAYMENTS
--------------------------------- */

async function loadPayments() {
  try {
    const payments =
      await api("/payments");

    renderBalance(payments);

    const capturedPayments =
      payments.filter(
        (payment) =>
          payment.status ===
          "CAPTURED"
      );

    const pendingPayments =
      payments.filter(
        (payment) =>
          payment.status ===
          "CREATED" ||
          payment.status ===
          "APPROVED"
      );

    const contributionTotal =
      $("#contributionTotal");

    if (contributionTotal) {
      contributionTotal.textContent =
        money(
          capturedPayments.reduce(
            (total, payment) =>
              total +
              Number(
                payment.amountCents ||
                  0
              ),
            0
          )
        );
    }

    const contributionPaidCount =
      $("#contributionPaidCount");

    if (contributionPaidCount) {
      contributionPaidCount.textContent =
        capturedPayments.length;
    }

    const contributionPendingCount =
      $("#contributionPendingCount");

    if (contributionPendingCount) {
      contributionPendingCount.textContent =
        pendingPayments.length;
    }

    const containers = [
      $("#paymentsList"),
      $("#contributionsList"),
      $("#contributionTransactions"),
      $("#contributionsPageList")
    ].filter(Boolean);

    containers.forEach(
      (container) => {
        container.innerHTML = "";

        if (!payments.length) {
          container.innerHTML = `
            <div class="transaction-empty">
              <div class="transaction-empty-icon">
                ↙
              </div>

              <strong>
                No activity yet
              </strong>

              <span>
                Your contributions and payments
                will appear here.
              </span>
            </div>
          `;

          return;
        }

        payments.forEach(
          (payment) => {
            const item =
              document.createElement(
                "div"
              );

            item.className =
              "transaction-item";

            const status =
              String(
                payment.status ||
                  "UNKNOWN"
              ).toUpperCase();

            let statusLabel =
              "Pending";

            let statusClass =
              "pending";

            let icon =
              "↙";

            if (
              status ===
              "CAPTURED"
            ) {
              statusLabel =
                "Completed";

              statusClass =
                "completed";

              icon =
                "✓";
            } else if (
              status ===
              "FAILED"
            ) {
              statusLabel =
                "Failed";

              statusClass =
                "failed";

              icon =
                "!";
            } else if (
              status ===
              "REFUNDED"
            ) {
              statusLabel =
                "Refunded";

              statusClass =
                "refunded";

              icon =
                "↩";
            } else if (
              status ===
                "CREATED" ||
              status ===
                "APPROVED"
            ) {
              statusLabel =
                "Pending";

              statusClass =
                "pending";

              icon =
                "↙";
            }

            const circleName =
              payment.circle
                ?.name ||
              payment.circle
                ?.code ||
              "PayaCircle";

            item.innerHTML = `
              <div class="transaction-main">

                <div
                  class="transaction-icon ${statusClass}"
                >
                  ${icon}
                </div>

                <div class="transaction-details">

                  <strong>
                    Contribution
                  </strong>

                  <span class="transaction-circle">
                    ${escapeHTML(
                      circleName
                    )}
                  </span>

                  <span class="transaction-date">
                    ${formatDateTime(
                      payment.createdAt
                    )}
                  </span>

                </div>

              </div>

              <div class="transaction-right">

                <strong class="transaction-amount">
                  +${money(
                    payment.amountCents
                  )}
                </strong>

                <span
                  class="transaction-status ${statusClass}"
                >
                  <span class="transaction-status-dot"></span>
                  ${statusLabel}
                </span>

              </div>
            `;

            container.appendChild(
              item
            );
          }
        );
      }
    );
  } catch (error) {
    console.error(
      "Unable to load payments:",
      error
    );
  }
}

/* --------------------------------
   CIRCLE DETAILS
--------------------------------- */

async function openCircleDetails(
  circleId
) {
  try {
    const circle =
      await api(
        `/circles/${encodeURIComponent(
          circleId
        )}`
      );

    selectedCircle =
      circle;

    const modal =
      $("#circleDetailsModal");

    const content =
      $("#circleDetailsContent");

    if (!modal || !content) {
      return;
    }

    const memberCount =
      Number(
        circle._count
          ?.memberships ||
          0
      );

    const capacity =
      Number(
        circle.capacity ||
          0
      );

    const isFull =
      capacity > 0 &&
      memberCount >=
        capacity;

    content.innerHTML = `
      <div class="circle-details">

        <div class="eyebrow">
          ${escapeHTML(
            circle.type ||
              "CIRCLE"
          )}
        </div>

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
            ${money(
              circle.amountCents
            )}
          </strong>
        </p>

        <p>
          Members:
          <strong>
            ${memberCount}
            /
            ${capacity}
          </strong>
        </p>

        <p>
          Circle code:
          <strong>
            ${escapeHTML(
              circle.code ||
                ""
            )}
          </strong>
        </p>

        ${
          isFull
            ? `
              <div class="payout-selection-notice">
                <strong>
                  Circle Full
                </strong>

                <p>
                  This circle has reached its required number
                  of members and is no longer accepting new members.
                </p>
              </div>
            `
            : ""
        }

        <div class="circle-details-actions">

          ${
            isFull
              ? `
                <button
                  class="ghost"
                  type="button"
                  disabled
                >
                  Circle Full
                </button>
              `
              : `
                <button
                  id="joinCircleFromDetails"
                  class="primary"
                  type="button"
                >
                  Join Circle
                </button>
              `
          }

        </div>

      </div>
    `;

    show(modal);

    $("#joinCircleFromDetails")
      ?.addEventListener(
        "click",
        () => {
          closeCircleDetails();

          if (!currentUser) {
            openAuthModal(
              "login"
            );

            return;
          }

          openJoinCircle(
            circle
          );
        }
      );
  } catch (error) {
    alert(error.message);
  }
}

function closeCircleDetails() {
  hide(
    $("#circleDetailsModal")
  );
}

/* --------------------------------
   JOIN CIRCLE
--------------------------------- */

async function openJoinCircle(
  circle
) {
  if (!circle?.id) {
    alert(
      "We could not find this circle."
    );

    return;
  }

  try {
    const confirmed =
      confirm(
        `Join ${
          circle.name ||
          circle.code ||
          "this circle"
        } for ${money(
          circle.amountCents
        )}?`
      );

    if (!confirmed) {
      return;
    }

    const membership =
      await api(
        "/memberships",
        {
          method: "POST",
          body: JSON.stringify({
            circleId:
              circle.id
          })
        }
      );

    selectedCircle =
      circle;

    selectedMembership =
      membership;

    await loadAccount();

    const refreshedUser =
      await getCurrentUser();

    const refreshedMembership =
      refreshedUser?.memberships?.find(
        (item) =>
          item.id ===
          membership.id
      );

    if (
      refreshedMembership &&
      membershipNeedsPayoutSelection(
        refreshedMembership
      )
    ) {
      await choosePayoutWeek(
        refreshedMembership
      );

      return;
    }

    const paymentMembership =
      refreshedMembership ||
      membership;

    selectedMembership =
      paymentMembership;

    selectedCircle =
      paymentMembership.circle ||
      circle;

    if (
      paymentMembership.status ===
      "PAYMENT_PENDING"
    ) {
      await openPaymentPanel(
        selectedCircle,
        paymentMembership
      );
    } else {
      alert(
        "You have successfully joined the circle."
      );
    }
  } catch (error) {
    alert(error.message);
  }
}

/* --------------------------------
   CREATE CIRCLE MODAL
--------------------------------- */

function openCircleModal() {
  show($("#circleModal"));
}

function closeCircleModal() {
  hide($("#circleModal"));
}

function setupCircleModal() {
  $("#dashboardCreateCircle")
    ?.addEventListener(
      "click",
      openCircleModal
    );

  $("#circlesCreateButton")
    ?.addEventListener(
      "click",
      openCircleModal
    );

  $("#closeCircleModal")
    ?.addEventListener(
      "click",
      closeCircleModal
    );

  $("#cancelCircleModal")
    ?.addEventListener(
      "click",
      closeCircleModal
    );

  $("#circleModal")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("#circleModal")
        ) {
          closeCircleModal();
        }
      }
    );
}

/* --------------------------------
   CREATE CIRCLE
--------------------------------- */

async function createCircle(
  event
) {
  event.preventDefault();

  const name =
    $("#circleName")?.value.trim();

  const type =
    $("#circleType")?.value;

  const amountUsd =
    Number(
      $("#circleAmount")?.value
    );

  const capacity =
    Number(
      $("#circleCapacity")?.value
    );

  const message =
    $("#circleMessage");

  if (message) {
    message.textContent = "";
  }

  try {
    const result =
      await api(
        "/circles",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            type,
            amountUsd,
            capacity
          })
        }
      );

    selectedCircle =
      result;

    selectedMembership =
      result.membership ||
      null;

    closeCircleModal();

    if (message) {
      message.textContent =
        "";
    }

    await loadAccount();

    if (
      result.membership
    ) {
      await openPaymentPanel(
        result,
        result.membership
      );
    } else {
      alert(
        "Circle created successfully."
      );
    }
  } catch (error) {
    if (message) {
      message.textContent =
        error.message;
    } else {
      alert(error.message);
    }
  }
}

/* --------------------------------
   PAYMENT PANEL
--------------------------------- */

async function openPaymentPanel(
  circle,
  membership
) {
  if (!circle) {
    alert(
      "Please select a circle first."
    );

    return;
  }

  selectedCircle =
    circle;

  selectedMembership =
    membership || null;

  const panel =
    $("#paymentPanel");

  if (!panel) {
    alert(
      "Payment panel is unavailable."
    );

    return;
  }

  show(panel);

  await renderPaymentDetails(
    circle,
    membership
  );

  const button =
    $("#paypalButton");

  if (button) {
    button.disabled = false;
    button.textContent =
      "Continue with PayPal";
  }
}

async function renderPaymentDetails(
  circle,
  membership
) {
  const details =
    $("#paymentDetails");

  if (!details) {
    return;
  }

  const contributionCents =
    Number(
      circle?.amountCents || 0
    );

  const capacity =
    Number(
      circle?.capacity || 1
    );

  const grossPayoutCents =
    contributionCents *
    capacity;

  let bankerFeeBps = 700;

  try {
    const feeSettings =
      await api(
        "/settings/banker-fee"
      );

    bankerFeeBps =
      Number(
        feeSettings?.bankerFeeBps
      );

    if (
      !Number.isFinite(
        bankerFeeBps
      )
    ) {
      bankerFeeBps = 700;
    }
  } catch (error) {
    console.error(
      "Unable to load Banker Fee:",
      error
    );
  }

  const bankerFeePercent =
    bankerFeeBps / 100;

  const bankerFeeCents =
    Math.round(
      grossPayoutCents *
        bankerFeeBps /
        10000
    );

  const payoutAfterFeeCents =
    Math.max(
      0,
      grossPayoutCents -
        bankerFeeCents
    );

  details.innerHTML = `
    <div class="payment-detail-row">
      <span>Circle</span>
      <strong>
        ${escapeHTML(
          circle?.name ||
            circle?.code ||
            "PayaCircle"
        )}
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>Your Contribution</span>
      <strong>
        ${money(
          contributionCents
        )}
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>Circle Size</span>
      <strong>
        ${capacity} member${
          capacity === 1
            ? ""
            : "s"
        }
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>Scheduled Gross Payout</span>
      <strong>
        ${money(
          grossPayoutCents
        )}
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>PayaCircle Banker Fee</span>
      <strong>
        ${bankerFeePercent.toFixed(2)}%
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>Banker Fee</span>
      <strong>
        −${money(
          bankerFeeCents
        )}
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>Your Payout After Banker Fee</span>
      <strong>
        ${money(
          payoutAfterFeeCents
        )}
      </strong>
    </div>

    <div class="payment-detail-row">
      <span>Status</span>
      <strong>
        ${escapeHTML(
          membershipStatusLabel(
            membership?.status
          )
        )}
      </strong>
    </div>

    ${
      membership?.payoutDate
        ? `
          <div class="payment-detail-row">
            <span>Payout Date</span>
            <strong>
              ${formatDate(
                membership
                  .payoutDate
                  .payoutAt
              )}
            </strong>
          </div>
        `
        : ""
    }
  `;
}

/* --------------------------------
   PAYPAL CREATE ORDER
--------------------------------- */

async function startPayPalPayment() {
  if (!selectedCircle) {
    alert(
      "Please select a circle first."
    );

    return;
  }

  if (
    !selectedMembership?.id
  ) {
    alert(
      "Your membership could not be found. Please refresh the page and try again."
    );

    return;
  }

  const button =
    $("#paypalButton");

  if (button) {
    button.disabled = true;
    button.textContent =
      "Connecting to PayPal...";
  }

  try {
    const payload = {
      circleId:
        selectedCircle.id,

      membershipId:
        selectedMembership.id
    };

    const result =
      await api(
        "/paypal/create-order",
        {
          method: "POST",
          body: JSON.stringify(
            payload
          )
        }
      );

    if (!result.orderId) {
      throw new Error(
        "PayPal did not return an order ID."
      );
    }

    localStorage.setItem(
      "payacircle_pending_order",
      JSON.stringify({
        orderId:
          result.orderId,

        circleId:
          selectedCircle.id,

        membershipId:
          selectedMembership.id
      })
    );

    if (
      result.approvalUrl
    ) {
      window.location.href =
        result.approvalUrl;

      return;
    }

    throw new Error(
      "PayPal did not provide an approval link."
    );
  } catch (error) {
    console.error(
      "PayPal payment error:",
      error
    );

    alert(
      error.message ||
        "Unable to start PayPal payment."
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        "Continue with PayPal";
    }
  }
}

/* --------------------------------
   PAYPAL RETURN / CAPTURE
--------------------------------- */

async function handlePayPalReturn() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const paypalStatus =
    params.get("paypal");

  const urlOrderId =
    params.get("token");

  const stored =
    localStorage.getItem(
      "payacircle_pending_order"
    );

  let pending = null;

  try {
    pending =
      stored
        ? JSON.parse(stored)
        : null;
  } catch {
    pending = null;
  }

  if (
    paypalStatus ===
    "cancel"
  ) {
    localStorage.removeItem(
      "payacircle_pending_order"
    );

    alert(
      "Your PayPal payment was cancelled. Your membership is still payment-pending."
    );

    cleanPayPalUrl();

    return;
  }

  const orderId =
    urlOrderId ||
    pending?.orderId;

  if (
    !orderId &&
    paypalStatus !==
      "success"
  ) {
    return;
  }

  if (!orderId) {
    alert(
      "We could not find the PayPal order. Please try the payment again."
    );

    return;
  }

  const paymentPanel =
    $("#paymentPanel");

  if (paymentPanel) {
    show(paymentPanel);

    const details =
      $("#paymentDetails");

    if (details) {
      details.innerHTML = `
        <div class="payment-processing">
          <strong>
            Confirming your PayPal payment...
          </strong>

          <p>
            Please wait while PayaCircle verifies your payment.
          </p>
        </div>
      `;
    }
  }

  try {
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

    if (
      result.status ===
      "CAPTURED"
    ) {
      localStorage.removeItem(
        "payacircle_pending_order"
      );

      cleanPayPalUrl();

      const refreshedUser =
        await loadAccount();

      hide(
        $("#paymentPanel")
      );

      alert(
        "Payment confirmed! Your PayaCircle membership is now active."
      );

      let membership = null;

      if (
        pending?.membershipId
      ) {
        membership =
          refreshedUser?.memberships?.find(
            (item) =>
              item.id ===
              pending.membershipId
          ) || null;
      }

      if (!membership) {
        membership =
          [...(
            refreshedUser?.memberships ||
            []
          )]
            .filter(
              (item) =>
                item.status ===
                "PAID"
            )
            .sort(
              (a, b) =>
                new Date(
                  b.updatedAt ||
                    b.createdAt
                ) -
                new Date(
                  a.updatedAt ||
                    a.createdAt
                )
            )[0] || null;
      }

      if (
        membership &&
        membershipNeedsPayoutSelection(
          membership
        )
      ) {
        await choosePayoutWeek(
          membership
        );
      }

      return;
    }

    throw new Error(
      "PayPal payment could not be confirmed."
    );
  } catch (error) {
    console.error(
      "PayPal capture error:",
      error
    );

    alert(
      error.message ||
        "We could not confirm your PayPal payment."
    );

    if (paymentPanel) {
      const details =
        $("#paymentDetails");

      if (details) {
        details.innerHTML = `
          <div class="payment-error">

            <strong>
              Payment confirmation needs attention
            </strong>

            <p>
              ${escapeHTML(
                error.message ||
                  "Please try again."
              )}
            </p>

          </div>
        `;
      }
    }

    cleanPayPalUrl();
  }
}

function cleanPayPalUrl() {
  const cleanUrl =
    window.location.origin +
    window.location.pathname;

  window.history.replaceState(
    {},
    document.title,
    cleanUrl
  );
}

/* --------------------------------
   CANCEL PAYMENT PANEL
--------------------------------- */

function cancelPayment() {
  hide(
    $("#paymentPanel")
  );

  selectedCircle = null;
  selectedMembership = null;
}

function setupPayment() {
  $("#paypalButton")
    ?.addEventListener(
      "click",
      startPayPalPayment
    );

  $("#cancelPayment")
    ?.addEventListener(
      "click",
      cancelPayment
    );
}

/* --------------------------------
   MODALS
--------------------------------- */

function setupModals() {
  $("#closeCircleDetailsModal")
    ?.addEventListener(
      "click",
      closeCircleDetails
    );

  $("#circleDetailsModal")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("#circleDetailsModal")
        ) {
          closeCircleDetails();
        }
      }
    );

  $("#circleModal")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("#circleModal")
        ) {
          closeCircleModal();
        }
      }
    );

  $("#paymentPanel")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("#paymentPanel")
        ) {
          cancelPayment();
        }
      }
    );
}

/* --------------------------------
   FORMS
--------------------------------- */

function setupForms() {
  $("#registerForm")
    ?.addEventListener(
      "submit",
      registerUser
    );

  $("#loginForm")
    ?.addEventListener(
      "submit",
      loginUser
    );

  $("#circleForm")
    ?.addEventListener(
      "submit",
      createCircle
    );
}

/* --------------------------------
   PUBLIC AUTH BUTTONS
--------------------------------- */

function setupPublicAuthButtons() {
  $$("[data-auth='login']")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAuthModal(
            "login"
          );
        }
      );
    });

  $$("[data-auth='register']")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAuthModal(
            "register"
          );
        }
      );
    });

  $$(".login-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAuthModal(
            "login"
          );
        }
      );
    });

  $$(".register-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAuthModal(
            "register"
          );
        }
      );
    });

  $("#headerSignIn")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "login"
        );
      }
    );

  $("#heroSignIn")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "login"
        );
      }
    );

  $("#headerGetStarted")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "register"
        );
      }
    );

  $("#heroGetStarted")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "register"
        );
      }
    );

  $("#promoGetStarted")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "register"
        );
      }
    );

  $("#finalGetStarted")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "register"
        );
      }
    );

  $("#footerSignIn")
    ?.addEventListener(
      "click",
      () => {
        openAuthModal(
          "login"
        );
      }
    );
}

/* --------------------------------
   INIT
--------------------------------- */

async function init() {
  setupAuthModal();
  setupProfileMenu();
  setupLogout();
  setupAccountNavigation();

  setupCircleModal();
  setupPayment();
  setupModals();
  setupPayoutWeekModal();
  setupForms();

  setupPublicAuthButtons();

  const paypalParams =
    new URLSearchParams(
      window.location.search
    );

  const hasPayPalReturn =
    paypalParams.has("paypal") ||
    paypalParams.has("token");

  const user =
    await getCurrentUser();

  if (user) {
    currentUser = user;

    renderUserInformation(
      user
    );

    showDashboard();

    renderMemberships(
      user.memberships || []
    );

    await loadPayments();
    await loadPayouts();

    if (hasPayPalReturn) {
      await handlePayPalReturn();
    }
  } else {
    showPublicSite();
  }

  loadPublicCircles().catch(
    () => {}
  );
}

document.addEventListener(
  "DOMContentLoaded",
  init
);

/* --------------------------------
   LEADOUT AI SUPPORT
--------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById(
    "leadoutToggle"
  );

  const chat = document.getElementById(
    "leadoutChat"
  );

  const close = document.getElementById(
    "leadoutClose"
  );

  const form = document.getElementById(
    "leadoutForm"
  );

  const input = document.getElementById(
    "leadoutInput"
  );

  const messages = document.getElementById(
    "leadoutMessages"
  );

  if (
    !toggle ||
    !chat ||
    !close ||
    !form ||
    !input ||
    !messages
  ) {
    return;
  }

  const conversation = [];

  function escapeLeadoutHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function addMessage(role, text) {
    const message =
      document.createElement("div");

    message.className =
      `leadout-message ${role}`;

    const label =
      role === "user"
        ? "You"
        : "LEADOUT";

    message.innerHTML = `
      <strong>${label}</strong>
      <p>${escapeLeadoutHTML(text).replace(
        /\n/g,
        "<br>"
      )}</p>
    `;

    messages.appendChild(message);

    messages.scrollTop =
      messages.scrollHeight;
  }

  function setChatOpen(open) {
    chat.classList.toggle(
      "open",
      open
    );

    toggle.setAttribute(
      "aria-expanded",
      String(open)
    );

    chat.setAttribute(
      "aria-hidden",
      String(!open)
    );

    if (open) {
      setTimeout(() => {
        input.focus();
      }, 100);
    }
  }

  toggle.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      setChatOpen(
        !chat.classList.contains("open")
      );
    }
  );

  close.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      setChatOpen(false);
    }
  );

  async function askLeadout(question) {
    const trimmed =
      String(question || "").trim();

    if (!trimmed) {
      return;
    }

    addMessage(
      "user",
      trimmed
    );

    conversation.push({
      role: "user",
      content: trimmed
    });

    input.value = "";
    input.disabled = true;

    const sendButton =
      form.querySelector(
        "button[type='submit']"
      );

    if (sendButton) {
      sendButton.disabled = true;
    }

    const typing =
      document.createElement("div");

    typing.className =
      "leadout-message bot leadout-typing";

    typing.innerHTML = `
      <strong>LEADOUT</strong>
      <p>Thinking...</p>
    `;

    messages.appendChild(typing);

    messages.scrollTop =
      messages.scrollHeight;

    try {
      const response =
        await fetch(
          "/api/leadout/chat",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              messages:
                conversation
            })
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      typing.remove();

      if (
        !response.ok ||
        !data.answer
      ) {
        throw new Error(
          data.error ||
          "LEADOUT is temporarily unavailable."
        );
      }

      conversation.push({
        role: "assistant",
        content: data.answer
      });

      addMessage(
        "bot",
        data.answer
      );
    } catch (error) {
      console.error(
        "LEADOUT chat error:",
        error
      );

      typing.remove();

      addMessage(
        "bot",
        "I'm having trouble connecting right now. Please try again in a moment."
      );
    } finally {
      input.disabled = false;

      if (sendButton) {
        sendButton.disabled = false;
      }

      input.focus();
    }
  }

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      askLeadout(input.value);
    }
  );

  document
    .querySelectorAll(
      "[data-leadout-question]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          askLeadout(
            button.dataset
              .leadoutQuestion
          );
        }
      );
    });
});
