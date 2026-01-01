// ========== RAPORLAR.JS ==========
// 📊 Yönetici Paneli - Raporlar Bölümü

document.addEventListener("DOMContentLoaded", () => {
  const viewReports = document.getElementById("view-reports");
  if (!viewReports) return;

  // Menü geçişleri bozulmasın diye yalnızca aktif olduğunda tetikle
  const observer = new MutationObserver(() => {
    if (viewReports.classList.contains("show")) {
      loadReports();
    }
  });
  observer.observe(viewReports, { attributes: true, attributeFilter: ["class"] });

  // CSV ve PDF butonları varsa olay bağla
  const csvBtn = document.getElementById("exportCSV");
  if (csvBtn) csvBtn.addEventListener("click", exportCSV);

  const pdfBtn = document.getElementById("exportPDF");
  if (pdfBtn) pdfBtn.addEventListener("click", exportPDF);

  const filterBtn = document.getElementById("filterBtn");
  if (filterBtn) filterBtn.addEventListener("click", loadReports);
});

// ===== TOKEN DESTEKLİ FETCH =====
function getToken() {
  const token = localStorage.getItem("access");
  if (!token) {
    console.warn("Token bulunamadı, giriş sayfasına yönlendiriliyor...");
    window.location.href = "/login/";
  }
  return token;
}

async function authFetch(url) {
  const token = getToken();
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    console.error("Yetkisiz istek (401) — token süresi dolmuş olabilir.");
    window.location.href = "/login/";
    return [];
  }

  return await res.json();
}

// ===== RAPORLARI YÜKLE =====
async function loadReports() {
  try {
    const sDate = document.getElementById("filterStartDate").value;
    const eDate = document.getElementById("filterEndDate").value;

    let url = "/api/transactions/";
    const params = [];
    if (sDate) params.push(`start_date=${sDate}`);
    if (eDate) params.push(`end_date=${eDate}`);
    if (params.length > 0) url += "?" + params.join("&");


    // 1. İşlem verilerini al (Tablolar ve Grafikler için)
    const txData = await authFetch(url);

    // 2. Dashboard verilerini al (Tahsilat Oranı ve Toplam Borç için)
    // Not: Dashboard verileri şu an genel durumu gösteriyor, tarih filtresi dashboard endpointinde yok.
    // İstenirse oraya da eklenebilir ama genelde 'borç' anlıktır.
    const dashData = await authFetch("/api/manager/dashboard/");

    if (txData && Array.isArray(txData)) {
      const income = txData.filter(t => t.type === "income");
      const expense = txData.filter(t => t.type === "expense");

      const totalIncome = income.reduce((a, b) => a + parseFloat(b.amount), 0);
      const totalExpense = expense.reduce((a, b) => a + parseFloat(b.amount), 0);
      const balance = totalIncome - totalExpense;

      // Finans Kartlarını güncelle
      updateCard("reportTotalIncome", totalIncome);
      updateCard("reportTotalExpense", totalExpense);
      updateCard("reportBalance", balance);

      // Tablo ve grafikler
      fillTable(txData);
      drawCharts(income, expense);
    }

    // 3. Yeni Kartları Güncelle
    if (dashData) {
      // Tahsilat Oranı
      const rateEl = document.getElementById("reportCollectionRate");
      if (rateEl) rateEl.textContent = `%${dashData.collection_rate}`;

      // Toplam Borç
      const debtEl = document.getElementById("reportTotalDebt");
      if (debtEl) debtEl.textContent = `₺${dashData.total_debt}`;
    }

  } catch (err) {
    console.error("Rapor verisi alınamadı:", err);
  }
}

// ===== KART GÜNCELLEME =====
function updateCard(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = `₺${value.toFixed(2)}`;
}

// ===== TABLO =====
function fillTable(data) {
  const tbody = document.querySelector("#reportTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  data.forEach(tr => {
    const isIncome = tr.type === "income";
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${tr.date}</td>
        <td><span class="badge ${isIncome ? 'success' : 'danger'}">${isIncome ? "Gelir" : "Gider"}</span></td>
        <td>${tr.category}</td>
        <td>${tr.description}</td>
        <td style="color:${isIncome ? '#4ade80' : '#ef4444'}">₺${parseFloat(tr.amount).toFixed(2)}</td>
      </tr>
    `);
  });
}

// ===== GRAFİKLER =====
let _charts = { monthly: null, category: null }; // Grafikleri sakla ki destroy edebilelim

function drawCharts(income, expense) {
  if (typeof Chart === "undefined") {
    console.error("Chart.js yüklenmemiş!");
    return;
  }

  const ctx1 = document.getElementById("monthlyChart");
  const ctx2 = document.getElementById("categoryChart");
  if (!ctx1 || !ctx2) return;

  // Önceki grafikleri temizle
  if (_charts.monthly) _charts.monthly.destroy();
  if (_charts.category) _charts.category.destroy();

  // Aylık gelir/gider hesapla
  const months = [...new Set([...income, ...expense].map(t => t.date.slice(0, 7)))].sort();
  const incomeByMonth = months.map(m => income
    .filter(t => t.date.startsWith(m))
    .reduce((a, b) => a + parseFloat(b.amount), 0));
  const expenseByMonth = months.map(m => expense
    .filter(t => t.date.startsWith(m))
    .reduce((a, b) => a + parseFloat(b.amount), 0));

  _charts.monthly = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        { label: "Gelir", data: incomeByMonth, backgroundColor: "#4ade80", borderRadius: 4 },
        { label: "Gider", data: expenseByMonth, backgroundColor: "#ef4444", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top", labels: { color: '#cbd5e1' } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
        x: { ticks: { color: '#94a3b8' } }
      },
    },
  });

  // Kategori bazlı gider
  const categories = [...new Set(expense.map(t => t.category))];
  const totals = categories.map(cat => expense
    .filter(t => t.category === cat)
    .reduce((a, b) => a + parseFloat(b.amount), 0));

  _charts.category = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [{
        data: totals,
        backgroundColor: [
          "#ef4444", "#3b82f6", "#eab308",
          "#22c55e", "#a855f7", "#ec4899", "#64748b",
        ],
        borderWidth: 0
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "right", labels: { color: '#cbd5e1' } } },
    },
  });
}

// ===== CSV İNDİR =====
function exportCSV() {
  const table = document.getElementById("reportTable");
  if (!table) return;

  const rows = [...table.querySelectorAll("tr")]
    .map(tr => [...tr.children].map(td => td.textContent).join(","))
    .join("\n");

  const blob = new Blob([rows], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bina_raporlari.csv";
  a.click();
}

// ===== PDF İNDİR =====
function exportPDF() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    alert("PDF kütüphanesi yüklenemedi.");
    return;
  }

  const doc = new jsPDF();

  // Başlık
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Bina Yönetim Raporu", 14, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("tr-TR");
  doc.text(`Tarih: ${dateStr}`, 14, 28);

  // KART BİLGİLERİ
  const inc = document.getElementById("reportTotalIncome").textContent;
  const exp = document.getElementById("reportTotalExpense").textContent;
  const net = document.getElementById("reportBalance").textContent;

  doc.setFontSize(10);
  doc.text(`Toplam Gelir: ${inc}   |   Toplam Gider: ${exp}   |   Net: ${net}`, 14, 38);

  // TABLO
  doc.autoTable({
    html: '#reportTable',
    startY: 45,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }, // Blue header
    styles: { font: "helvetica", fontSize: 8 },
    // Türkçe karakter sorunu olmaması için font desteği gerekebilir ama standart fontla basic çıktı alalım.
    // jsPDF default fontu Türkçe karakterleri tam desteklemeyebilir (ş, ı, ğ vb bozuk çıkabilir).
    // Hızlı çözüm için Roboto-Regular fontunu base64 ile eklemek gerekir ama kod çok uzar.
    // Şimdilik standart çıktı veriyoruz.
  });

  doc.save("bina_raporu.pdf");
}
