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

  // CSV butonu varsa olay bağla
  const csvBtn = document.getElementById("exportCSV");
  if (csvBtn) csvBtn.addEventListener("click", exportCSV);
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
    const data = await authFetch("/api/transactions/");
    if (!data || !Array.isArray(data)) return;

    const income = data.filter(t => t.type === "income");
    const expense = data.filter(t => t.type === "expense");

    const totalIncome = income.reduce((a, b) => a + parseFloat(b.amount), 0);
    const totalExpense = expense.reduce((a, b) => a + parseFloat(b.amount), 0);
    const balance = totalIncome - totalExpense;

    // Kartları güncelle
    updateCard("reportTotalIncome", totalIncome);
    updateCard("reportTotalExpense", totalExpense);
    updateCard("reportBalance", balance);

    // Tablo ve grafikler
    fillTable(data);
    drawCharts(income, expense);

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
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${tr.date}</td>
        <td>${tr.type === "income" ? "Gelir" : "Gider"}</td>
        <td>${tr.category}</td>
        <td>${tr.description}</td>
        <td>₺${parseFloat(tr.amount).toFixed(2)}</td>
      </tr>
    `);
  });
}

// ===== GRAFİKLER =====
function drawCharts(income, expense) {
  if (typeof Chart === "undefined") {
    console.error("Chart.js yüklenmemiş!");
    return;
  }

  const ctx1 = document.getElementById("monthlyChart");
  const ctx2 = document.getElementById("categoryChart");
  if (!ctx1 || !ctx2) return;

  // Aylık gelir/gider hesapla
  const months = [...new Set([...income, ...expense].map(t => t.date.slice(0, 7)))];
  const incomeByMonth = months.map(m => income
    .filter(t => t.date.startsWith(m))
    .reduce((a, b) => a + parseFloat(b.amount), 0));
  const expenseByMonth = months.map(m => expense
    .filter(t => t.date.startsWith(m))
    .reduce((a, b) => a + parseFloat(b.amount), 0));

  new Chart(ctx1, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        { label: "Gelir", data: incomeByMonth, backgroundColor: "#4CAF50" },
        { label: "Gider", data: expenseByMonth, backgroundColor: "#E74C3C" },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } },
    },
  });

  // Kategori bazlı gider
  const categories = [...new Set(expense.map(t => t.category))];
  const totals = categories.map(cat => expense
    .filter(t => t.category === cat)
    .reduce((a, b) => a + parseFloat(b.amount), 0));

  new Chart(ctx2, {
    type: "pie",
    data: {
      labels: categories,
      datasets: [{
        data: totals,
        backgroundColor: [
          "#E74C3C", "#3498DB", "#F1C40F",
          "#2ECC71", "#9B59B6", "#1ABC9C", "#95A5A6",
        ],
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "right" } },
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
