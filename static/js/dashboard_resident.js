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

  function translateStatus(status) {
  const s = status.toLowerCase();
  if (s === "pending") return "Bekliyor";
  if (s === "paid") return "Ödendi";
  if (s === "overdue") return "Gecikmiş";
  return status;
}
function translateLevel(level) {
  const l = level.toLowerCase();
  if (l === "low") return "Düşük";
  if (l === "medium") return "Orta";
  if (l === "high") return "Yüksek";
  return level;
}


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
            <span class="tag ${d.status}">${translateStatus(d.status)}</span>
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
            <span class="tag ${a.level}">${translateLevel(a.level)}</span>
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
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody id="paymentTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- Modal -->
    <div id="payModal" class="modal hidden">
      <div class="modal-card">
        <h3>Ödeme Bildir</h3>
        <p id="payModalInfo" style="opacity:.8;margin-top:-6px;"></p>

        <input type="number" id="payAmount" placeholder="Tutar" step="0.01" />
        <input type="file" id="payFile" accept=".pdf,image/*" />

        <div class="modal-actions">
          <button id="paySendBtn">Gönder</button>
          <button id="payCancelBtn" class="ghost">İptal</button>
        </div>

        <small id="payModalMsg" style="display:block;margin-top:8px;"></small>
      </div>
    </div>
  `;

  const res = await fetch("/api/resident/dues/", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  const tbody = qs("#paymentTableBody");

  const statusTR = { pending: "Bekliyor", paid: "Ödendi", overdue: "Gecikmiş" };

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;opacity:.7;padding:16px;">
          Henüz aidat kaydı yok.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${fmtDate(d.month)}</td>
      <td>${fmtMoney(d.amount)}</td>
      <td>${fmtDate(d.due_date)}</td>
      <td><span class="tag ${d.status}">${statusTR[d.status] || d.status}</span></td>
      <td>${d.paid_date ? fmtDate(d.paid_date) : "-"}</td>
      <td>
        ${d.status === "paid" ? "-" : `<button class="payBtn" data-id="${d.id}" data-amount="${d.amount}" data-month="${fmtDate(d.month)}">Ödeme Bildir</button>`}
      </td>
    </tr>
  `).join("");

  // modal wiring
  const modal = qs("#payModal");
  const info = qs("#payModalInfo");
  const amountInp = qs("#payAmount");
  const fileInp = qs("#payFile");
  const msg = qs("#payModalMsg");
  let currentDueId = null;

  qsa(".payBtn").forEach(b => {
    b.addEventListener("click", () => {
      currentDueId = b.dataset.id;
      amountInp.value = b.dataset.amount;
      info.textContent = `${b.dataset.month} aidatı için dekont yükle.`;
      msg.textContent = "";
      fileInp.value = "";
      modal.classList.remove("hidden");
    });
  });

  qs("#payCancelBtn").onclick = () => modal.classList.add("hidden");

  // ✅ DÜZELTİLMİŞ KOD (Bunu Yapıştır)
qs("#paySendBtn").onclick = async () => {
    const btn = qs("#paySendBtn"); // Butonu seç
    
    try {
      if (!currentDueId) return;
      
      // Çift tıklamayı önlemek için butonu devre dışı bırak
      btn.disabled = true;
      btn.textContent = "Gönderiliyor...";
      
      const f = fileInp.files[0] || null;
      
      // SADECE BİR KERE ÇAĞIR
      await sendPaymentNotification(currentDueId, amountInp.value, f);

      msg.textContent = "Bildirim yönetime gönderildi ✅";
      msg.style.color = "lightgreen";

      // 1 sn sonra kapat ve tabloyu yenile
      setTimeout(() => {
        modal.classList.add("hidden");
        loadPaymentsPage();
        // Butonu eski haline getir
        btn.disabled = false; 
        btn.textContent = "Gönder";
      }, 1000);

    } catch (e) {
      console.error(e);
      msg.textContent = (e.detail || "Bir hata oluştu.");
      msg.style.color = "salmon";
      
      // Hata olursa butonu tekrar aç
      btn.disabled = false;
      btn.textContent = "Gönder";
    }
};
}


/* -----------------------------
   4) FINANCES PAGE (/transactions/)
------------------------------ */
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

  try {
    const res = await fetch("/api/transactions/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) throw new Error("Veri alınamadı");
    
    const data = await res.json();

    // ⬇️ BURAYI EKLEDİK: Tarihe göre (Yeniden Eskiye) sırala
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = qs("#finTableBody");

    if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:15px;'>Kayıt bulunamadı.</td></tr>";
        return;
    }

    data.forEach((t) => {
      // Renklendirme ve + - işareti mantığı (isteğe bağlı güzelleştirme)
      const isIncome = t.type === "income" || t.type === "Gelir";
      const colorStyle = isIncome ? "color: #4ade80;" : "color: #f87171;";
      const sign = isIncome ? "+" : "-";

      tbody.innerHTML += `
        <tr>
          <td>${fmtDate(t.date)}</td>
          <td>${t.type}</td>
          <td>${t.category}</td>
          <td>${t.description}</td>
          <td style="${colorStyle}">${sign}${fmtMoney(t.amount)}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

/* -----------------------------
   5) ANNOUNCEMENTS PAGE (/announcements/)
------------------------------ */
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

  try {
    const res = await fetch("/api/announcements/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Duyurular alınamadı");

    const data = await res.json();

    // ⬇️ BURAYI EKLEDİK: Tarihe göre (Yeniden Eskiye) sırala
    // (date_created alanına göre sıralıyoruz)
    data.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

    const list = qs("#annFullList");

    if (data.length === 0) {
        list.innerHTML = "<p style='padding:15px; opacity:0.7;'>Henüz hiç duyuru yok.</p>";
        return;
    }

    list.innerHTML = data
      .map(
        (a, i) => `
        <div class="ann-card" data-index="${i}">
          <div class="ann-card-header">
            <div>
              <span class="ann-card-title">${a.title}</span>
              <span class="ann-card-date">${a.date_created.slice(0,10)}</span>
            </div>
            <span class="tag ${a.level.toLowerCase()}">${translateLevel(a.level)}</span>
          </div>

          <div class="ann-card-body">
            ${a.message || "<i>(mesaj yok)</i>"}
          </div>
        </div>
      `
      )
      .join("");

    // Expand (Aç/Kapa) olayları
    const cards = qsa(".ann-card");
    let openCard = null;

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        if (openCard && openCard !== card) openCard.classList.remove("expanded");
        card.classList.toggle("expanded");
        openCard = card.classList.contains("expanded") ? card : null;
      });
    });

  } catch (err) {
    console.error(err);
  }
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
  // Senin mevcut fonksiyonların
  renderDashboardLayout();
  loadUser();
  loadResidentDashboard();

  // --- BURADAN AŞAĞISINI EKLE (RESPONSIVE MENÜ MANTIĞI) ---
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuItems = document.querySelectorAll("#menuList li");

  // Menü Açma
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.add("active");
      if (overlay) overlay.classList.add("active");
    });
  }

  // Menü Kapatma (Overlay'e tıklayınca veya menüden seçim yapınca)
  const closeMenu = () => {
    sidebar.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
  };

  if (overlay) overlay.addEventListener("click", closeMenu);

  // Menüdeki bir linke tıklayınca mobildeysek menüyü kapat
  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        closeMenu();
      }
    });
  });
});

async function sendPaymentNotification(dueId, amount, file) {
  const formData = new FormData();
  formData.append("due", dueId);
  formData.append("amount", amount);

  // dosya varsa ekle
  if (file) {
    formData.append("file", file);
  }

  const response = await fetch("/api/resident/payment-notify/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("access")}`
      // NOT: FormData kullanırken 'Content-Type': 'multipart/form-data' EKLEME!
      // Tarayıcı bunu otomatik halleder.
    },
    body: formData
  });

  // Hata Kontrolü (Önce JSON olup olmadığına bak)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const data = await response.json();
    if (!response.ok) throw data; // JSON hatası varsa fırlat
    return data;
  } else {
    // JSON değilse (örn: HTML hata sayfası) metni alıp hata fırlat
    const text = await response.text();
    console.error("Sunucu Hatası (HTML):", text); 
    throw { detail: "Sunucu hatası oluştu (500). Konsolu kontrol edin." };
  }
}

