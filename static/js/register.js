// ===============================
//  register.js (final)
// ===============================

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

 const formData = {
  full_name:
    document.getElementById("first_name").value +
    " " +
    document.getElementById("last_name").value,
  email: document.getElementById("email").value,
  password: document.getElementById("password").value,
  building_id: document.getElementById("building").value,
  apartment_number: document.getElementById("apartment_number").value,
  phone: document.getElementById("phone").value || "", // 🔥 Telefon (opsiyonel)
  role: document.getElementById("role").value,
};


  // (isteğe bağlı debug)
  // console.log("Gönderilen form:", formData);

  const res = await fetch("/api/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  const data = await res.json();
  const msg = document.getElementById("message");

  if (res.ok) {
    msg.style.color = "green";
    msg.textContent = "✅ Kayıt başarılı! Yönetici onayından sonra giriş yapabilirsiniz.";
    e.target.reset();
  } else {
    msg.style.color = "red";
    msg.textContent =
      data?.email ||
      data?.role ||
      data?.building_id ||
      data?.password ||
      JSON.stringify(data) ||
      "Kayıt başarısız!";
  }
});
