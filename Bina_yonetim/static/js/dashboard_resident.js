const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const fmtMoney = (v) => `₺${Number(v || 0).toLocaleString("tr-TR")}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/* -----------------------------
   0) DASHBOARD LAYOUT RENDER
------------------------------ */
function renderDashboardLayout() {
  const main = qs("#mainContent");
  main.innerHTML = `
    <header class="topbar">
      <div>
        <h1>Tekrar Hoş Geldiniz!</h1>
        <p>Ödeme durumunuz ve son güncellemeler burada.</p>
      </div>
      <div class="user-info">
        <strong id="userName">Kullanıcı</strong><br>
        <span id="buildingName">Bina</span><br>
        <small id="userRole"></small>
      </div>
    </header>

    <section class="cards"></section>

    <section class="tables">
      <div class="table-box">
        <h2>Yaklaşan Ödemeler</h2>
        <ul id="paymentsList"></ul>
      </div>
      <div class="table-box">
        <h2>Son Duyurular</h2>
        <ul id="announcementsList"></ul>
      </div>
    </section>
  `;
}

/* -----------------------------
   1) USER INFO (/api/me/)
------------------------------ */
async function loadUser() {
  const res = await fetch("/api/me/", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    localStorage.removeItem("access");
    return (window.location.href = "/login/");
  }

  const data = await res.json();
  const userNameEl = qs("#userName");
  const buildingEl = qs("#buildingName");
  const roleEl = qs("#userRole");

  if (userNameEl) {
    userNameEl.textContent = `${data.first_name} ${data.last_name}`;
    buildingEl.textContent = data.building_name || "-";
    roleEl.innerHTML = `<span class="role-tag">${data.role}</span>`;
  }

  window._ME = data;
}

/* -----------------------------
   2) RESIDENT DASHBOARD API
------------------------------ */
async function loadResidentDashboard() {
  const res = await fetch("/api/resident/dashboard/", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error("Dashboard verileri alınamadı");
    return;
  }

  const data = await res.json();
  const cards = qs(".cards");
  if (!cards) return;

  // Kartlar
  cards.innerHTML = `
    <div class="card green">
      <h3>Mevcut Bakiye</h3>
      <p class="value">${fmtMoney(data.balance)}</p>
      <small>${data.balance === 0 ? "Tüm ödemeler güncel!" : "Ödenmemiş aidatlarınız var"}</small>
    </div>

    <div class="card yellow">
      <h3>Sonraki Ödeme</h3>
      <p class="value">${
        data.next_due ? fmtMoney(data.next_due.amount) : "₺0"
      }</p>
      <small>
        ${
          data.next_due
            ? `${fmtDate(data.next_due.due_date)} son tarih`
            : "Yaklaşan ödeme görünmüyor"
        }
      </small>
    </div>

    <div class="card blue">
      <h3>Son Ödeme</h3>
      <p class="value">${
        data.last_payment ? fmtMoney(data.last_payment.amount) : "₺0"
      }</p>
      <small>
        ${
          data.last_payment
            ? `${fmtDate(data.last_payment.paid_date)} tarihinde ödendi`
            : "Henüz ödeme yapılmamış"
        }
      </small>
    </div>
  `;

  // Yaklaşan ödemeler
  const payList = qs("#paymentsList");
  if (payList) {
    payList.innerHTML = "";
    if (!data.upcoming_dues.length) {
      payList.innerHTML = "<li><span class='text'>Yaklaşan ödeme yok</span></li>";
    } else {
      data.upcoming_dues.forEach((d) => {
        payList.innerHTML += `
          <li>
            <span class="text">${fmtDate(d.month)} – ${fmtMoney(d.amount)}</span>
            <span class="tag ${d.status}">${d.status}</span>
          </li>
        `;
      });
    }
  }

  // Son duyurular
  const annList = qs("#announcementsList");
  if (annList) {
    annList.innerHTML = "";
    if (!data.announcements.length) {
      annList.innerHTML = "<li><span class='text'>Duyuru bulunamadı</span></li>";
    } else {
      data.announcements.forEach((a) => {
        annList.innerHTML += `
          <li>
            <span class="text">${a.title}</span>
            <span class="tag ${a.level}">${a.level}</span>
          </li>
        `;
      });
    }
  }
}

/* -----------------------------
   3) PAYMENTS PAGE (/resident/dues/)
------------------------------ */
async function loadPaymentsPage() {
  const main = qs("#mainContent");
  main.innerHTML = `
    <div class="ann-page-title">
      <span class="icon">💳</span>
      <h1>Ödemeler</h1>
    </div>
    <p class="page-subtitle">Geçmiş ve yaklaşan tüm aidat ödemeleriniz.</p>

    <section class="tables">
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th>Ay</th>
              <th>Tutar</th>
              <th>Son Tarih</th>
              <th>Durum</th>
              <th>Ödeme Tarihi</th>
            </tr>
          </thead>
          <tbody id="paymentTableBody"></tbody>
        </table>
      </div>
    </section>
  `;

  const res = await fetch("/api/resident/dues/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const tbody = qs("#paymentTableBody");

  data.forEach((d) => {
    tbody.innerHTML += `
      <tr>
        <td>${fmtDate(d.month)}</td>
        <td>${fmtMoney(d.amount)}</td>
        <td>${fmtDate(d.due_date)}</td>
        <td><span class="tag ${d.status}">${d.status}</span></td>
        <td>${d.paid_date ? fmtDate(d.paid_date) : "-"}</td>
      </tr>
    `;
  });
}

/* -----------------------------
   4) FINANCES PAGE (/transactions/)
------------------------------ */
async function loadFinancesPage() {
  const main = qs("#mainContent");
  main.innerHTML = `
    <div class="ann-page-title">
      <span class="icon">💰</span>
      <h1>Bina Gelir &amp; Giderleri</h1>
    </div>
    <p class="page-subtitle">Yalnızca sakinlere açık olan işlemler.</p>

    <section class="tables">
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tür</th>
              <th>Kategori</th>
              <th>Açıklama</th>
              <th>Tutar</th>
            </tr>
          </thead>
          <tbody id="finTableBody"></tbody>
        </table>
      </div>
    </section>
  `;

  const res = await fetch("/api/transactions/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const tbody = qs("#finTableBody");

  data.forEach((t) => {
    tbody.innerHTML += `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${t.description}</td>
        <td>${fmtMoney(t.amount)}</td>
      </tr>
    `;
  });
}

/* -----------------------------
   5) ANNOUNCEMENTS PAGE (/announcements/)
------------------------------ */
async function loadAnnouncementsPage() {
  const main = qs("#mainContent");
  main.innerHTML = `
    <div class="ann-page-title">
      <span class="icon">📢</span>
      <h1>Duyurular</h1>
    </div>
    <p class="page-subtitle">Bina yöneticinizin paylaştığı tüm duyurular.</p>

    <section class="tables">
      <div class="table-box">
        <div id="annFullList"></div>
      </div>
    </section>
  `;

  const res = await fetch("/api/announcements/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const list = qs("#annFullList");

  list.innerHTML = data
    .map(
      (a, i) => `
      <div class="ann-card" data-index="${i}">
        <div class="ann-card-header">
          <div>
            <span class="ann-card-title">${a.title}</span>
            <span class="ann-card-date">${a.date_created.slice(0,10)}</span>
          </div>
          <span class="tag ${a.level}">${a.level}</span>
        </div>

        <div class="ann-card-body">
          ${a.message || "<i>(mesaj yok)</i>"}
        </div>
      </div>
    `
    )
    .join("");

  // Expand olayları
  const cards = qsa(".ann-card");
  let openCard = null;

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      if (openCard && openCard !== card) openCard.classList.remove("expanded");
      card.classList.toggle("expanded");
      openCard = card.classList.contains("expanded") ? card : null;
    });
  });
}


/* -----------------------------
   6) MESSAGES PAGE (placeholder)
------------------------------ */
function loadMessagesPage() {
  const main = qs("#mainContent");
  main.innerHTML = `
    <div class="ann-page-title">
      <span class="icon">💬</span>
      <h1>Mesajlar</h1>
    </div>
    <p class="page-subtitle">Mesajlaşma sistemi yakında burada olacak.</p>
  `;
}

/* -----------------------------
   7) MENU EVENTS
------------------------------ */
const menuItems = qsa("#menuList li");

menuItems.forEach((li) => {
  li.addEventListener("click", () => {
    menuItems.forEach((x) => x.classList.remove("active"));
    li.classList.add("active");

    const page = li.dataset.page;

    if (page === "dashboard") {
      renderDashboardLayout();
      loadUser();
      loadResidentDashboard();
    }
    if (page === "payments") loadPaymentsPage();
    if (page === "finances") loadFinancesPage();
    if (page === "announcements") loadAnnouncementsPage();
    if (page === "messages") loadMessagesPage();
  });
});

/* -----------------------------
   8) LOGOUT
------------------------------ */
qs("#logout").onclick = () => {
  localStorage.removeItem("access");
  window.location.href = "/login/";
};

/* -----------------------------
   9) INITIAL LOAD
------------------------------ */
window.addEventListener("DOMContentLoaded", () => {
  renderDashboardLayout();
  loadUser();
  loadResidentDashboard();
});
