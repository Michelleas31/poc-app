 document.addEventListener("DOMContentLoaded", () => {
 
  // ── Toggle visibilidad de contraseña ──
  const togglePass = document.getElementById("togglePass");
  const pwInput = document.getElementById("password");
  const eyeIcon = document.getElementById("eyeIcon");
 
  if (togglePass && pwInput && eyeIcon) {
    togglePass.addEventListener("click", () => {
      const isText = pwInput.type === "text";
      pwInput.type = isText ? "password" : "text";
      eyeIcon.innerHTML = isText
        ? `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`
        : `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    });
  }
 
  // ── Formulario de login ──
  const form = document.getElementById("loginForm");
  if (!form) return;
 
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
 
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const errorEl  = document.getElementById("error");
    const btn      = document.getElementById("submitBtn");
 
    errorEl.textContent = "";
    btn.classList.add("loading");
    btn.disabled = true;
 
    try {
      const response = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
 
      const data = await response.json();
 
      console.log("Respuesta completa del backend:", data);
      console.log("Status HTTP:", response.status);
      console.log("Rol recibido:", data.Rol);
 
      if (!response.ok) {
        errorEl.textContent = data.message || "Credenciales incorrectas.";
        return;
      }
 
      const routes = {
        Admin:    "/pages/panel-admin.html",
        Profesor: "/pages/panel-profesor.html",
        Alumno:   "/pages/panel-alumno.html"
      };
 
      if (routes[data.Rol]) {
        window.location.href = routes[data.Rol];
      } else {
        errorEl.textContent = `Rol no reconocido: "${data.Rol}"`;
        console.warn("Roles disponibles:", Object.keys(routes));
        console.warn("Rol recibido del backend:", data.Rol);
      }
 
    } catch (error) {
      console.error("Error conectando al backend:", error);
      errorEl.textContent = "No se pudo conectar con el servidor.";
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });
 
});
 