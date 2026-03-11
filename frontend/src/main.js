document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    console.log("Login intento:", { username, password });

    // TODO: aquí luego haremos fetch al backend:
    // fetch("http://localhost:3000/api/login", { ... })

    alert(`Bienvenido, ${username || "usuario"}! (Simulación de login)` );
  });
});