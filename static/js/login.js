document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const messageBox = document.getElementById("message");
  const submitBtn = document.querySelector("button[type='submit']");

  const email = emailInput.value;
  const password = passwordInput.value;

  // 1. Önceki mesajları temizle ve butonu kilitle
  messageBox.textContent = "";
  messageBox.style.color = "inherit"; // Rengi sıfırla
  submitBtn.disabled = true;
  submitBtn.textContent = "Giriş Yapılıyor...";

  try {
    const res = await fetch("/api/auth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      // --- BAŞARILI GİRİŞ ---
      const user = data.user; // Backend'den user objesi dönüyor olmalı
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh); // Refresh token da saklayalım

      messageBox.style.color = "green";
      messageBox.textContent = "Giriş başarılı! Yönlendiriliyorsunuz...";

      // Kısa bir gecikme ile yönlendir (kullanıcı mesajı görsün)
      setTimeout(() => {
        if (user && user.role === "manager") {
          window.location.href = "/manager-dashboard/";
        } else {
          window.location.href = "/dashboard/";
        }
      }, 500);

    } else {
      // --- HATALI GİRİŞ ---
      console.error("Giriş Hatası:", data);
      
      // Backend genelde { "detail": "..." } döndürür
      let errorMsg = "Giriş yapılamadı.";
      
      if (data.detail) {
        errorMsg = "E-posta veya şifre hatalı!"; // Kullanıcıya daha net mesaj
      } else if (data.email) {
        errorMsg = "Geçerli bir e-posta adresi giriniz.";
      } else if (data.password) {
        errorMsg = "Şifre alanı boş bırakılamaz.";
      }

      messageBox.style.color = "#ef4444"; // Kırmızı renk (Tailwind red-500)
      messageBox.textContent = errorMsg;
      
      // Şifre alanını temizle
      passwordInput.value = "";
    }

  } catch (error) {
    console.error("Sunucu Hatası:", error);
    messageBox.style.color = "#ef4444";
    messageBox.textContent = "Sunucuya bağlanılamadı. İnternetinizi kontrol edin.";
  } finally {
    // İşlem bitince butonu tekrar aç
    submitBtn.disabled = false;
    submitBtn.textContent = "Giriş Yap";
  }
});
