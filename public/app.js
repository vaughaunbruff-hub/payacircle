const API = "/api";

let currentUser = null;
let selectedCircle = null;
let selectedMembership = null;

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

  $$("[data-close-auth]").forEach((button) => {
    button.addEventListener(
      "click",
      closeAuthModal
    );
  });
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
      `Welcome to PayaCircle, ${user.name.split(" ")[0]}!`
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

  nameTargets.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent =
        fullName;
    }
  });

  const emailTargets = [
    "#dashboardUserEmail",
    "#profileMenuEmail",
    "#profileEmail"
  ];

  emailTargets.forEach((selector) => {
    const element = $(selector);

    if (element) {
      element.textContent =
        user.email || "";
    }
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

  /*
    Mobile M button:
    Open the same account menu instead
    of immediately opening Profile.
  */
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

  localStorage.removeItem(
    "payacircle_pending_order"
  );

  showPublicSite();

  hide($("#accountProfileMenu"));
}

function setupLogout() {
  [
    "#dashboardLogout",
    "#profileMenuLogout",
    "#logoutButton"
  ].forEach((selector) => {
    $(selector)?.addEventListener(
      "click",
      logout
    );
  });
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
    PAYMENT_PENDING:
      "Payment Pending",

    PAID:
      "Paid",

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
                  status !==
                    "CANCELLED" &&
                  status !==
                    "REFUNDED" &&
                  status !==
                    "PAID"
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
    "#balanceAmount"
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
}

/* --------------------------------
   PAYMENTS
--------------------------------- */

async function loadPayments() {
  try {
    const payments =
      await api("/payments");

    renderBalance(payments);

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
            <div class="empty-state">
              <h3>No payments yet</h3>
              <p>Your contribution payments will appear here.</p>
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

            item.innerHTML = `
              <div>
                <strong>
                  ${escapeHTML(
                    payment.circle
                      ?.name ||
                      payment.circle
                        ?.code ||
                      "PayaCircle"
                  )}
                </strong>

                <div>
                  ${formatDateTime(
                    payment.createdAt
                  )}
                </div>
              </div>

              <div>
                <strong>
                  ${money(
                    payment.amountCents
                  )}
                </strong>

                <div>
                  ${escapeHTML(
                    payment.status ||
                      "Unknown"
                  )}
                </div>
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
   PAYOUTS
--------------------------------- */

async function loadPayouts() {
  try {
    const payouts =
      await api("/payouts");

    const containers = [
      $("#payoutsList"),
      $("#payoutTimeline")
    ].filter(Boolean);

    containers.forEach(
      (container) => {
        container.innerHTML = "";

        if (!payouts.length) {
          container.innerHTML = `
            <div class="empty-state">
              <h3>No payouts yet</h3>
              <p>Your scheduled and completed payouts will appear here.</p>
            </div>
          `;

          return;
        }

        payouts.forEach(
          (payout) => {
            const item =
              document.createElement(
                "div"
              );

            item.className =
              "payout-item";

            item.innerHTML = `
              <div>
                <strong>
                  ${escapeHTML(
                    payout.circle
                      ?.name ||
                      payout.circle
                        ?.code ||
                      "PayaCircle"
                  )}
                </strong>

                <div>
                  ${
                    payout.payoutDate
                      ? formatDate(
                          payout
                            .payoutDate
                            .payoutAt
                        )
                      : "—"
                  }
                </div>
              </div>

              <div>
                <strong>
                  ${money(
                    payout.netAmountCents
                  )}
                </strong>

                ${
                  Number(
                    payout.bankerFeeCents || 0
                  ) > 0
                    ? `
                      <div>
                        Banker Fee:
                        ${money(
                          payout.bankerFeeCents
                        )}
                      </div>
                    `
                    : ""
                }

                <div>
                  Status:
                  ${escapeHTML(
                    payout.status ||
                      "Scheduled"
                  )}
                </div>
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
      "Unable to load payouts:",
      error
    );
  }
}
/* --------------------------------
   PUBLIC CIRCLES
--------------------------------- */

async function loadPublicCircles() {
  try {
    const circles =
      await api("/circles");

    const containers = [
      $("#publicCircles"),
      $("#publicCircleGrid")
    ].filter(Boolean);

    containers.forEach(
      (container) => {
        container.innerHTML = "";

        circles.forEach(
          (circle) => {
            const card =
              document.createElement(
                "div"
              );

            card.className =
              "circle-card";

            card.innerHTML = `
              <div class="circle-card-content">
                <div class="eyebrow">
                  ${escapeHTML(
                    circle.type ||
                      "CIRCLE"
                  )}
                </div>

                <h3>
                  ${escapeHTML(
                    circle.name ||
                      circle.code
                  )}
                </h3>

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
                    ${
                      circle._count
                        ?.memberships ||
                      0
                    }
                    /
                    ${
                      circle.capacity ||
                      0
                    }
                  </strong>
                </p>

                <button
                  class="primary public-view-circle"
                  data-circle-id="${escapeHTML(
                    circle.id
                  )}"
                >
                  View Circle
                </button>
              </div>
            `;

            container.appendChild(
              card
            );
          }
        );
      }
    );

    $$(".public-view-circle")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            openCircleDetails(
              button.dataset
                .circleId
            );
          }
        );
      });
  } catch (error) {
    console.error(
      "Unable to load circles:",
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
            ${
              circle._count
                ?.memberships ||
              0
            }
            /
            ${
              circle.capacity ||
              0
            }
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

        <div class="circle-details-actions">
          <button
            id="joinCircleFromDetails"
            class="primary"
          >
            Join Circle
          </button>
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

async function openJoinCircle(circle) {
  try {
    const dates = await api(
      `/circles/${encodeURIComponent(circle.id)}/dates`
    );

    const availableDates = dates.filter(
      (date) =>
        Number(date.reserved || 0) <
        Number(date.capacity || 1)
    );

    if (!availableDates.length) {
      alert(
        "There are no available payout weeks for this circle."
      );

      return;
    }

    const confirmed = confirm(
      `Join ${circle.name || circle.code} for ${money(
        circle.amountCents
      )}?`
    );

    if (!confirmed) {
      return;
    }

    const payoutOptions = availableDates
      .map(
        (date, index) =>
          `${index + 1}. ${formatDate(date.payoutAt)}`
      )
      .join("\n");

    const selectedNumber = prompt(
      `Choose your preferred payout week.\n\n` +
        payoutOptions +
        `\n\nEnter the number of your preferred week:`
    );

    if (!selectedNumber) {
      return;
    }

    const selectedIndex =
      Number(selectedNumber) - 1;

    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= availableDates.length
    ) {
      alert(
        "Please choose a valid payout week."
      );

      return;
    }

    const selectedDate =
      availableDates[selectedIndex];

    const membership = await api(
      "/memberships",
      {
        method: "POST",
        body: JSON.stringify({
          circleId: circle.id,
          payoutDateId: selectedDate.id
        })
      }
    );

    selectedCircle = circle;
    selectedMembership = membership;

    await loadAccount();

    await openPaymentPanel(
      circle,
      membership
    );
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

    /*
      The creator is automatically
      added to the circle by the
      backend with PAYMENT_PENDING.

      Immediately show the payment
      panel so they can pay.
    */

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

  selectedCircle = circle;
  selectedMembership = membership || null;

  const panel = $("#paymentPanel");

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

  const button = $("#paypalButton");

  if (button) {
    button.disabled = false;
    button.textContent =
      "Continue with PayPal";
  }
}
/* --------------------------------
   PAYMENT PANEL
--------------------------------- */
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
      contributionCents *
        bankerFeeBps /
        10000
    );

  const payoutAfterFeeCents =
    Math.max(
      0,
      contributionCents -
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
      <span>Contribution</span>
      <strong>
        ${money(
          contributionCents
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
      <span>Amount after Banker Fee</span>
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
            <span>Payout date</span>
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
        selectedCircle.id
    };

    if (
      selectedMembership?.id
    ) {
      payload.membershipId =
        selectedMembership.id;
    }

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

    /*
      Save the order ID before leaving
      PayaCircle. PayPal will redirect
      back to our application afterward.
    */

    localStorage.setItem(
      "payacircle_pending_order",
      JSON.stringify({
        orderId:
          result.orderId,

        circleId:
          selectedCircle.id,

        membershipId:
          selectedMembership?.id ||
          null
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

      alert(
        "Payment confirmed! Your PayaCircle membership is now active."
      );

      cleanPayPalUrl();

      await loadAccount();

      hide(
        $("#paymentPanel")
      );

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
  setupForms();

  setupPublicAuthButtons();

  /*
    Check whether PayPal has returned
    the user to PayaCircle before
    loading the normal account state.
  */

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

  /*
    Load public circles in the
    background where available.
  */

  loadPublicCircles().catch(
    () => {}
  );
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
