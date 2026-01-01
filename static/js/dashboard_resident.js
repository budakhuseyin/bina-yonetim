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
      <p class="value">${data.next_due ? fmtMoney(data.next_due.amount) : "₺0"
    }</p>
      <small>
        ${data.next_due
      ? `${fmtDate(data.next_due.due_date)} son tarih`
      : "Yaklaşan ödeme görünmüyor"
    }
      </small>
    </div>

    <div class="card blue">
      <h3>Son Ödeme</h3>
      <p class="value">${data.last_payment ? fmtMoney(data.last_payment.amount) : "₺0"
    }</p>
      <small>
        ${data.last_payment
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

    <!-- ÖZET KART (Toplam Ödenen) -->
    <div class="cards" style="margin-bottom: 25px;">
        <div class="card green">
            <h3>Toplam Ödenen Miktar</h3>
            <div class="value" id="totalPaidDisplay">₺0.00</div>
            <small>Bugüne kadar yaptığınız tüm ödemeler.</small>
        </div>
    </div>

    <!-- TABS -->
    <div class="msg-tabs">
        <button class="tab-btn active" id="tabActiveDues">Ödenmemiş Aidatlar</button>
        <button class="tab-btn" id="tabHistoryDues">Ödeme Geçmişi (Arşiv)</button>
    </div>

    <!-- LİSTE -->
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

  // --- TAB CONTROL VARS ---
  let _allDues = [];
  let _activeTab = 'active'; // 'active' | 'history'

  try {
    const res = await fetch("/api/resident/dues/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Veri alınamadı");
    _allDues = await res.json();
  } catch (e) {
    console.error(e);
    qs("#paymentTableBody").innerHTML = `<tr><td colspan="6" style="padding:15px; color:red;">Hata: ${e.message}</td></tr>`;
    return;
  }

  // 1. Hesapla Toplam Ödenen
  const totalPaid = _allDues
    .filter(d => d.status === 'paid')
    .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  qs("#totalPaidDisplay").textContent = fmtMoney(totalPaid);

  // 2. Render Functions
  const renderDues = () => {
    const tbody = qs("#paymentTableBody");
    tbody.innerHTML = "";

    // Filter based on tab
    let list = [];
    if (_activeTab === 'active') {
      list = _allDues.filter(d => d.status !== 'paid'); // Pending, Overdue
    } else {
      list = _allDues.filter(d => d.status === 'paid'); // Paid
    }

    // Empty State
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:0.6; padding:20px;">Kayıt bulunamadı.</td></tr>`;
      return;
    }

    const statusTR = { pending: "Bekliyor", paid: "Ödendi", overdue: "Gecikmiş" };

    // Render Rows
    tbody.innerHTML = list.map(d => `
        <tr>
          <td>${fmtDate(d.month)}</td>
          <td>${fmtMoney(d.amount)}</td>
          <td>${fmtDate(d.due_date)}</td>
          <td><span class="tag ${d.status}">${statusTR[d.status] || d.status}</span></td>
          <td>${d.paid_date ? fmtDate(d.paid_date) : "-"}</td>
          <td>
            ${d.status === 'paid'
        ? '<span style="color:#4ade80;">✔ Tamamlandı</span>'
        : `<button class="payBtn" data-id="${d.id}" data-amount="${d.amount}" data-month="${fmtDate(d.month)}">Ödeme Bildir</button>`
      }
          </td>
        </tr>
      `).join("");

    // Re-attach events for "Ödeme Bildir"
    if (_activeTab === 'active') attachPayEvents();
  };

  // 3. Tab Click Events
  qs("#tabActiveDues").onclick = () => {
    _activeTab = 'active';
    qs("#tabActiveDues").classList.add("active");
    qs("#tabHistoryDues").classList.remove("active");
    renderDues();
  };
  qs("#tabHistoryDues").onclick = () => {
    _activeTab = 'history';
    qs("#tabHistoryDues").classList.add("active");
    qs("#tabActiveDues").classList.remove("active");
    renderDues();
  };

  // 4. Initial Render
  renderDues();


  // --- MODAL EVENTS ---
  const modal = qs("#payModal");
  const info = qs("#payModalInfo");
  const amountInp = qs("#payAmount");
  const fileInp = qs("#payFile");
  const msg = qs("#payModalMsg");
  let currentDueId = null;

  function attachPayEvents() {
    qsa(".payBtn").forEach(b => {
      b.addEventListener("click", () => {
        currentDueId = b.dataset.id;
        amountInp.value = b.dataset.amount; // Varsayılan tutar
        info.textContent = `${b.dataset.month} aidatı için dekont yükle.`;
        msg.textContent = "";
        fileInp.value = "";
        modal.classList.remove("hidden");
      });
    });
  }

  qs("#payCancelBtn").onclick = () => modal.classList.add("hidden");

  qs("#paySendBtn").onclick = async () => {
    const btn = qs("#paySendBtn");
    try {
      if (!currentDueId) return;

      btn.disabled = true;
      btn.textContent = "Gönderiliyor...";

      const f = fileInp.files[0] || null;
      await sendPaymentNotification(currentDueId, amountInp.value, f);

      msg.textContent = "Bildirim yönetime gönderildi ✅";
      msg.style.color = "lightgreen";

      setTimeout(() => {
        modal.classList.add("hidden");
        // Sayfayı değil, sadece tabloyu yenileyebiliriz ama basitlik için fonksiyonu tekrar çağırmak yerine datayı güncelleyebiliriz? 
        // En temizi sayfayı yenilemek çünkü status değişebilir (bildirim gidince status değişmiyor ama user feedback için reload iyidir).
        loadPaymentsPage();
      }, 1000);

    } catch (e) {
      console.error(e);
      msg.textContent = (e.detail || "Bir hata oluştu.");
      msg.style.color = "salmon";
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
    <p class="page-subtitle">Binanızın genel mali durumu ve hesap hareketleri.</p>

    <!-- ÖZET KARTLAR -->
    <div class="cards" style="margin-bottom: 25px;">
        <div class="card green">
            <h3>Toplam Gelir</h3>
            <div class="value" id="totalIncomeDisplay">₺0.00</div>
            <small>Toplanan ödemeler.</small>
        </div>
        <div class="card red" style="border-left: 5px solid #ef4444;">
            <h3>Toplam Gider</h3>
            <div class="value" id="totalExpenseDisplay">₺0.00</div>
            <small>Harcamalar.</small>
        </div>
        <div class="card blue">
            <h3>Kasa Durumu</h3>
            <div class="value" id="netBalanceDisplay">₺0.00</div>
            <small>Mevcut bakiye.</small>
        </div>
    </div>

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
    // Tarihe göre sırala
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    // --- HESAPLAMALAR ---
    let totalInc = 0;
    let totalExp = 0;

    data.forEach(t => {
      const amt = parseFloat(t.amount);
      if (t.type === 'income') totalInc += amt;
      else if (t.type === 'expense') totalExp += amt;
    });

    qs("#totalIncomeDisplay").textContent = fmtMoney(totalInc);
    qs("#totalExpenseDisplay").textContent = fmtMoney(totalExp);
    qs("#netBalanceDisplay").textContent = fmtMoney(totalInc - totalExp);


    // --- TABLO ---
    const tbody = qs("#finTableBody");
    if (data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:15px;'>Kayıt bulunamadı.</td></tr>";
      return;
    }

    const typeTr = {
      income: '<span class="tag paid">GELİR</span>',
      expense: '<span class="tag overdue">GİDER</span>'
    };

    tbody.innerHTML = "";
    data.forEach((t) => {
      const isIncome = t.type === "income";
      const colorStyle = isIncome ? "color: #4ade80;" : "color: #f87171;";
      const sign = isIncome ? "+" : "-";

      // Kategori düzeltme
      const catDisplay = t.category.charAt(0).toUpperCase() + t.category.slice(1);

      tbody.innerHTML += `
        <tr>
          <td>${fmtDate(t.date)}</td>
          <td>${typeTr[t.type] || t.type}</td>
          <td>${catDisplay}</td>
          <td>${t.description}</td>
          <td style="${colorStyle}">${sign}${fmtMoney(t.amount)}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
    qs("#mainContent").innerHTML += `<p style="color:red; padding:20px;">Hata: ${err.message}</p>`;
  }
}

/* -----------------------------
/* -----------------------------
   5) ANNOUNCEMENTS PAGE (/announcements/)
------------------------------ */
/* -----------------------------
   5) ANNOUNCEMENTS PAGE (/announcements/)
------------------------------ */
// --- DUYURU YARDIMCI FONKS (Resident) ---
window.toggleResidentAnnArchive = (id) => {
  // Event bubbling engelle (Accordion açılmasın)
  if (event) event.stopPropagation();

  let hiddenIds = JSON.parse(localStorage.getItem("residentHiddenAnnouncements") || "[]");
  const strId = String(id);

  if (hiddenIds.includes(strId)) {
    // Geri yükle (Restore)
    hiddenIds = hiddenIds.filter(x => x !== strId);
  } else {
    // Arşivle (Hide)
    hiddenIds.push(strId);
  }

  localStorage.setItem("residentHiddenAnnouncements", JSON.stringify(hiddenIds));
  // Sayfayı değil ama listeyi yenilesek daha şık olur ama şimdilik sayfayı reload ediyoruz basitçe
  // Veya tekrar loadAnnouncementsPage() çağıralım:
  loadAnnouncementsPage();
};

async function loadAnnouncementsPage() {
  const main = qs("#mainContent");

  // Eğer global bir tab değişkenimiz yoksa oluştur
  if (typeof window._resAnnTab === 'undefined') window._resAnnTab = 'active';

  main.innerHTML = `
    <div class="ann-page-title">
      <span class="icon">📢</span>
      <h1>Duyurular</h1>
    </div>
    <p class="page-subtitle">Bina yöneticinizin paylaştığı tüm duyurular.</p>

    <!-- TABS -->
    <div class="msg-tabs">
        <button class="tab-btn ${window._resAnnTab === 'active' ? 'active' : ''}" id="tabResAnnActive">Güncel Duyurular</button>
        <button class="tab-btn ${window._resAnnTab === 'archive' ? 'active' : ''}" id="tabResAnnArchive">Arşiv (Gizlenenler)</button>
    </div>

    <section class="tables">
      <div class="table-box">
        <div id="annFullList"></div>
      </div>
    </section>
  `;

  // Tab Events
  qs("#tabResAnnActive").onclick = () => { window._resAnnTab = 'active'; loadAnnouncementsPage(); };
  qs("#tabResAnnArchive").onclick = () => { window._resAnnTab = 'archive'; loadAnnouncementsPage(); };


  try {
    const res = await fetch("/api/announcements/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Duyurular alınamadı");

    const data = await res.json();
    // Tarihe göre (Yeniden Eskiye) sırala
    data.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

    // --- FILTERING (LocalStorage) ---
    const hiddenIds = JSON.parse(localStorage.getItem("residentHiddenAnnouncements") || "[]");

    const filtered = data.filter(a => {
      const isHidden = hiddenIds.includes(String(a.id));
      if (window._resAnnTab === 'active') return !isHidden;
      return isHidden; // archive tab
    });


    const list = qs("#annFullList");

    if (filtered.length === 0) {
      list.innerHTML = `<p style='padding:15px; opacity:0.7;'>${window._resAnnTab === 'active' ? 'Güncel duyuru yok.' : 'Arşivlenmiş duyuru yok.'}</p>`;
      return;
    }

    list.innerHTML = filtered
      .map(
        (a, i) => {
          const isArchived = (window._resAnnTab === 'archive');
          const btnText = isArchived ? "Geri Yükle" : "Arşivle";
          const btnIcon = isArchived ? "♻️" : "📦";

          return `
        <div class="ann-card" onclick="this.classList.toggle('expanded')">
          <div class="ann-card-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="ann-card-title">${a.title}</span>
              <span class="ann-card-date">${a.date_created.slice(0, 10)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="tag ${a.level.toLowerCase()}">${translateLevel(a.level)}</span>
                <button class="small-btn outline" onclick="toggleResidentAnnArchive(${a.id})">
                    ${btnIcon} ${btnText}
                </button>
            </div>
          </div>

          <div class="ann-card-body">
            ${a.message || "<i>(mesaj yok)</i>"}
          </div>
        </div>
      `})
      .join("");

  } catch (err) {
    console.error(err);
  }
}

/* -----------------------------
   6) MESSAGES PAGE (placeholder)
------------------------------ */
/* -----------------------------
   6) MESSAGES PAGE (RESIDENT)
------------------------------ */
let _residentMessages = [];
let _activeMsgTab = 'inbox'; // 'inbox' or 'archive'

async function loadMessagesPage() {
  const main = qs("#mainContent");
  main.innerHTML = `
    <div class="ann-page-title">
      <span class="icon">💬</span>
      <h1>Mesajlar</h1>
    </div>
    <p class="page-subtitle">Yönetime iletilen mesajlarınız.</p>

    <!-- TABLAR -->
    <div class="msg-tabs">
        <button id="tabInbox" class="tab-btn active">Gelen Kutusu / Gönderilenler</button>
        <button id="tabArchive" class="tab-btn">Arşiv</button>
    </div>

    <div class="msg-container">
      <!-- FORM (Sadece Inbox sekmesinde görünür olsun veya her zaman üstte kalsın) -->
      <div class="msg-form-box" id="msgFormBox">
        <h3>Yeni Mesaj Gönder</h3>
        <textarea id="msgContent" rows="3" placeholder="Yönetime bir not bırakın..."></textarea>
        <button id="msgSendBtn">Gönder</button>
      </div>

      <!-- LİSTE -->
      <div class="table-box">
        <h3 id="msgListTitle">Mesaj Geçmişi (Aktif)</h3>
        <ul id="messageList" class="message-list"></ul>
      </div>
    </div>
  `;

  // Tab events
  const tabInbox = qs("#tabInbox");
  const tabArchive = qs("#tabArchive");

  tabInbox.onclick = () => switchMsgTab('inbox');
  tabArchive.onclick = () => switchMsgTab('archive');

  // Send event
  qs("#msgSendBtn").onclick = sendMessage;

  // İlk yükleme
  await fetchAndRenderMessages();
}

function switchMsgTab(tab) {
  _activeMsgTab = tab;
  // UI update
  qs("#tabInbox").classList.toggle("active", tab === 'inbox');
  qs("#tabArchive").classList.toggle("active", tab === 'archive');

  // Form sadece inboxta görünsün (isteğe bağlı, burada her zaman görünsün dedim ama başlık değişsin)
  const listTitle = qs("#msgListTitle");
  listTitle.textContent = tab === 'inbox' ? "Mesaj Geçmişi (Aktif)" : "Arşivlenmiş Mesajlar";

  // Yeniden çek
  fetchAndRenderMessages();
}

async function fetchAndRenderMessages() {
  const isArchived = (_activeMsgTab === 'archive');
  const url = `/api/resident/messages/?archived=${isArchived}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Mesajlar alınamadı");
    }

    _residentMessages = await res.json();
    renderMessageList();
  } catch (e) {
    console.error(e);
    qs("#messageList").innerHTML = `<p style="opacity:0.6; padding:10px; color:red;">Hata: ${e.message}</p>`;
  }
}

function renderMessageList() {
  const list = qs("#messageList");
  list.innerHTML = "";

  if (_residentMessages.length === 0) {
    list.innerHTML = `<li style="opacity:0.6; text-align:center;">Mesaj bulunamadı.</li>`;
    return;
  }

  _residentMessages.forEach(msg => {
    const dateStr = new Date(msg.created_at).toLocaleString("tr-TR");
    const statusBadge = msg.is_read
      ? `<span class="tag paid">Yönetici Okudu</span>`
      : `<span class="tag pending">İletildi</span>`;

    const archiveBtnText = msg.archived_by_resident ? "Arşivden Çıkar" : "Arşivle";
    const archiveIcon = msg.archived_by_resident ? "📂" : "📥";

    list.innerHTML += `
            <li class="msg-item">
                <div class="msg-header">
                    <span class="msg-date">${dateStr}</span>
                    ${statusBadge}
                </div>
                <div class="msg-body">
                    ${msg.content}
                </div>
                <div class="msg-footer">
                    <button class="small-btn outline" onclick="toggleArchiveMessage(${msg.id})">
                        ${archiveIcon} ${archiveBtnText}
                    </button>
                </div>
            </li>
        `;
  });
}

async function sendMessage() {
  const txt = qs("#msgContent");
  const content = txt.value.trim();
  if (!content) return alert("Mesaj boş olamaz.");

  try {
    const res = await fetch("/api/resident/messages/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Gönderilemedi (Sunucu Hatası)");
    }

    // Başarılı
    txt.value = "";
    // Inbox'a dön ve yenile
    if (_activeMsgTab !== 'inbox') switchMsgTab('inbox');
    else fetchAndRenderMessages();

  } catch (e) {
    alert("Hata: " + e.message);
  }
}

// Global scope'a ekleyelim ki HTML onclick çalışsın
window.toggleArchiveMessage = async function (id) {
  if (!confirm("Bu mesajın arşiv durumunu değiştirmek istiyor musunuz?")) return;

  try {
    const res = await fetch(`/api/resident/messages/${id}/archive/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("İşlem başarısız");

    // Listeyi yenile
    fetchAndRenderMessages();
  } catch (e) {
    alert("Hata: " + e.message);
  }
};

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


// ===============================
// PROFILE UPDATE LOGIC (Resident)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // Topbar'daki kullanıcı bilgisine tıklayınca modal aç (Event Delegation)
  document.body.addEventListener("click", (e) => {
    if (e.target.closest(".topbar .user-info")) {
      openProfileModal();
    }
  });

  // Sidebar'daki menüden profil açma (Mobil)
  // resident tarafında sidebar'da profil var mı kontrol etmeliyiz, yoksa es geçilir.

  // Modal Butonları
  const saveBtn = document.getElementById("saveProfileBtn");
  const closeBtn = document.getElementById("closeProfileBtn");
  const modal = document.getElementById("profileModal");

  if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const payload = {
        first_name: document.getElementById("editName").value,
        last_name: document.getElementById("editSurname").value,
        email: document.getElementById("editEmail").value,
        phone: document.getElementById("editPhone").value
      };

      try {
        const res = await fetch("/api/me/", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Güncellenemedi");

        alert("Profil başarıyla güncellendi!");
        modal.classList.add("hidden");
        loadUser(); // Bilgileri tazele

      } catch (e) {
        alert("Hata: " + e.message);
      }
    };
  }
});

function openProfileModal() {
  if (!window._ME) return;
  const modal = document.getElementById("profileModal");
  if (!modal) return;

  document.getElementById("editName").value = window._ME.first_name || "";
  document.getElementById("editSurname").value = window._ME.last_name || "";
  document.getElementById("editEmail").value = window._ME.email || "";
  document.getElementById("editPhone").value = window._ME.phone || "";

  modal.classList.remove("hidden");
}
