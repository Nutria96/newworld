"use strict";

(() => {
  const dialog = document.getElementById("householdDialog");
  const openButton = document.getElementById("householdOpen");
  const form = document.getElementById("householdForm");
  const message = document.getElementById("householdMessage");
  if (!dialog || !openButton || !form) return;

  function showActive() {
    openButton.textContent = "🏠 Hogar Premium";
    openButton.setAttribute("aria-label", "Pase Hogar activo");
    if (document.getElementById("householdNotice")) return;
    const notice = document.createElement("div");
    notice.id = "householdNotice";
    notice.className = "geo glass visible";
    notice.textContent =
      "¡Bienvenido, miembro autorizado de CHONGSEB! Tienda y Zona Infantil Premium están activas.";
    document.body.append(notice);
    setTimeout(() => notice.remove(), 8000);
  }

  openButton.addEventListener("click", () => dialog.showModal());
  document.getElementById("householdCancel").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    message.textContent = "Activando…";
    try {
      const response = await fetch("/.netlify/functions/household-pass", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: document.getElementById("householdCodeInput").value,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.active) throw new Error(data.error || "No se pudo activar");
      showActive();
      message.textContent = "Pase activado en este dispositivo.";
      setTimeout(() => location.reload(), 700);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  fetch("/.netlify/functions/household-pass", {
    credentials: "same-origin",
  })
    .then(response => response.json())
    .then(data => {
      if (data.active) showActive();
    })
    .catch(() => {});
})();
