"use strict";

(() => {
  const openButton = document.getElementById("storeOpen");
  const status = document.getElementById("storeStatus");
  const paywall = document.getElementById("storePaywall");
  const app = document.getElementById("storeApp");
  const cancelButton = document.getElementById("storeCancel");
  const canvas = document.getElementById("storeMap");
  const ctx = canvas.getContext("2d");
  const results = document.getElementById("storeResults");
  const tips = document.getElementById("storeTips");
  const userId = localStorage.getItem("chongseb_user_id");
  let stores = [];
  let filtered = [];
  let center = { lat: 22.249, lng: -97.861 };
  let visible = false;

  async function session() {
    const response = await fetch("/.netlify/functions/store-session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error("No se pudo abrir la sesión de tienda");
  }

  async function access() {
    const response = await fetch("/.netlify/functions/store-status", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Acceso no disponible");
    app.hidden = !data.access;
    paywall.hidden = data.access;
    openButton.hidden = data.access;
    cancelButton.hidden = !data.subscribed || data.subscription?.cancellationPending;
    status.textContent = data.household
      ? "Tienda Premium activa mediante Pase Hogar."
      : data.subscribed
      ? `Tienda Premium activa${data.subscription?.cancellationPending ? " hasta terminar el ciclo actual" : ""}.`
      : data.trialActive
        ? `Prueba gratuita activa hasta ${new Date(data.trialEndsAt).toLocaleDateString()}.`
        : "Tu prueba terminó. Suscríbete para continuar.";
    if (data.access) {
      await loadStores();
      render();
    }
  }

  async function loadStores() {
    if (stores.length) return;
    const response = await fetch("/mock-stores.json", { cache: "no-cache" });
    stores = await response.json();
    filtered = stores;
  }

  function project(store) {
    const scale = 9000;
    return {
      x: canvas.width / 2 + (store.lng - center.lng) * scale,
      y: canvas.height / 2 - (store.lat - center.lat) * scale,
    };
  }

  function draw() {
    if (!visible || app.hidden) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050814";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(40,201,255,.14)";
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#28c9ff";
    ctx.font = "12px system-ui";
    ctx.fillText("Tu centro", canvas.width / 2 + 10, canvas.height / 2 - 8);
    filtered.forEach(store => {
      const point = project(store);
      if (point.x < 0 || point.x > canvas.width || point.y < 0 || point.y > canvas.height) return;
      ctx.fillStyle = "#ff27d7";
      ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.fillText(store.name, point.x + 9, point.y - 7);
    });
  }

  function render() {
    results.replaceChildren();
    filtered.forEach(store => {
      const item = document.createElement("div");
      item.className = "store-result";
      item.textContent = `${store.name} · ${store.category} · promedio ficticio $${store.averagePrice} MXN · ${store.offer}`;
      results.append(item);
    });
    tips.replaceChildren();
    const cheapest = [...filtered].sort((a, b) => a.averagePrice - b.averagePrice)[0];
    [
      cheapest ? `Compara primero con ${cheapest.name}, el promedio ficticio más bajo de estos resultados.` : "Prueba otra categoría.",
      "Define un presupuesto antes de comprar y compara el precio total, incluido el envío.",
      "Los comercios y ofertas de esta demo son ficticios; confirma precios reales antes de pagar.",
    ].forEach(text => { const item = document.createElement("li"); item.textContent = text; tips.append(item); });
    draw();
  }

  openButton.addEventListener("click", async () => {
    openButton.disabled = true;
    try { await session(); await access(); }
    catch (error) { status.textContent = error.message; }
    finally { openButton.disabled = false; }
  });
  document.getElementById("navStore").addEventListener("click", () => {
    setTimeout(() => openButton.click(), 150);
  });

  cancelButton.addEventListener("click", async () => {
    if (!confirm("¿Cancelar la renovación al finalizar el ciclo actual?")) return;
    cancelButton.disabled = true;
    try {
      const response = await fetch("/.netlify/functions/cancel-subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: "store" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await access();
    } catch (error) {
      status.textContent = error.message;
      cancelButton.disabled = false;
    }
  });

  document.getElementById("storeSearch").addEventListener("submit", event => {
    event.preventDefault();
    const query = document.getElementById("storeQuery").value.trim().toLowerCase();
    filtered = stores.filter(store => !query || `${store.name} ${store.category} ${store.offer}`.toLowerCase().includes(query));
    render();
  });

  document.getElementById("storeLocate").addEventListener("click", () => {
    if (!navigator.geolocation) { status.textContent = "Tu navegador no ofrece geolocalización."; return; }
    status.textContent = "Solicitando ubicación…";
    navigator.geolocation.getCurrentPosition(
      position => {
        center = { lat: position.coords.latitude, lng: position.coords.longitude };
        status.textContent = "Ubicación aplicada. Si no hay marcadores, los datos demo están fuera de tu zona.";
        draw();
      },
      () => { status.textContent = "Ubicación denegada. Usamos la base demo de Ciudad Madero."; },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 },
    );
  });

  document.querySelectorAll("[data-store-provider]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const response = await fetch("/.netlify/functions/create-subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: "store_premium",
          paymentMethod: button.dataset.storeProvider,
          payerEmail: document.getElementById("storePayerEmail").value,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "No se pudo iniciar");
      location.href = data.checkoutUrl;
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  }));

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) draw();
  }, { threshold: 0.05 }).observe(canvas);
})();
