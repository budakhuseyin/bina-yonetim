// ===============================
//  dashboard_manager.js (final)
// ===============================

// Token & guard
const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

// ---------- Mini helper ----------
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const fmtMoney = v => `$${Number(v).toLocaleString("en-US")}`;

// ---------- Nav: view switching ----------
qsa(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    qsa(".menu-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const view = btn.dataset.view;
    qsa(".view").forEach(v => v.classList.remove("show"));
    qs(`#view-${view}`).classList.add("show");

    // Dinamik yükleme
    if (view === "members") renderMembers();
  });
});

// also from in-page links
qsa("[data-view-link]").forEach(a=>{
  a.addEventListener("click", () => {
    const to = a.dataset.viewLink;
    qs(`.menu-item[data-view="${to}"]`).click();
  });
});

// ---------- Topbar & ME ----------
async function loadMe() {
  const res = await fetch("/api/me/", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    localStorage.removeItem("access");
    window.location.href = "/login/";
    return;
  }

  const me = await res.json();
  // Topbar
  const fullName = `${me.first_name || ""} ${me.last_name || ""}`.trim();
  qs("#managerNameTop").textContent = fullName || me.email;
  qs("#managerMailTop").textContent = me.email || "";
  qs("#buildingBadge").textContent  = me.building_name || "Building";
  qs("#avatarTop").textContent      = (me.first_name?.[0] || "M") + (me.last_name?.[0] || "G");

  window._ME = me;

  hydrateCards();
  renderRecentPayments();
  renderAnnouncements();
  renderApprovals();
}

// ---------- Dashboard placeholders ----------
function hydrateCards() {
  const income   = 45230, expenses = 28450, net = income - expenses, pending = 0;
  qs("#cardIncome").textContent  = fmtMoney(income);
  qs("#cardExpenses").textContent = fmtMoney(expenses);
  qs("#cardNet").textContent     = fmtMoney(net);
  qs("#cardPending").textContent = pending;
  qs("#cardIncomeTrend").textContent  = "+12.5%";
  qs("#cardExpensesTrend").textContent= "+8.2%";
  qs("#cardNetTrend").textContent     = "+18.4%";
}

function renderRecentPayments() {
  const container = qs("#recentPayments");
  container.innerHTML = "";

  const items = [
    { apt:"Apt 5B", name:"Sarah Johnson", amount:1250, status:"paid", date:"2025-10-24" },
    { apt:"Apt 3A", name:"Michael Chen", amount:1450, status:"paid", date:"2025-10-23" },
    { apt:"Apt 7C", name:"Emma Davis", amount:1200, status:"pending", date:"2025-10-22" },
  ];

  items.forEach(i=>{
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="row">
        <div><strong>${i.apt}</strong> - ${i.name}</div>
        <div class="badge ${i.status === "paid" ? "ok" : "pending"}">${i.status}</div>
      </div>
      <div class="row">
        <div class="badge">${i.date}</div>
        <div><strong>${fmtMoney(i.amount)}</strong></div>
      </div>
    `;
    container.appendChild(el);
  });
}

function renderAnnouncements() {
  const container = qs("#recentAnnouncements");
  container.innerHTML = "";

  const items = [
    { title:"Elevator Maintenance Scheduled", date:"2025-10-23", level:"high" },
    { title:"Community Meeting Next Week",   date:"2025-10-20", level:"medium" },
    { title:"Parking Rules Update",          date:"2025-10-18", level:"low" },
  ];

  items.forEach(i=>{
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="row"><strong>${i.title}</strong></div>
      <div class="row">
        <span class="badge ${i.level}">${i.level}</span>
        <span class="badge">${i.date}</span>
      </div>
    `;
    container.appendChild(el);
  });
}

// ---------- Member Approval (backend connected) ----------
async function renderApprovals() {
  const box = qs("#approvalsList");
  if (!box) return;
  box.innerHTML = `<div class="loading">Yükleniyor...</div>`;

  try {
    const res = await fetch("/api/manager/pending/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 403) {
        box.innerHTML = `<p class="error">Bu bölüme sadece yöneticiler erişebilir.</p>`;
        return;
      }
      throw new Error("Veri alınamadı.");
    }

    const pending = await res.json();

    if (!pending.length) {
      box.innerHTML = `<p class="empty">Bekleyen üye yok 🎉</p>`;
      return;
    }

    box.innerHTML = `
      <div class="thead">
        <div>Ad Soyad / E-posta</div>
        <div>Telefon</div>
        <div>Bina</div>
        <div>İşlem</div>
      </div>
      ${pending.map(
        (p) => `
          <div class="trow" data-id="${p.id}">
            <div>${p.email}</div>
            <div>${p.phone || "-"}</div>
            <div>${p.building || "-"}</div>
            <div class="actions">
              <button class="btn approve" data-act="approve">Onayla</button>
              <button class="btn reject" data-act="reject">Reddet</button>
            </div>
          </div>
        `
      ).join("")}
    `;

    box.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".trow");
        const id = row.dataset.id;
        const act = btn.dataset.act;
        const url =
          act === "approve"
            ? `/api/manager/approve/${id}/`
            : `/api/manager/reject/${id}/`;

        btn.textContent =
          act === "approve" ? "Onaylanıyor..." : "Reddediliyor...";
        btn.disabled = true;

        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          btn.textContent =
            act === "approve" ? "✅ Onaylandı" : "⛔ Reddedildi";
          row.style.opacity = 0.5;
          setTimeout(() => row.remove(), 800);
        } else {
          btn.textContent = "Hata ❌";
          btn.disabled = false;
        }

        const pendingCountEl = qs("#cardPending");
        if (pendingCountEl) {
          const current = parseInt(pendingCountEl.textContent) || 0;
          pendingCountEl.textContent = Math.max(0, current - 1);
        }
      });
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = `<p class="error">Bir hata oluştu. Lütfen sayfayı yenileyin.</p>`;
  }
}

// ---------- Member List & Detail (backend connected) ----------
async function renderMembers() {
  const container = qs("#membersList");
  const detailBox = qs("#memberDetail");
  if (!container || !detailBox) return;

  container.innerHTML = `<div class="loading">Üyeler yükleniyor...</div>`;
  detailBox.innerHTML = `<p class="empty">Bir üye seçin.</p>`;

  try {
    const res = await fetch("/api/manager/members/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Üye verileri alınamadı");
    const members = await res.json();

    if (!members.length) {
      container.innerHTML = `<p class="empty">Henüz kayıtlı üye yok.</p>`;
      return;
    }

    container.innerHTML = members.map(
      (m) => `
        <div class="member-item" data-id="${m.id}">
          <strong>${m.first_name} ${m.last_name}</strong> 
          <span>(${m.email})</span> 
          <span class="badge">${m.role}</span>
          <span class="badge ${m.approved ? "ok" : "pending"}">
            ${m.approved ? "Onaylı" : "Onaysız"}
          </span>
        </div>`
    ).join("");

    container.querySelectorAll(".member-item").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.dataset.id;
        await showMemberDetail(id);
      });
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error">Bir hata oluştu.</p>`;
  }
}

async function showMemberDetail(id) {
  const detailBox = qs("#memberDetail");
  detailBox.innerHTML = `<div class="loading">Üye bilgileri yükleniyor...</div>`;

  try {
    const res = await fetch(`/api/manager/member/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Detay alınamadı.");

    const data = await res.json();

    detailBox.innerHTML = `
      <h3>${data.first_name} ${data.last_name}</h3>
      <p><strong>E-posta:</strong> ${data.email}</p>
      <p><strong>Rol:</strong> ${data.role}</p>
      <p><strong>Onay durumu:</strong> ${data.approved ? "✅ Onaylı" : "⏳ Onay bekliyor"}</p>
      <p><strong>Bina:</strong> ${data.building || "-"}</p>
      <hr>
      <p><strong>Aidat Bilgileri:</strong></p>
      <ul>
        ${data.aidat_bilgileri?.length
          ? data.aidat_bilgileri.map(a => `<li>${a.tarih} - ${a.tutar}₺</li>`).join("")
          : "<li>Henüz kayıtlı aidat bilgisi yok.</li>"}
      </ul>
    `;
  } catch (err) {
    console.error(err);
    detailBox.innerHTML = `<p class="error">Üye detayları yüklenemedi.</p>`;
  }
}

// ---------- Logout ----------
qs("#logout").addEventListener("click", ()=>{
  localStorage.removeItem("access");
  window.location.href = "/login/";
});

// ---------- Boot ----------
loadMe().catch(() => {
  localStorage.removeItem("access");
  window.location.href = "/login/";
});

// ---------- Boot ----------
// ---------- Boot ----------
loadMe().catch(() => {
  localStorage.removeItem("access");
  window.location.href = "/login/";
});

window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("access");
  const tableBody = document.querySelector("#transactionsTable tbody");
  const addBtn = document.getElementById("addTransactionBtn");

  // 🔸 Kayıtları çek
  async function loadTransactions() {
    try {
      const res = await fetch("/api/transactions/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      tableBody.innerHTML = "";
      let totalIncome = 0, totalExpense = 0;

      data.forEach((t) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${t.date}</td>
          <td>${t.type}</td>
          <td>${t.category}</td>
          <td>${t.description}</td>
          <td style="color:${t.type === "income" ? "lightgreen" : "red"};">
            ${t.type === "income" ? "+" : "-"}${t.amount}
          </td>
        `;
        tableBody.appendChild(row);
        if (t.type === "income") totalIncome += parseFloat(t.amount);
        else totalExpense += parseFloat(t.amount);
      });

      qs("#totalIncome").textContent = `$${totalIncome.toLocaleString()}`;
      qs("#totalExpenses").textContent = `$${totalExpense.toLocaleString()}`;
      qs("#netBalance").textContent = `$${(totalIncome - totalExpense).toLocaleString()}`;
    } catch (err) {
      console.error("Error loading transactions:", err);
    }
  }

  // 🔸 Yeni kayıt ekleme
  addBtn.addEventListener("click", async () => {
    console.log("🟢 Add clicked");
    const payload = {
      type: document.getElementById("type").value,
      category: document.getElementById("category").value,
      description: document.getElementById("description").value,
      amount: document.getElementById("amount").value,
      visible_to_residents: document.getElementById("visibleToResidents").checked,
    };
    console.log("📦 Payload:", payload);

    try {
      const res = await fetch("/api/transactions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("📡 Response:", res.status);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      await res.json();
      console.log("✅ Transaction saved successfully");

      // form temizle
      document.getElementById("transactionForm").reset();
      document.getElementById("visibleToResidents").checked = true;

      await loadTransactions();
    } catch (err) {
      console.error("❌ Error adding transaction:", err);
      alert("İşlem eklenemedi: " + err.message);
    }
  });

  loadTransactions();
});

// === Announcements: expand + load ===
function enableAnnouncementExpand() {
  const cards = document.querySelectorAll("#announcementsList .list-item");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const openCard = document.querySelector("#announcementsList .list-item.expanded");
      if (openCard && openCard !== card) openCard.classList.remove("expanded");
      card.classList.toggle("expanded");
    });
  });
}

async function loadAnnouncements() {
  const list = qs("#announcementsList");
  if (!list) return;
  list.innerHTML = "<div class='loading'>Yükleniyor...</div>";

  try {
    const res = await fetch("/api/announcements/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Veri alınamadı");
    const data = await res.json();

    list.innerHTML = data.map(a => `
      <div class="list-item" data-id="${a.id}">
        <div class="row">
          <strong>${a.title}</strong>
          <span class="badge ${a.level}">${a.level}</span>
        </div>
        <div class="row">
          <small>${a.date_created.slice(0,10)}</small>
          <div class="actions">
            <button class="btn-edit">✏️</button>
            <button class="btn-delete">🗑️</button>
          </div>
        </div>
        <p>${a.message}</p>
      </div>
    `).join("");

    enableAnnouncementExpand();

    // Silme butonu
    list.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const card = btn.closest(".list-item");
        const id = card.dataset.id;
        if (!confirm("Bu duyuruyu silmek istediğine emin misin?")) return;

        const res = await fetch(`/api/announcements/${id}/delete/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 204) {
          card.remove();
        } else {
          alert("Silme işlemi başarısız oldu.");
        }
      });
    });

    // Düzenleme butonu
    list.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const card = btn.closest(".list-item");
        const id = card.dataset.id;
        const title = card.querySelector("strong").textContent;
        const message = card.querySelector("p").textContent;
        const level = card.querySelector(".badge").textContent.toLowerCase();

        const newTitle = prompt("Yeni başlık:", title);
        const newMessage = prompt("Yeni mesaj:", message);
        const newLevel = prompt("Seviye (high/medium/low):", level);

        if (!newTitle || !newMessage) return;

        const payload = { title: newTitle, message: newMessage, level: newLevel };
        const res = await fetch(`/api/announcements/${id}/`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          await loadAnnouncements();
        } else {
          alert("Düzenleme başarısız oldu.");
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class='error'>Hata: ${err.message}</p>`;
  }
}


// Form: add announcement
qs("#addAnnouncementBtn").addEventListener("click", async () => {
  const payload = {
    title: qs("#annTitle").value,
    message: qs("#annMessage").value,
    level: qs("#annLevel").value,
  };
  try {
    const res = await fetch("/api/announcements/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Duyuru eklenemedi");

    qs("#announcementForm").reset();
    await loadAnnouncements();
  } catch (err) {
    alert(err.message);
  }
});
// Sayfa yüklendiğinde otomatik duyuruları çek
window.addEventListener("DOMContentLoaded", () => {
  loadAnnouncements();
});

async function hydrateCards() {
  try {
    const res = await fetch("/api/manager/dashboard/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Dashboard verileri alınamadı");
    const data = await res.json();

    qs("#cardIncome").textContent = `₺${data.income_total.toLocaleString("tr-TR")}`;
    qs("#cardExpenses").textContent = `₺${data.expense_total.toLocaleString("tr-TR")}`;
    qs("#cardNet").textContent = `₺${data.net_total.toLocaleString("tr-TR")}`;
    qs("#cardPending").textContent = data.pending_count;
    
    renderRecentPayments(data.recent_transactions);
    renderAnnouncements(data.recent_announcements);
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

function renderRecentPayments(items = []) {
  const container = qs("#recentPayments");
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = "<p class='empty'>Henüz ödeme bulunamadı.</p>";
    return;
  }
  items.forEach(i => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="row">
        <div><strong>${i.category}</strong> - ${i.description}</div>
        <div class="badge ${i.type === "income" ? "ok" : "pending"}">${i.type}</div>
      </div>
      <div class="row">
        <div class="badge">${i.date}</div>
        <div><strong>₺${i.amount}</strong></div>
      </div>`;
    container.appendChild(el);
  });
}

function renderAnnouncements(items = []) {
  const container = qs("#recentAnnouncements");
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = "<p class='empty'>Henüz duyuru yok.</p>";
    return;
  }
  items.forEach(i => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="row"><strong>${i.title}</strong></div>
      <div class="row">
        <span class="badge ${i.level}">${i.level}</span>
        <span class="badge">${i.date}</span>
      </div>`;
    container.appendChild(el);
  });
}
