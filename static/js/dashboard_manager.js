// ===============================
// dashboard_manager.js (Final & Expanded)
// ===============================

// ---- Guard + token ----
const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

// ---- Helpers ----
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const fmtMoney = v => `₺${Number(v).toLocaleString("tr-TR")}`;

// ---- API endpoints ----
const API = {
  me: "/api/me/",
  dashboard: "/api/manager/dashboard/",

  pendingMembers: "/api/manager/pending/",
  approveMember: id => `/api/manager/approve/${id}/`,
  rejectMember: id => `/api/manager/reject/${id}/`,

  members: "/api/manager/members/",
  memberDetail: id => `/api/manager/member/${id}/`,

  transactions: "/api/transactions/",

  // Duyurular
  announcements: "/api/announcements/",
  deleteAnnouncement: id => `/api/announcements/${id}/delete/`,
  updateAnnouncement: id => `/api/announcements/${id}/`, // Düzenleme için eklendi

  // Aidat / Dues
  managerDues: "/api/manager/dues/",
  createMonthlyDues: "/api/manager/dues/create-monthly/",
  updateDueStatus: id => `/api/manager/dues/${id}/status/`,
  deleteDue: id => `/api/manager/dues/${id}/delete/`,
  updateDueStatus: id => `/api/manager/dues/${id}/status/`,

  // Payment Notifications
  paymentNotifications: "/api/manager/payment-notifications/",
  approvePaymentNotif: id => `/api/manager/payment-notification/${id}/approve/`,
  rejectPaymentNotif: id => `/api/manager/payment-notification/${id}/reject/`,
};

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${token}`,
  ...extra
});

// ===============================
// NAV
// ===============================
qsa(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => {
    qsa(".menu-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const view = btn.dataset.view;

    qsa(".view").forEach(v => v.classList.remove("show"));
    qs(`#view-${view}`).classList.add("show");

    if (view === "dashboard") loadDashboard();
    if (view === "approvals") loadApprovals();
    if (view === "members") renderMembers();
    if (view === "finances") loadTransactions();
    if (view === "announcements") loadAnnouncements();
    if (view === "fees") {
      bindFeesActions();
      loadDuesList(); // <--- İsim değişmişti (Tab desteği için)
      loadPaymentNotifications();
    }
    // Raporlar fonksiyonu varsa çağır
    if (view === "reports" && typeof loadReports === "function") loadReports();

    // Mesajlar
    if (view === "messages") loadMessages(); // <-- BUNU EKLEDİK
  });
});

// in-page quick links
qsa("[data-view-link]").forEach(a => {
  a.addEventListener("click", () => {
    const to = a.dataset.viewLink;
    qs(`.menu-item[data-view="${to}"]`).click();
  });
});

// ===============================
// BOOT
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  await loadMe();
  loadDashboard(); // default açık gelen sayfa
});

// ===============================
// ME + TOPBAR
// ===============================
async function loadMe() {
  const res = await fetch(API.me, { headers: authHeaders() });
  if (!res.ok) {
    localStorage.removeItem("access");
    window.location.href = "/login/";
    return;
  }

  const me = await res.json();

  // 1. İsim Oluşturma
  const fullName = `${me.first_name || ""} ${me.last_name || ""}`.trim();

  // 2. Masaüstü (TopBar) Bilgilerini Doldur
  qs("#managerNameTop").textContent = fullName || me.email;
  qs("#managerMailTop").textContent = me.email || "";
  qs("#buildingBadge").textContent = me.building_name || "Bina";
  qs("#avatarTop").textContent =
    (me.first_name?.[0] || "Y") + (me.last_name?.[0] || "M");

  // 3. Mobil Sidebar Bilgilerini Doldur
  const mobileName = document.getElementById("mobileSidebarName");
  const mobileMail = document.getElementById("mobileSidebarMail");

  if (mobileName) mobileName.textContent = fullName || me.email;
  if (mobileMail) mobileMail.textContent = me.email || "";

  window._ME = me;

  // 4. LOGOUT (ÇIKIŞ) İŞLEMİ
  const handleLogout = () => {
    localStorage.removeItem("access");
    window.location.href = "/login/";
  };

  const btnDesktop = qs("#logout");
  if (btnDesktop) btnDesktop.onclick = handleLogout;

  const btnMobile = document.getElementById("mobileLogoutBtn");
  if (btnMobile) btnMobile.onclick = handleLogout;
}

// ===============================
// DASHBOARD
// ===============================
async function loadDashboard() {
  try {
    const res = await fetch(API.dashboard, { headers: authHeaders() });
    if (!res.ok) throw new Error("dashboard fail");
    const data = await res.json();

    qs("#cardIncome").textContent = fmtMoney(data.income_total || 0);
    qs("#cardExpenses").textContent = fmtMoney(data.expense_total || 0);
    qs("#cardNet").textContent = fmtMoney(data.net_total || 0);
    qs("#cardPending").textContent = data.pending_count || 0;

    renderRecentPayments(data.recent_transactions || []);
    renderRecentAnnouncements(data.recent_announcements || []);
  } catch (e) {
    console.error(e);
  }
}

function renderRecentPayments(items) {
  const container = qs("#recentPayments");
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = "<p class='empty'>Henüz ödeme yok.</p>";
    return;
  }

  items.forEach(i => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="row">
        <div><strong>${i.category}</strong> - ${i.description}</div>
        <div class="badge ${i.type === "income" ? "ok" : "pending"}">${translateType(i.type)}</div>
      </div>
      <div class="row">
        <div class="badge">${i.date}</div>
        <div><strong>${fmtMoney(i.amount)}</strong></div>
      </div>`;
    container.appendChild(el);
  });
}

function translateType(type) {
  if (type === "income") return "Gelir";
  if (type === "expense") return "Gider";
  return type;
}

function translateLevel(level) {
  const l = level.toLowerCase();
  if (l === "high") return "YÜKSEK";
  if (l === "medium") return "ORTA";
  if (l === "low") return "DÜŞÜK";
  return level;
}

function translateStatus(status) {
  if (status === "paid") return "Ödendi";
  if (status === "pending") return "Beklemede";
  return status;
}

function renderRecentAnnouncements(items) {
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
        <span class="badge ${i.level.toLowerCase()}">${translateLevel(i.level)}</span>
        <span class="badge">${(i.date || "").slice(0, 10)}</span>
      </div>`;
    container.appendChild(el);
  });
}

// ===============================
// APPROVALS
// ===============================
async function loadApprovals() {
  const box = qs("#approvalsList");
  if (!box) return;
  box.innerHTML = "<div class='loading'>Yükleniyor...</div>";

  try {
    const res = await fetch(API.pendingMembers, { headers: authHeaders() });
    if (!res.ok) throw new Error("pending fail");
    const pending = await res.json();

    if (!pending.length) {
      box.innerHTML = "<p class='empty'>Bekleyen üye yok 🎉</p>";
      return;
    }

    box.innerHTML = `
      <div class="thead">
        <div>E-posta</div><div>Telefon</div><div>Bina</div><div>İşlem</div>
      </div>
      ${pending.map(p => `
        <div class="trow" data-id="${p.id}">
          <div>${p.email}</div>
          <div>${p.phone || "-"}</div>
          <div>${p.building || "-"}</div>
          <div class="actions">
            <button class="btn approve" data-act="approve">Onayla</button>
            <button class="btn reject" data-act="reject">Reddet</button>
          </div>
        </div>`).join("")}
    `;

    box.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".trow");
        const id = row.dataset.id;
        const act = btn.dataset.act;

        const url = act === "approve" ? API.approveMember(id) : API.rejectMember(id);

        btn.disabled = true;
        const r = await fetch(url, { method: "POST", headers: authHeaders() });

        if (r.ok) {
          row.remove();
          const el = qs("#cardPending");
          el.textContent = Math.max(0, (parseInt(el.textContent) || 0) - 1);
        } else {
          btn.disabled = false;
          alert("İşlem başarısız.");
        }
      });
    });

  } catch (e) {
    console.error(e);
    box.innerHTML = "<p class='error'>Bekleyenler alınamadı.</p>";
  }
}

// ===============================
// MEMBERS
// ===============================
async function renderMembers() {
  const container = qs("#membersList");
  const detailBox = qs("#memberDetail");
  if (!container || !detailBox) return;

  container.innerHTML = "<div class='loading'>Üyeler yükleniyor...</div>";
  detailBox.innerHTML = "<p class='empty'>Bir üye seçin.</p>";

  try {
    const res = await fetch(API.members, { headers: authHeaders() });
    if (!res.ok) throw new Error("members fail");
    const members = await res.json();

    if (!members.length) {
      container.innerHTML = "<p class='empty'>Üye yok.</p>";
      return;
    }

    container.innerHTML = members.map(m => `
      <div class="member-item" data-id="${m.id}">
        <strong>${m.first_name} ${m.last_name}</strong>
        <span>(${m.email})</span>
        <span class="badge">${m.role}</span>
        <span class="badge ${m.approved ? "ok" : "pending"}">
          ${m.approved ? "Onaylı" : "Onaysız"}
        </span>
      </div>`).join("");

    qsa(".member-item", container).forEach(el => {
      el.addEventListener("click", () => showMemberDetail(el.dataset.id));
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = "<p class='error'>Üyeler alınamadı.</p>";
  }
}

// dashboard_manager.js içindeki showMemberDetail fonksiyonunu bununla değiştir:

async function showMemberDetail(id) {
  const detailBox = qs("#memberDetail");
  detailBox.innerHTML = "<div class='loading'>Üye bilgileri yükleniyor...</div>";

  try {
    const res = await fetch(API.memberDetail(id), { headers: authHeaders() });
    if (!res.ok) throw new Error("detail fail");
    const data = await res.json();

    // Tarih formatlayıcı
    const formatDate = (dateStr) => {
      if (!dateStr) return "-";
      return new Date(dateStr).toLocaleDateString("tr-TR");
    };

    // Ödemeler HTML'i
    let paymentsHtml = `<p class="empty small">Henüz ödeme kaydı yok.</p>`;
    if (data.aidat_bilgileri && data.aidat_bilgileri.length > 0) {
      paymentsHtml = `
        <table class="mini-table">
            <thead>
                <tr>
                    <th>Dönem</th>
                    <th>Ödeme Tarihi</th>
                    <th class="text-right">Tutar</th>
                </tr>
            </thead>
            <tbody>
                ${data.aidat_bilgileri.map(p => `
                    <tr>
                        <td>${formatDate(p.month).slice(3)}</td> <td>${formatDate(p.paid_date)}</td>
                        <td class="text-right success-text">₺${p.amount}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>`;
    }

    // Ana HTML
    detailBox.innerHTML = `
      <div class="user-header">
         <div class="avatar large">${data.first_name[0] || "U"}${data.last_name[0] || ""}</div>
         <div>
            <h3>${data.first_name} ${data.last_name}</h3>
            <span class="badge ${data.role === 'manager' ? 'high' : 'low'}">${data.role}</span>
         </div>
      </div>

      <div class="detail-grid">
         <div class="detail-item">
            <label>E-posta</label>
            <span>${data.email}</span>
         </div>
         <div class="detail-item">
            <label>Telefon</label>
            <span>${data.phone || "-"}</span>
         </div>
         <div class="detail-item">
            <label>Daire No</label>
            <span>${data.apartment_number}</span>
         </div>
         <div class="detail-item">
            <label>Kayıt Tarihi</label>
            <span>${formatDate(data.date_joined)}</span>
         </div>
      </div>

      <hr class="divider">
      
      <h4>Son Ödemeler</h4>
      ${paymentsHtml}
    `;
  } catch (e) {
    console.error(e);
    detailBox.innerHTML = "<p class='error'>Detay alınamadı.</p>";
  }
}

// ===============================
// FINANCES (Transactions)
// ===============================
// ===============================
// FINANCES (Transactions)
// ===============================
async function loadTransactions() {
  const tableBody = qs("#transactionsTable tbody");
  if (!tableBody) return;

  try {
    const res = await fetch(API.transactions, { headers: authHeaders() });
    if (!res.ok) throw new Error("tx fail");

    // Veriyi al
    let data = await res.json();

    // ⬇️ BURAYI EKLEDİK: Tarihe göre (Yeniden Eskiye) sırala
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    tableBody.innerHTML = "";
    let totalIncome = 0, totalExpense = 0;

    data.forEach(t => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${t.date}</td>
        <td>${translateType(t.type)}</td>
        <td>${t.category}</td>
        <td>${t.description}</td>
        <td style="color: ${t.type === "income" ? "#4ade80" : "#f87171"}">
          ${t.type === "income" ? "+" : "-"}${t.amount}
        </td>`;
      tableBody.appendChild(row);

      if (t.type === "income") totalIncome += parseFloat(t.amount);
      else totalExpense += parseFloat(t.amount);
    });

    qs("#totalIncome").textContent = fmtMoney(totalIncome);
    qs("#totalExpenses").textContent = fmtMoney(totalExpense);
    qs("#netBalance").textContent = fmtMoney(totalIncome - totalExpense);

  } catch (e) {
    console.error(e);
  }
}
// add transaction
qs("#addTransactionBtn")?.addEventListener("click", async () => {
  const payload = {
    type: qs("#type").value,
    category: qs("#category").value,
    description: qs("#description").value,
    amount: qs("#amount").value,
    visible_to_residents: qs("#visibleToResidents").checked,
  };

  const res = await fetch(API.transactions, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    qs("#transactionForm").reset();
    qs("#visibleToResidents").checked = true;
    loadTransactions();
  } else {
    alert("İşlem eklenemedi.");
  }
});

// ===============================
// ANNOUNCEMENTS (Full Logic)
// ===============================

// 1. Duyuruları Yükle
// 1. Duyuruları Yükle
let _allAnnouncements = [];
let _activeAnnTab = 'active'; // 'active' or 'archive'

// Tab Eventlerini Bağla
document.addEventListener("DOMContentLoaded", () => {
  const activeTabObj = qs("#annTabActive");
  const archiveTabObj = qs("#annTabArchived");

  if (activeTabObj) activeTabObj.addEventListener("click", () => switchAnnTab('active'));
  if (archiveTabObj) archiveTabObj.addEventListener("click", () => switchAnnTab('archive'));
});

function switchAnnTab(tab) {
  _activeAnnTab = tab;
  // UI
  qs("#annTabActive").classList.toggle("active", tab === 'active');
  qs("#annTabArchived").classList.toggle("active", tab === 'archive');

  const titleApi = qs("#annListTitle");
  if (titleApi) titleApi.textContent = (tab === 'active' ? "Aktif Duyurular" : "Arşivlenmiş Duyurular");

  renderAnnouncementsList();
}

async function loadAnnouncements() {
  const list = qs("#announcementsList");
  if (!list) return;
  list.innerHTML = "<div class='loading'>Yükleniyor...</div>";

  try {
    const res = await fetch(API.announcements, { headers: authHeaders() });
    if (!res.ok) throw new Error("ann fail");
    _allAnnouncements = await res.json();

    renderAnnouncementsList();

  } catch (e) {
    console.error(e);
    list.innerHTML = "<p class='error'>Duyurular alınamadı.</p>";
  }
}

function renderAnnouncementsList() {
  const list = qs("#announcementsList");
  if (!list) return;

  // Local Storage'dan arşivlenmiş ID'leri al
  let archivedIds = JSON.parse(localStorage.getItem("archivedAnnouncements") || "[]");

  // Filtreleme
  const filtered = _allAnnouncements.filter(a => {
    const isArchived = archivedIds.includes(String(a.id)) || archivedIds.includes(a.id);

    if (_activeAnnTab === 'active') return !isArchived;
    if (_activeAnnTab === 'archive') return isArchived;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class='empty'>${_activeAnnTab === 'active' ? 'Aktif' : 'Arşivlenmiş'} duyuru yok.</p>`;
    return;
  }

  list.innerHTML = filtered.map(a => {
    const isArchived = (_activeAnnTab === 'archive');
    const archiveBtnText = isArchived ? "Geri Yükle" : "Arşivle";
    const archiveIcon = isArchived ? "♻️" : "📦";

    return `
      <div class="list-item" data-id="${a.id}">
        <div class="row header">
          <strong>${a.title}</strong>
          <span class="badge ${a.level.toLowerCase()}">${translateLevel(a.level)}</span>
        </div>
        <div class="row meta">
          <small>${(a.date_created || "").slice(0, 10)}</small>
          <div class="actions">
            <button class="small-btn outline btn-archive" style="margin-right:5px;" onclick="toggleAnnouncementArchive(${a.id})">${archiveIcon} ${archiveBtnText}</button>
            <button class="btn-edit">✏️</button>
            <button class="btn-delete">🗑️</button>
          </div>
        </div>
        <div class="ann-body">
            ${a.message}
        </div>
      </div>`;
  }).join("");

  // Expand ve Buton Eventlerini Bağla
  enableAnnouncementExpand();
  attachAnnouncementActions();
}

// Global Archive Toggle
window.toggleAnnouncementArchive = (id) => {
  // Event propagation'ı durdurmak için inline onclick kullandık ama 
  // expand olmasını engellemek için JS tarafında da kontrol edeceğiz veya 
  // event bubbling'i burada durdurmak zor, o yüzden expand fonksiyonunda button kontrolü var.
  event.stopPropagation();

  let archivedIds = JSON.parse(localStorage.getItem("archivedAnnouncements") || "[]");
  const strId = String(id);

  if (archivedIds.includes(strId)) {
    // Arşivden çıkar (Restore)
    archivedIds = archivedIds.filter(x => x !== strId);
  } else {
    // Arşive ekle
    archivedIds.push(strId);
  }

  localStorage.setItem("archivedAnnouncements", JSON.stringify(archivedIds));
  renderAnnouncementsList();
};

// 2. Expand Mantığı (Tıklayınca açılma)
function enableAnnouncementExpand() {
  const cards = document.querySelectorAll("#announcementsList .list-item");
  cards.forEach(card => {
    // Önce klonlayıp listener'ları sıfırla (çift eklemeyi önlemek için)
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
  });

  // Yeniden seç ve event ekle
  document.querySelectorAll("#announcementsList .list-item").forEach(card => {
    card.addEventListener("click", (e) => {
      // Eğer butonlara tıklandıysa kartı açma
      if (e.target.closest("button")) return;

      const openCard = document.querySelector("#announcementsList .list-item.expanded");
      if (openCard && openCard !== card) openCard.classList.remove("expanded");
      card.classList.toggle("expanded");
    });
  });
}

// 3. Edit & Delete Buton Mantığı
function attachAnnouncementActions() {
  const list = qs("#announcementsList");

  // DELETE
  list.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Kartın açılmasını engelle
      const card = btn.closest(".list-item");
      const id = card.dataset.id;

      if (!confirm("Bu duyuru silinsin mi?")) return;

      const res = await fetch(API.deleteAnnouncement(id), {
        method: "DELETE",
        headers: authHeaders()
      });
      if (res.status === 204) card.remove();
      else alert("Silinemedi.");
    });
  });

  // EDIT
  list.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Kartın açılmasını engelle
      const card = btn.closest(".list-item");
      const id = card.dataset.id;

      // Mevcut veriler
      const titleEl = card.querySelector("strong");
      const msgEl = card.querySelector(".ann-body");
      const badgeEl = card.querySelector(".badge");

      const oldTitle = titleEl.textContent;
      const oldMsg = msgEl ? msgEl.textContent.trim() : "";
      const oldLevel = badgeEl.textContent === "YÜKSEK" ? "high" :
        badgeEl.textContent === "ORTA" ? "medium" : "low";

      // Basit Prompt ile Veri Alma
      const newTitle = prompt("Başlık:", oldTitle);
      const newMsg = prompt("Mesaj:", oldMsg);
      const newLevel = prompt("Seviye (high/medium/low):", oldLevel);

      if (!newTitle || !newMsg) return;

      const payload = { title: newTitle, message: newMsg, level: newLevel };

      const res = await fetch(API.updateAnnouncement(id), {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Sayfayı yenilemeden DOM güncelle
        titleEl.textContent = newTitle;
        if (msgEl) msgEl.textContent = newMsg;
        badgeEl.textContent = translateLevel(newLevel);
        badgeEl.className = `badge ${newLevel}`;
        alert("Güncellendi!");
      } else {
        alert("Güncelleme başarısız.");
      }
    });
  });
}

// Yeni Duyuru Ekleme
qs("#addAnnouncementBtn")?.addEventListener("click", async () => {
  const payload = {
    title: qs("#annTitle").value,
    message: qs("#annMessage").value,
    level: qs("#annLevel").value,
  };

  const res = await fetch(API.announcements, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    qs("#announcementForm").reset();
    loadAnnouncements();
  } else {
    alert("Duyuru eklenemedi.");
  }
});

// ===============================
// FEES (Aidat Takibi)
// ===============================

function bindFeesActions() {
  const btn = qs("#createDueBtn");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", createMonthlyDues);
}

// AİDAT OLUŞTURMA FONKSİYONU
async function createMonthlyDues() {
  const month = qs("#dueMonth").value;
  const amount = qs("#dueAmount").value;
  const due_date = qs("#dueDate").value;

  // HATA FIX: Seçilen dropdown değerini alıyoruz
  const due_type = qs("#dueType").value;

  if (!month || !amount || !due_date) {
    alert("Ay / tutar / son tarih zorunlu.");
    return;
  }

  const btn = qs("#createDueBtn");
  btn.disabled = true;
  btn.textContent = "İşleniyor...";

  try {
    const res = await fetch(API.createMonthlyDues, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        month,
        amount,
        due_date,
        type: due_type, // <--- Backend'e gönderiyoruz
      }),
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.message || "Aidatlar oluşturuldu.");
      qs("#dueCreateForm").reset();
      loadDuesList(); // Tabloyu yenile
    } else {
      const err = await res.json();
      alert("Hata: " + (err.detail || "İşlem başarısız"));
    }
  } catch (err) {
    console.error(err);
    alert("Sunucu hatası oluştu.");
  } finally {
    btn.disabled = false;
    btn.textContent = "🧾 Aidat / Ücret Oluştur";
  }
}

// AİDAT LİSTESİNİ YÜKLE + TAB DESTEĞİ
// window._manDueTab 'active' | 'history'
window._manDueTab = "active"; // Default

async function loadDuesList() {
  const tbody = qs("#duesBody");
  tbody.innerHTML = `<tr><td colspan="7">Yükleniyor...</td></tr>`;

  // Önce tab buttonlarını render edelim (eğer yoksa)
  let tabsContainer = qs("#duesTabsContainer");
  if (!tabsContainer) {
    const panelHead = qs("#duesTable").closest(".panel").querySelector(".panel-head");
    // Panel head içine ekle
    panelHead.insertAdjacentHTML("beforeend", `
          <div id="duesTabsContainer" class="msg-tabs" style="margin-top:10px;">
              <button class="tab-btn active" id="tabManDueActive">Aktif (Ödenmemiş)</button>
              <button class="tab-btn" id="tabManDueHistory">Geçmiş (Ödenmiş)</button>
          </div>
      `);

    // Event listenerlar
    qs("#tabManDueActive").onclick = () => {
      window._manDueTab = "active";
      updateManTabs();
      loadDuesList();
    };
    qs("#tabManDueHistory").onclick = () => {
      window._manDueTab = "history";
      updateManTabs();
      loadDuesList();
    };

    function updateManTabs() {
      qs("#tabManDueActive").className = window._manDueTab === "active" ? "tab-btn active" : "tab-btn";
      qs("#tabManDueHistory").className = window._manDueTab === "history" ? "tab-btn active" : "tab-btn";
    }
  }

  try {
    const res = await fetch(API.managerDues, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Aidatlar alınamadı");

    const data = await res.json();

    // Filtreleme
    let filtered = [];
    tbody.innerHTML = ""; // Clear loading message

    // TAB 1: Aktif (Arşivlenmemiş)
    if (window._manDueTab === "active") {
      filtered = data.filter(d => !d.is_archived);
    }
    // TAB 2: Arşiv (Arşivlenmiş)
    else {
      filtered = data.filter(d => d.is_archived);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Kayıt bulunamadı.</td></tr>`;
      return;
    }

    filtered.forEach(d => {
      let statusBadge = "";
      if (d.status === "paid") statusBadge = `<span class="badge success">Ödendi</span>`;
      else if (d.status === "overdue") statusBadge = `<span class="badge danger">Gecikmiş</span>`;
      else statusBadge = `<span class="badge warning">Bekliyor</span>`;

      // Backend'den type gelmeyebilir eskilere, default koyalım
      const dType = d.type ? d.type.toUpperCase() : "AİDAT";

      let actionBtns = ``;

      // 1. Ödeme Durumu Değiştir (Sadece Aktif listede mantıklı olabilir ama her yerde dursun)
      if (d.status !== "paid") {
        actionBtns += `<button class="btn ok small" onclick="togglePaymentStatus(${d.id}, 'paid')">Ödendi Yap</button> `;
      } else {
        actionBtns += `<button class="btn warning small" onclick="togglePaymentStatus(${d.id}, 'pending')">Ödenmedi Yap</button> `;
      }

      // 2. Arşiv İşlemi
      if (!d.is_archived) {
        actionBtns += `<button class="btn danger small" onclick="archiveDue(${d.id})">Arşive Al</button>`;
      } else {
        actionBtns += `<button class="btn info small" onclick="restoreDue(${d.id})">Aktife Al</button>`;
      }

      tbody.innerHTML += `
        <tr>
          <td>${d.resident_name || "Bilinmeyen"} <br><small>${d.resident_email || "-"}</small></td>
          <td>${d.month}</td>
          <td>₺${d.amount}</td>
          <td><span class="badge info">${dType}</span></td>
          <td>${d.due_date}</td>
          <td>${statusBadge}</td>
          <td>${d.paid_date || "-"}</td>
          <td style="display:flex; gap:5px;">${actionBtns}</td> 
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" style="color:red;">Hata: ${err.message}</td></tr>`;
  }
}

const monthNames = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

function formatMonth(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

// Payment Notifications
// ============================================
// PAYMENT NOTIFICATIONS (Ödeme Bildirimleri) - GÜNCEL
// ============================================
async function loadPaymentNotifications() {
  const tbody = qs("#paymentNotificationsBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="loading">Yükleniyor...</td></tr>`;

  try {
    const res = await fetch(API.paymentNotifications, { headers: authHeaders() });

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="error">Veri alınamadı.</td></tr>`;
      return;
    }

    const data = await res.json();

    // En yeni bildirim en üstte görünsün
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Henüz ödeme bildirimi yok.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(n => {
      // Rozet (Badge) Renkleri
      let statusBadge = "";
      if (n.status === "pending") statusBadge = `<span class="badge pending">Bekliyor</span>`;
      else if (n.status === "approved") statusBadge = `<span class="badge ok">Onaylandı</span>`;
      else if (n.status === "rejected") statusBadge = `<span class="badge high">Reddedildi</span>`;

      // Tarih Formatı
      const dateStr = new Date(n.created_at).toLocaleDateString("tr-TR");

      // Dosya Linki
      const fileLink = n.file
        ? `<a href="${n.file}" target="_blank" class="link">📄 Görüntüle</a>`
        : `<span style="color:#666; font-size:12px;">Dosya Yok</span>`;

      // Butonlar (Sadece 'pending' ise göster)
      const actionButtons = n.status === "pending" ? `
        <div class="actions">
          <button onclick="approveNotif(${n.id})" class="btn approve small">Onayla</button>
          <button onclick="rejectNotif(${n.id})" class="btn reject small">Reddet</button>
        </div>
      ` : `<span style="color:#555; font-size:12px;">İşlem Tamam</span>`;

      return `
        <tr class="trow">
          <td>
            <div style="font-weight:bold; color:#fff;">${n.resident_name}</div>
            <div style="font-size:11px; color:#888;">Daire: ${n.resident_flat || "-"}</div>
          </td>
          <td>${n.month || "-"} <div style="font-size:11px; color:#666;">${dateStr}</div></td>
          <td style="font-weight:bold; color:#e0e7ff;">${fmtMoney(n.amount)}</td>
          <td>${fileLink}</td>
          <td>${statusBadge}</td>
          <td>${actionButtons}</td>
        </tr>`;
    }).join("");

  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="6" class="error">Bir hata oluştu.</td></tr>`;
  }
}

// Global functions for inline onclicks
window.approveNotif = async (id) => {
  await fetch(API.approvePaymentNotif(id), {
    method: "PUT",
    headers: authHeaders()
  });
  loadPaymentNotifications();
  loadManagerDues();
};

window.rejectNotif = async (id) => {
  await fetch(API.rejectPaymentNotif(id), {
    method: "PUT",
    headers: authHeaders()
  });
  loadPaymentNotifications();
};

// ===============================
// MOBILE MENU
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuItems = document.querySelectorAll('.menu-item');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.add('active');
      overlay.classList.add('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 860) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }
    });
  });

  // --- PROFIL MODAL MANTIĞI (MANAGER) ---
  const profileModal = document.getElementById("profileModal");
  const closeProfileBtn = document.getElementById("closeProfileBtn");
  const saveProfileBtn = document.getElementById("saveProfileBtn");

  // Tetikleyici: Üst bardaki user div'i
  const topUserDiv = document.querySelector(".topbar .user");
  if (topUserDiv) {
    topUserDiv.style.cursor = "pointer";
    topUserDiv.addEventListener("click", openProfileModal);
  }

  // Sidebar daki user info için de ekleyelim
  const sideUserDiv = document.querySelector(".sidebar-user-profile");
  if (sideUserDiv) {
    sideUserDiv.style.cursor = "pointer";
    sideUserDiv.addEventListener("click", (e) => {
      // Logout butonuna basıldıysa açma
      if (e.target.id === 'mobileLogoutBtn') return;
      openProfileModal();
    });
  }

  if (closeProfileBtn) closeProfileBtn.onclick = () => profileModal.classList.add("hidden");

  if (saveProfileBtn) {
    saveProfileBtn.onclick = async () => {
      const payload = {
        first_name: document.getElementById("editName").value,
        last_name: document.getElementById("editSurname").value,
        email: document.getElementById("editEmail").value,
        phone: document.getElementById("editPhone").value
      };

      try {
        const res = await fetch("/api/me/", {
          method: "PUT",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Güncellenemedi");

        alert("Profil güncellendi! ✅");
        profileModal.classList.add("hidden");

        // Bilgileri tazele
        loadMe();

      } catch (e) {
        alert("Hata: " + e.message);
      }
    };
  }

  function openProfileModal() {
    if (!window._ME) return;
    document.getElementById("editName").value = window._ME.first_name;
    document.getElementById("editSurname").value = window._ME.last_name;
    document.getElementById("editEmail").value = window._ME.email;
    document.getElementById("editPhone").value = window._ME.phone || "";
    profileModal.classList.remove("hidden");
  }

});


// ===============================
// MESSAGES (MANAGER)
// ===============================
let _managerMessages = [];
let _activeMgrMsgTab = 'inbox'; // 'inbox' or 'archive'

function loadMessages() {
  const container = qs("#messagesList"); // HTML'de bu ID'yi eklememiz lazım
  if (!container) return;

  // UI Render
  container.innerHTML = `
      <div class="msg-tabs">
          <button id="mgrMsgsInbox" class="tab-btn active">Gelen Kutusu</button>
          <button id="mgrMsgsArchive" class="tab-btn">Arşiv</button>
      </div>

      <div class="table-box">
          <h3 id="mgrMsgListTitle">Gelen Kutusu</h3>
          <ul id="mgrMessageList" class="message-list"></ul>
      </div>
    `;

  // Events
  qs("#mgrMsgsInbox").onclick = () => switchMgrMsgTab('inbox');
  qs("#mgrMsgsArchive").onclick = () => switchMgrMsgTab('archive');

  fetchAndRenderMgrMessages();
}

function switchMgrMsgTab(tab) {
  _activeMgrMsgTab = tab;
  // UI update
  qs("#mgrMsgsInbox").classList.toggle("active", tab === 'inbox');
  qs("#mgrMsgsArchive").classList.toggle("active", tab === 'archive');

  const listTitle = qs("#mgrMsgListTitle");
  listTitle.textContent = tab === 'inbox' ? "Gelen Kutusu" : "Arşivlenmiş Mesajlar";

  fetchAndRenderMgrMessages();
}

async function fetchAndRenderMgrMessages() {
  const isArchived = (_activeMgrMsgTab === 'archive');
  const url = `/api/manager/messages/?archived=${isArchived}`;

  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error("Mesajlar alınamadı");

    _managerMessages = await res.json();
    renderMgrMessageList();
  } catch (e) {
    console.error(e);
    const list = qs("#mgrMessageList");
    if (list) list.innerHTML = `<p style="opacity:0.6; padding:10px;">Yüklenirken hata oluştu.</p>`;
  }
}

function renderMgrMessageList() {
  const list = qs("#mgrMessageList");
  if (!list) return;

  list.innerHTML = "";

  if (_managerMessages.length === 0) {
    list.innerHTML = `<li style="opacity:0.6; text-align:center;">Mesaj bulunamadı.</li>`;
    return;
  }

  _managerMessages.forEach(msg => {
    const dateStr = new Date(msg.created_at).toLocaleString("tr-TR");

    let statusBadge = "";
    if (msg.is_read) {
      statusBadge = `<span class="tag paid">Okundu</span>`;
    } else {
      statusBadge = `<span class="tag high">Yeni!</span>`;
    }

    const senderInfo = `<strong>${msg.sender_name}</strong> (Daire: ${msg.sender_flat})`;

    // Butonlar
    const archiveBtnText = msg.archived_by_manager ? "Arşivden Çıkar" : "Arşivle";
    const readBtn = !msg.is_read
      ? `<button class="small-btn" onclick="markMsgRead(${msg.id})">✅ Okundu İşaretle</button>`
      : ``;

    list.innerHTML += `
            <li class="msg-item ${!msg.is_read ? 'unread-glow' : ''}">
                <div class="msg-header">
                    <div>${senderInfo}</div>
                    <div style="font-size: 0.85em; opacity: 0.8;">${dateStr}</div>
                </div>
                <div class="msg-body" style="margin: 8px 0; color: #ddd;">
                    ${msg.content}
                </div>
                <div class="msg-footer" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>${statusBadge}</div>
                    <div class="actions">
                        ${readBtn}
                        <button class="small-btn outline" onclick="toggleMgrMsgArchive(${msg.id})">
                            ${msg.archived_by_manager ? '📂' : '📥'} ${archiveBtnText}
                        </button>
                    </div>
                </div>
            </li>
        `;
  });
}

// Global Actions
window.markMsgRead = async (id) => {
  try {
    const res = await fetch(`/api/manager/messages/${id}/read/`, {
      method: "PUT",
      headers: authHeaders()
    });
    if (res.ok) {
      fetchAndRenderMgrMessages();
      // Bildirim sayısını düşürebiliriz ama şimdilik kalsın
    }
  } catch (e) { console.error(e); }
};

window.toggleMgrMsgArchive = async (id) => {
  if (!confirm("Arşiv durumu değişsin mi?")) return;
  try {
    const res = await fetch(`/api/manager/messages/${id}/archive/`, {
      method: "POST",
      headers: authHeaders()
    });
    if (res.ok) fetchAndRenderMgrMessages();
  } catch (e) { console.error(e); }
};

// ===================================
//  AIDAT İŞLEMLERİ (Arşiv / Silme)
// ===================================

// Arşive Al
window.archiveDue = async (id) => {
  if (!confirm("Bu kaydı arşivlemek istiyor musunuz?")) return;
  try {
    const res = await fetch(API.updateDueStatus(id), {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "archive" })
    });
    if (!res.ok) throw new Error("İşlem başarısız");
    loadDuesList();
  } catch (e) { alert("Hata: " + e.message); }
};

// Aktife Al (Restore)
window.restoreDue = async (id) => {
  if (!confirm("Bu kaydı tekrar aktif listeye almak istiyor musunuz?")) return;
  try {
    const res = await fetch(API.updateDueStatus(id), {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "restore" })
    });
    if (!res.ok) throw new Error("İşlem başarısız");
    loadDuesList();
  } catch (e) { alert("Hata: " + e.message); }
};

// Ödeme Durumu Değiştir (Paid/Pending)
window.togglePaymentStatus = async (id, status) => {
  if (!confirm(`Durumu '${status}' olarak güncellemek istiyor musunuz?`)) return;
  try {
    const res = await fetch(API.updateDueStatus(id), {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status: status })
    });
    if (!res.ok) throw new Error("Durum güncellenemedi");
    loadDuesList();
  } catch (e) { alert("Hata: " + e.message); }
};