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

function showLogin() {
  showModal(`
    <label>MEMBER LOGIN</label>
    <h2>Welcome back</h2>

    <input id="loginEmail" type="email" placeholder="Email">
    <input id="loginPassword" type="password" placeholder="Password">

    <button id="loginSubmit" class="primary">Sign in</button>

    <p>
      New member?
      <a href="#" id="switchToRegister">Create an account</a>
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

    <input id="registerName" type="text" placeholder="Full name">
    <input id="registerEmail" type="email" placeholder="Email">
    <input id="registerPassword" type="password" placeholder="Password (10+ characters)">

    <button id="registerSubmit" class="primary">Create account</button>

    <p>
      Already a member?
      <a href="#" id="switchToLogin">Sign in</a>
    </p>

    <small>
      After creating your account, you can create or join an eligible circle.
    </small>
  `);

  get("registerSubmit").addEventListener("click", register);

  get("switchToLogin").addEventListener("click", event => {
    event.preventDefault();
    showLogin();
  });
}

function showCreate() {
  showModal(`
    <label>CREATE A CIRCLE</label>
    <h2>Your group, your plan</h2>

    <input id="cname" type="text" placeholder="Circle name">

    <select id="ctype">
      <option value="FAMILY">Family — 10+ members</option>
      <option value="FRIENDS">Friends — 15+ members</option>
      <option value="SOCIAL_MEDIA">Social Media — 50+ members</option>
      <option value="CUSTOM">Custom — choose your size</option>
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
      <option value="5">5</option>
      <option value="10">10</option>
      <option value="15">15</option>
      <option value="20">20</option>
      <option value="25">25</option>
      <option value="30">30</option>
      <option value="35">35</option>
      <option value="40">40</option>
      <option value="45">45</option>
      <option value="50">50</option>
      <option value="55">55</option>
      <option value="60">60</option>
      <option value="65">65</option>
      <option value="70">70</option>
      <option value="75">75</option>
      <option value="80">80</option>
      <option value="85">85</option>
      <option value="90">90</option>
      <option value="95">95</option>
      <option value="100">100</option>
    </select>

    <button id="createCircleSubmit" class="primary">
      Create circle
    </button>

    <small>
      Contributions are $5–$100 USD in $5 increments.
    </small>
  `);

  get("createCircleSubmit").addEventListener("click", createCircle);
}

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

    alert("Signed in successfully.");

    load();
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

    alert("Account created successfully.");

    load();
  } catch (e) {
    alert(e.message);
  }
}

async function createCircle() {
  try {
    const name = get("cname").value.trim();
    const type = get("ctype").value;
    const capacity = Number(get("capacity").value);
    const amountUsd = Number(get("amount").value);

    const c = await api("/api/circles", {
      method: "POST",
      body: JSON.stringify({
        name,
        type,
        capacity,
        amountUsd
      })
    });

    hideModal();

    alert(`Circle ${c.name} created.`);

    load();
  } catch (e) {
    alert(e.message);
  }
}

async function load() {
  try {
    const circles = await api("/api/circles");

    const el = get("circlesGrid");

    if (!el) return;

    if (!circles.length) {
      el.innerHTML = `
        <div class="card">
          <h3>No circles available yet</h3>
          <p>Create an account to start your own savings circle.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = circles.map(c => `
      <article class="card">
        <label>${labels[c.type] || c.type}</label>

        <h3>${money(c.amountCents)}</h3>

        <p>
          ${c.capacity}-member circle ·
          ${c._count.memberships}/${c.capacity} reserved
        </p>

        <button
          class="view-circle"
          data-circle-id="${c.id}"
        >
          View payout dates
        </button>
      </article>
    `).join("");

    document.querySelectorAll(".view-circle").forEach(button => {
      button.addEventListener("click", () => {
        selectCircle(button.dataset.circleId);
      });
    });

  } catch (e) {
    console.error("Unable to load circles:", e);
  }
}

async function selectCircle(id) {
  try {
    const dates = await api(`/api/circles/${encodeURIComponent(id)}/dates`);

    if (!dates.length) {
      showModal(`
        <label>SCHEDULED PAYOUT</label>
        <h2>No payout dates yet</h2>
        <p>This circle does not have payout dates configured yet.</p>
      `);

      return;
    }

    showModal(`
      <label>SCHEDULED PAYOUT</label>

      <h2>Choose your date</h2>

      <p>
        Pick an available scheduled payout position.
        Your contribution is processed separately through PayPal.
      </p>

      <div id="payoutDates">
        ${dates.slice(0, 12).map(d => `
          <button
            class="primary payout-date"
            data-date-id="${d.id}"
            style="width:100%;margin:5px 0;padding:12px"
          >
            ${new Date(d.payoutAt).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric"
            })}
            · ${d.reserved}/${d.capacity}
          </button>
        `).join("")}
      </div>
    `);

    document.querySelectorAll(".payout-date").forEach(button => {
      button.addEventListener("click", () => {
        alert("Please sign in first, then reserve this payout date.");
      });
    });

  } catch (e) {
    alert(e.message);
  }
}

function setupNavigation() {

  const registerButtons = document.querySelectorAll(
    ".nav-cta, .app-promo .cta, .final-cta .cta"
  );

  registerButtons.forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      showRegister();
    });
  });

  const loginButton = document.querySelector(".nav-login");

  if (loginButton) {
    loginButton.addEventListener("click", event => {
      event.preventDefault();
      showLogin();
    });
  }

  const howButton = document.querySelector(".hero .ghost");

  if (howButton) {
    howButton.addEventListener("click", event => {
      event.preventDefault();

      const section = document.querySelector("#how");

      if (section) {
        section.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  }

  const closeButton = document.querySelector(".modal .x");

  if (closeButton) {
    closeButton.addEventListener("click", hideModal);
  }

  const modal = get("modal");

  if (modal) {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        hideModal();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  load();
});
