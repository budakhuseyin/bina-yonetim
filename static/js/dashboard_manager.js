// ===============================
// dashboard_manager.js (Final & Expanded)
// ===============================

// ---- Guard + token ----
const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

// ---- Helpers ----
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
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

  // Payment Notifications
  paymentNotifications: "/api/manager/payment-notifications/",
  approvePaymentNotif: id => `/api/manager/payment-notification/${id}/approve/`,
  rejectPaymentNotif: id => `/api/manager/payment-notification/${id}/reject/`,
};

const authHeaders = (extra={}) => ({
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
      loadManagerDues();
      loadPaymentNotifications();
    }
    // Raporlar fonksiyonu varsa çağır
    if (view === "reports" && typeof loadReports === "function") loadReports();
  });
});

// in-page quick links
qsa("[data-view-link]").forEach(a=>{
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
  qs("#buildingBadge").textContent  = me.building_name || "Bina";
  qs("#avatarTop").textContent      =
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

    qs("#cardIncome").textContent   = fmtMoney(data.income_total || 0);
    qs("#cardExpenses").textContent = fmtMoney(data.expense_total || 0);
    qs("#cardNet").textContent      = fmtMoney(data.net_total || 0);
    qs("#cardPending").textContent  = data.pending_count || 0;

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
        <span class="badge">${(i.date || "").slice(0,10)}</span>
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
        const r = await fetch(url, { method:"POST", headers: authHeaders() });

        if (r.ok) {
          row.remove();
          const el = qs("#cardPending");
          el.textContent = Math.max(0, (parseInt(el.textContent)||0)-1);
        } else {
          btn.disabled = false;
          alert("İşlem başarısız.");
        }
      });
    });

  } catch(e) {
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

  } catch(e) {
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
        if(!dateStr) return "-";
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
  } catch(e) {
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
    let totalIncome=0, totalExpense=0;

    data.forEach(t => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${t.date}</td>
        <td>${translateType(t.type)}</td>
        <td>${t.category}</td>
        <td>${t.description}</td>
        <td style="color: ${t.type==="income" ? "#4ade80" : "#f87171"}">
          ${t.type==="income" ? "+" : "-"}${t.amount}
        </td>`;
      tableBody.appendChild(row);

      if (t.type==="income") totalIncome += parseFloat(t.amount);
      else totalExpense += parseFloat(t.amount);
    });

    qs("#totalIncome").textContent   = fmtMoney(totalIncome);
    qs("#totalExpenses").textContent = fmtMoney(totalExpense);
    qs("#netBalance").textContent    = fmtMoney(totalIncome-totalExpense);

  } catch(e) {
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
    method:"POST",
    headers: authHeaders({"Content-Type":"application/json"}),
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
async function loadAnnouncements() {
  const list = qs("#announcementsList");
  if (!list) return;
  list.innerHTML = "<div class='loading'>Yükleniyor...</div>";

  try {
    const res = await fetch(API.announcements, { headers: authHeaders() });
    if (!res.ok) throw new Error("ann fail");
    const data = await res.json();

    if (data.length === 0) {
      list.innerHTML = "<p class='empty'>Hiç duyuru yok.</p>";
      return;
    }

    list.innerHTML = data.map(a => `
      <div class="list-item" data-id="${a.id}">
        <div class="row header">
          <strong>${a.title}</strong>
          <span class="badge ${a.level.toLowerCase()}">${translateLevel(a.level)}</span>
        </div>
        <div class="row meta">
          <small>${(a.date_created||"").slice(0,10)}</small>
          <div class="actions">
            <button class="btn-edit">✏️</button>
            <button class="btn-delete">🗑️</button>
          </div>
        </div>
        <div class="ann-body">
            ${a.message}
        </div>
      </div>`).join("");

    // Expand ve Buton Eventlerini Bağla
    enableAnnouncementExpand();
    attachAnnouncementActions();

  } catch(e) {
    console.error(e);
    list.innerHTML = "<p class='error'>Duyurular alınamadı.</p>";
  }
}

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
        method:"DELETE",
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
        headers: authHeaders({"Content-Type":"application/json"}),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Sayfayı yenilemeden DOM güncelle
        titleEl.textContent = newTitle;
        if(msgEl) msgEl.textContent = newMsg;
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
    method:"POST",
    headers: authHeaders({"Content-Type":"application/json"}),
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

async function createMonthlyDues() {
  const month = qs("#dueMonth").value;
  const amount = qs("#dueAmount").value;
  const due_date = qs("#dueDate").value;
  const due_type = qs("#dueType").value;

  if (!month || !amount || !due_date) {
    alert("Ay / tutar / son tarih zorunlu.");
    return;
  }

  const res = await fetch(API.createMonthlyDues, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      month,
      amount,
      due_date,
      type: due_type
    })
  });

  if (res.ok) {
    alert("Aidatlar / Ücretler oluşturuldu!");
    loadManagerDues();
  } else {
    alert("Oluşturulamadı ❌");
  }
}

const monthNames = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
];

function formatMonth(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

async function loadManagerDues() {
  const tbody = qs("#duesBody");
  const res = await fetch(API.managerDues, { headers: authHeaders() });
  if (!res.ok) {
    tbody.innerHTML = "<tr><td colspan='7'>Veri alınamadı</td></tr>";
    return;
  }

  const data = await res.json();
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${d.resident_name}</td>
      <td>${formatMonth(d.month)}</td>
      <td>₺${d.amount}</td>
      <td><span class="type-badge type-${d.type || "aidat"}">${d.type || "aidat"}</span></td>
      <td>${d.due_date}</td>
      <td><span class="status-badge status-${d.status}">${translateStatus(d.status)}</span></td>
      <td>${d.paid_date || "-"}</td>
    </tr>
  `).join("");
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
    method:"PUT",
    headers: authHeaders()
  });
  loadPaymentNotifications();
  loadManagerDues();
};

window.rejectNotif = async (id) => {
  await fetch(API.rejectPaymentNotif(id), {
    method:"PUT",
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
});