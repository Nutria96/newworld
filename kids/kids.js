"use strict";

(() => {
  const STORAGE = "chongseb_kids_progress";
  const PIN_KEY = "chongseb_kids_parent_pin";
  const DAY_KEY = "chongseb_kids_day";
  const LIMIT_KEY = "chongseb_kids_limit";
  const zone = document.getElementById("kidsZone");
  const roleGate = document.getElementById("roleGate");
  const parentSetup = document.getElementById("parentSetup");
  const parentUnlock = document.getElementById("parentUnlock");
  const gameDialog = document.getElementById("gameDialog");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  let missions = [];
  let premium = false;
  let cleanup = () => {};
  let currentMission = null;
  let sessionStarted = 0;
  let sessionTimer = 0;

  function progress() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      return {
        completed: Array.isArray(value.completed) ? value.completed : [],
        seconds: Math.max(0, Number(value.seconds || 0)),
      };
    } catch {
      return { completed: [], seconds: 0 };
    }
  }

  function saveProgress(value) {
    localStorage.setItem(STORAGE, JSON.stringify(value));
  }

  async function pinHash(pin) {
    const bytes = new TextEncoder().encode(`CHONGSEB-KIDS:${pin}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map(value => value.toString(16).padStart(2, "0"))
      .join("");
  }

  function todayUsage() {
    const today = new Date().toISOString().slice(0, 10);
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(DAY_KEY) || "{}"); } catch {}
    return stored.date === today
      ? { date: today, seconds: Math.max(0, Number(stored.seconds || 0)) }
      : { date: today, seconds: 0 };
  }

  function startSessionClock() {
    sessionStarted = Date.now();
    clearInterval(sessionTimer);
    sessionTimer = setInterval(() => {
      const daily = todayUsage();
      daily.seconds += 10;
      localStorage.setItem(DAY_KEY, JSON.stringify(daily));
      const all = progress();
      all.seconds += 10;
      saveProgress(all);
      const limitSeconds = Number(localStorage.getItem(LIMIT_KEY) || 30) * 60;
      if (daily.seconds >= limitSeconds) {
        clearInterval(sessionTimer);
        cleanup();
        if (gameDialog.open) gameDialog.close();
        zone.hidden = true;
        parentUnlock.hidden = false;
        document.getElementById("pinStatus").textContent =
          "Se alcanzó el límite diario. Una persona adulta puede cambiarlo en el panel.";
      }
    }, 10000);
  }

  function openZone() {
    roleGate.hidden = true;
    parentSetup.hidden = true;
    parentUnlock.hidden = true;
    zone.hidden = false;
    startSessionClock();
    renderMissions();
  }

  function renderMissions() {
    const state = progress();
    const grid = document.getElementById("missionGrid");
    grid.replaceChildren();
    for (const mission of missions) {
      const locked = mission.premium && !premium;
      const complete = state.completed.includes(mission.id);
      const card = document.createElement("article");
      card.className = `mission-card${locked ? " locked" : ""}`;
      const icon = document.createElement("div");
      icon.className = "mission-icon";
      icon.textContent = mission.icon;
      const title = document.createElement("h2");
      title.textContent = mission.title;
      const status = document.createElement("small");
      status.textContent = complete ? "🏅 Insignia obtenida" : locked ? "🔒 Premium" : "Lista para jugar";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = locked ? "Desbloquear" : complete ? "Jugar otra vez" : "Comenzar";
      button.addEventListener("click", () => {
        if (locked) document.querySelector(".premium").scrollIntoView({ behavior: "smooth" });
        else openGame(mission);
      });
      card.append(icon, title, status, button);
      grid.append(card);
    }
    document.getElementById("progressText").textContent =
      `${state.completed.length} de ${missions.length} misiones`;
    document.getElementById("progressFill").style.width =
      `${missions.length ? state.completed.length / missions.length * 100 : 0}%`;
  }

  function gameSize() {
    const width = Math.min(640, Math.max(280, canvas.clientWidth));
    canvas.width = width * devicePixelRatio;
    canvas.height = width * .65625 * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    return { width, height: width * .65625 };
  }

  function point(event, area) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * area.width / rect.width,
      y: (event.clientY - rect.top) * area.height / rect.height,
    };
  }

  function complete(mission) {
    cleanup();
    const state = progress();
    if (!state.completed.includes(mission.id)) {
      state.completed.push(mission.id);
      saveProgress(state);
    }
    document.getElementById("resultMessage").textContent = mission.message;
    document.getElementById("gameResult").hidden = false;
    renderMissions();
  }

  function openGame(mission) {
    cleanup();
    currentMission = mission;
    document.getElementById("gameTitle").textContent = mission.title;
    document.getElementById("gameHelp").textContent = "Completa el reto a tu ritmo.";
    document.getElementById("gameResult").hidden = true;
    document.getElementById("gameControls").replaceChildren();
    gameDialog.showModal();
    requestAnimationFrame(() => {
      if (mission.id === "recycling") recycling(mission);
      else if (mission.id === "garden") garden(mission);
      else if (mission.id === "water") water(mission);
      else research(mission);
    });
  }

  function recycling(mission) {
    const area = gameSize();
    const bins = [
      { label: "Plástico", color: "#f0c64f" },
      { label: "Papel", color: "#55aef0" },
      { label: "Vidrio", color: "#5edb91" },
      { label: "Orgánico", color: "#a77450" },
    ];
    let items = [
      { icon: "🧴", kind: 0 }, { icon: "📰", kind: 1 },
      { icon: "🍾", kind: 2 }, { icon: "🍌", kind: 3 },
    ].map((item, index) => ({ ...item, x: 75 + index * (area.width - 150) / 3, y: 95, done: false }));
    let dragging = null;
    function draw() {
      ctx.clearRect(0, 0, area.width, area.height);
      ctx.fillStyle = "#10183e"; ctx.fillRect(0, 0, area.width, area.height);
      bins.forEach((bin, index) => {
        const w = area.width / 4 - 12, x = index * area.width / 4 + 6;
        ctx.fillStyle = bin.color; ctx.fillRect(x, area.height - 100, w, 82);
        ctx.fillStyle = "#15142f"; ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center"; ctx.fillText(bin.label, x + w / 2, area.height - 54);
      });
      ctx.font = "40px system-ui";
      items.filter(item => !item.done).forEach(item => ctx.fillText(item.icon, item.x, item.y));
    }
    function down(event) {
      const p = point(event, area);
      dragging = items.find(item => !item.done && Math.hypot(p.x - item.x, p.y - item.y) < 45) || null;
    }
    function move(event) {
      if (!dragging) return;
      const p = point(event, area); dragging.x = p.x; dragging.y = p.y; draw();
    }
    function up() {
      if (!dragging) return;
      const slot = Math.max(0, Math.min(3, Math.floor(dragging.x / (area.width / 4))));
      if (dragging.y > area.height - 130 && slot === dragging.kind) dragging.done = true;
      else { dragging.x = 75 + dragging.kind * (area.width - 150) / 3; dragging.y = 95; }
      dragging = null; draw();
      if (items.every(item => item.done)) complete(mission);
    }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    draw();
    cleanup = () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      cleanup = () => {};
    };
  }

  function garden(mission) {
    const area = gameSize();
    const controls = document.getElementById("gameControls");
    const steps = ["Regar", "Abonar", "Proteger"];
    let completed = 0;
    function draw() {
      ctx.clearRect(0, 0, area.width, area.height);
      const sky = ctx.createLinearGradient(0, 0, 0, area.height);
      sky.addColorStop(0, "#4f8dda"); sky.addColorStop(1, "#293b61");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, area.width, area.height);
      ctx.fillStyle = "#613d2b"; ctx.fillRect(0, area.height - 80, area.width, 80);
      ctx.font = `${70 + completed * 18}px system-ui`; ctx.textAlign = "center";
      ctx.fillText(completed === 3 ? "🌻" : "🌱", area.width / 2, area.height - 70);
    }
    steps.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = label; button.disabled = index !== 0;
      button.addEventListener("click", () => {
        button.disabled = true; completed += 1; draw();
        const next = controls.children[completed]; if (next) next.disabled = false;
        if (completed === 3) setTimeout(() => complete(mission), 500);
      });
      controls.append(button);
    });
    draw();
    cleanup = () => { cleanup = () => {}; };
  }

  function water(mission) {
    const area = gameSize();
    const leaks = [
      { x: area.width * .24, y: area.height * .55 },
      { x: area.width * .52, y: area.height * .34 },
      { x: area.width * .77, y: area.height * .68 },
    ];
    function draw() {
      ctx.clearRect(0, 0, area.width, area.height);
      ctx.fillStyle = "#d9d2bd"; ctx.fillRect(25, 45, area.width - 50, area.height - 70);
      ctx.strokeStyle = "#5a6478"; ctx.lineWidth = 8;
      ctx.strokeRect(55, 80, area.width - 110, area.height - 130);
      ctx.font = "34px system-ui"; ctx.textAlign = "center";
      leaks.forEach(leak => { if (!leak.fixed) ctx.fillText("💧", leak.x, leak.y); });
      ctx.fillStyle = "#15142f"; ctx.font = "bold 16px system-ui";
      ctx.fillText("Encuentra y toca las 3 fugas", area.width / 2, 30);
    }
    function tap(event) {
      const p = point(event, area);
      const leak = leaks.find(item => !item.fixed && Math.hypot(item.x - p.x, item.y - p.y) < 42);
      if (leak) leak.fixed = true;
      draw();
      if (leaks.every(item => item.fixed)) complete(mission);
    }
    canvas.addEventListener("pointerdown", tap); draw();
    cleanup = () => { canvas.removeEventListener("pointerdown", tap); cleanup = () => {}; };
  }

  function research(mission) {
    const area = gameSize();
    const controls = document.getElementById("gameControls");
    document.getElementById("gameHelp").textContent =
      "Pregunta: ¿qué acción ayuda a cuidar el agua? Puedes investigar antes de responder.";
    ctx.fillStyle = "#11183e"; ctx.fillRect(0, 0, area.width, area.height);
    ctx.font = "70px system-ui"; ctx.textAlign = "center"; ctx.fillText("🔎📚💡", area.width / 2, area.height / 2);
    const investigate = document.createElement("button");
    investigate.type = "button"; investigate.textContent = "Investigar";
    const answer = document.createElement("button");
    answer.type = "button"; answer.textContent = "Cerrar la llave al cepillarse";
    const wrong = document.createElement("button");
    wrong.type = "button"; wrong.textContent = "Dejar correr el agua";
    investigate.onclick = () => {
      document.getElementById("gameHelp").textContent =
        "Pista de investigación: una llave abierta usa agua incluso cuando no la necesitas. Compara las opciones y elige la que evita desperdiciarla.";
    };
    answer.onclick = () => complete(mission);
    wrong.onclick = () => {
      document.getElementById("gameHelp").textContent = "Observa la pista, compara de nuevo y vuelve a intentarlo.";
    };
    controls.append(investigate, answer, wrong);
    cleanup = () => { cleanup = () => {}; };
  }

  async function checkPin(value) {
    return localStorage.getItem(PIN_KEY) === await pinHash(value);
  }

  document.getElementById("childRole").onclick = () => {
    roleGate.hidden = true;
    if (localStorage.getItem(PIN_KEY)) parentUnlock.hidden = false;
    else {
      parentSetup.hidden = false;
      document.getElementById("gateStatus").textContent =
        "Pide a una persona adulta que configure el acceso.";
    }
  };
  document.getElementById("parentRole").onclick = () => {
    roleGate.hidden = true;
    (localStorage.getItem(PIN_KEY) ? parentUnlock : parentSetup).hidden = false;
  };
  document.getElementById("pinSetup").onsubmit = async event => {
    event.preventDefault();
    localStorage.setItem(PIN_KEY, await pinHash(event.currentTarget.pin.value));
    localStorage.setItem(LIMIT_KEY, "30");
    openZone();
  };
  document.getElementById("pinUnlock").onsubmit = async event => {
    event.preventDefault();
    if (await checkPin(event.currentTarget.pin.value)) openZone();
    else document.getElementById("pinStatus").textContent = "PIN incorrecto.";
  };
  document.getElementById("gameClose").onclick = () => { cleanup(); gameDialog.close(); };
  document.getElementById("resultClose").onclick = () => gameDialog.close();
  gameDialog.addEventListener("close", cleanup);

  const parentDialog = document.getElementById("parentDialog");
  document.getElementById("parentPanelOpen").onclick = () => {
    document.getElementById("parentStats").hidden = true;
    document.getElementById("parentPinCheck").hidden = false;
    parentDialog.showModal();
  };
  document.getElementById("parentClose").onclick = () => parentDialog.close();
  document.getElementById("parentPinCheck").onsubmit = async event => {
    event.preventDefault();
    if (!(await checkPin(event.currentTarget.pin.value))) {
      document.getElementById("parentStatus").textContent = "PIN incorrecto.";
      return;
    }
    const state = progress();
    document.getElementById("parentPinCheck").hidden = true;
    document.getElementById("parentStats").hidden = false;
    document.getElementById("playedTime").textContent =
      `Tiempo jugado en este dispositivo: ${Math.floor(state.seconds / 60)} minutos`;
    document.getElementById("earnedBadges").textContent =
      `Logros obtenidos: ${state.completed.length} de ${missions.length}`;
    document.getElementById("dailyLimit").value = localStorage.getItem(LIMIT_KEY) || "30";
  };
  document.getElementById("saveLimit").onclick = () => {
    localStorage.setItem(LIMIT_KEY, document.getElementById("dailyLimit").value);
    document.getElementById("parentStatus").textContent = "Límite guardado en este dispositivo.";
  };

  document.querySelectorAll("[data-provider]").forEach(button => {
    button.addEventListener("click", async () => {
      const status = document.getElementById("subscriptionStatus");
      button.disabled = true;
      try {
        const response = await fetch("/.netlify/functions/create-subscription", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId: "kids_premium", paymentMethod: button.dataset.provider }),
        });
        const data = await response.json();
        if (response.status === 401) throw new Error("La persona adulta debe iniciar sesión y estar aprobada antes de suscribirse.");
        if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "No se pudo iniciar el pago.");
        location.href = data.checkoutUrl;
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });
  document.getElementById("cancelKidsSubscription").addEventListener("click", async event => {
    const button = event.currentTarget;
    const status = document.getElementById("subscriptionStatus");
    button.disabled = true;
    try {
      const response = await fetch("/.netlify/functions/cancel-subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: "kids" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cancelar.");
      status.textContent = "Cancelación solicitada. El acceso se conservará hasta el final del periodo pagado cuando corresponda.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  Promise.all([
    fetch("/kids/missions.json", { cache: "no-store" }).then(response => response.json()),
    fetch("/.netlify/functions/kids-subscription-status", { credentials: "same-origin" })
      .then(response => response.json()).catch(() => ({ active: false })),
  ]).then(([missionData, subscription]) => {
    missions = Array.isArray(missionData.missions) ? missionData.missions : [];
    premium = subscription.active === true;
    const householdPremium = subscription.household === true;
    window.CHONGSEB_KIDS_PREMIUM = premium;
    dispatchEvent(new CustomEvent("chongseb:kids-premium", { detail: premium }));
    document.getElementById("subscriptionStatus").textContent = householdPremium
      ? "Premium activo mediante Pase Hogar."
      : premium
      ? "Premium activo: todas las misiones están desbloqueadas."
      : "";
    document.querySelectorAll("[data-provider]").forEach(button => {
      button.disabled = premium;
    });
    document.getElementById("cancelKidsSubscription").hidden = !premium || householdPremium;
  }).catch(() => {
    document.getElementById("gateStatus").textContent = "No se pudieron cargar las misiones.";
  });

  addEventListener("pagehide", () => {
    cleanup();
    clearInterval(sessionTimer);
    if (sessionStarted) {
      const seconds = Math.max(0, Math.floor((Date.now() - sessionStarted) / 1000) % 10);
      const state = progress(); state.seconds += seconds; saveProgress(state);
    }
  });
})();
