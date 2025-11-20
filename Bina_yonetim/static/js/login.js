document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/api/auth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (res.ok) {
  const user = data.user;
  localStorage.setItem("access", data.access);

  if (user.role === "manager") {
    window.location.href = "/manager-dashboard/";
  } else {
    window.location.href = "/dashboard/";
  }
}

});
