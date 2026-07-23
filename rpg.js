"use strict";

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stateKey = "chongseb_rpg";
  const eventStartedAt = Date.now();
  const sessionEvents = [];
  let state;
  try {
    state = JSON.parse(localStorage.getItem(stateKey) || "{}");
  } catch {
    state = {};
  }
  state.xp = Math.max(0, Number(state.xp || 0));
  state.achievements = Array.isArray(state.achievements)
    ? state.achievements
    : [];
  let effectsEnabled = localStorage.getItem("chongseb_fx") === "true";
  let audioContext;
  let ambientNodes = [];

  const hud = document.createElement("aside");
  hud.className = "rpg-hud";
  hud.setAttribute("aria-label", "Estado RPG");
  hud.innerHTML = `
    <div class="rpg-top"><span><span id="rpgLevelLabel">NIVEL</span> <strong class="rpg-level" id="rpgLevel">1</strong></span><span>🏆 <b id="rpgAchievements">0</b></span></div>
    <div class="xp-track" aria-label="Experiencia"><div class="xp-fill" id="rpgXpFill"></div></div>
    <div id="rpgXpText">0 / 100 XP</div>
    <div id="rpgMissionBadges">Conciencia 0/3</div>
    <div class="rpg-controls">
      <button id="musicToggle" type="button" aria-pressed="false">♫ Música</button>
      <button id="fxToggle" type="button" aria-pressed="${effectsEnabled}">✦ FX</button>
      <button id="cinemaToggle" type="button" aria-pressed="false">▰ Cine</button>
      <button id="shortClip" type="button">5 eventos</button>
      <button id="longClip" type="button">60 s</button>
      <button id="exportClip" type="button">Exportar</button>
      <a id="kitDownload" href="/LANZAMIENTO_FOROS.txt" download>Kit +50</a>
    </div>`;
  document.body.append(hud);
  document.body.classList.add("rpg-ready");
  if (reduceMotion) document.body.classList.add("reduce-motion");
  document.body.classList.toggle("fx-on", effectsEnabled);

  const donorSection = document.createElement("section");
  donorSection.className = "donor-wall glass wrap";
  donorSection.innerHTML = `
    <div class="tag" id="rpgDonorsTag">GUARDIANES DE LA MISIÓN</div>
    <h2 id="rpgDonorsTitle">Muro de donadores reales</h2>
    <p id="rpgDonorsText">Solo aparecen nombres con consentimiento público. Los personajes místicos están marcados como leyenda.</p>
    <div class="donor-grid" id="donorGrid" aria-live="polite"></div>`;
  document.querySelector("footer")?.before(donorSection);

  const clipStage = document.createElement("div");
  clipStage.className = "clip-stage";
  clipStage.id = "clipStage";
  clipStage.innerHTML =
    '<div class="clip-card"><button type="button" id="clipClose">Cerrar</button><h2>REPETICIÓN DE MISIÓN</h2><div id="clipEvents"></div></div>';
  document.body.append(clipStage);

  const donationDialog = document.createElement("dialog");
  donationDialog.className = "donation-dialog";
  donationDialog.innerHTML = `
    <form class="donation-form" id="publicDonationForm">
      <h2 id="donationDialogTitle">Apoyar la misión</h2>
      <p>El monto configurado se cobrará por Mercado Pago; PayPal se usará automáticamente si falla. Publicar tu nombre es opcional.</p>
      <input id="donorName" type="text" maxlength="60" placeholder="Nombre público (opcional)">
      <label><input id="publicDonor" type="checkbox"> Acepto que este nombre aparezca públicamente en el muro.</label>
      <div class="donation-actions"><button id="donationContinue" type="submit">Donar de forma segura</button><button id="donationCancel" type="button">Cancelar</button></div>
      <small id="donationStatus" role="status"></small>
    </form>`;
  document.body.append(donationDialog);

  function saveState() {
    localStorage.setItem(stateKey, JSON.stringify(state));
  }

  function levelFromXp(xp) {
    return Math.floor(xp / 100) + 1;
  }

  function tier(level) {
    if (level >= 51) return 6;
    if (level >= 31) return 5;
    if (level >= 21) return 4;
    if (level >= 11) return 3;
    if (level >= 6) return 2;
    return 1;
  }

  function updateHud() {
    const level = levelFromXp(state.xp);
    document.getElementById("rpgLevel").textContent = level;
    document.getElementById("rpgAchievements").textContent =
      state.achievements.length;
    const missionCount = state.achievements.filter((id) =>
      String(id).startsWith("mission_"),
    ).length;
    document.getElementById("rpgMissionBadges").textContent =
      `Conciencia ${missionCount}/3`;
    document.getElementById("rpgXpText").textContent =
      `${state.xp % 100} / 100 XP`;
    document.getElementById("rpgXpFill").style.width = `${state.xp % 100}%`;
    for (let number = 1; number <= 6; number += 1) {
      document.body.classList.toggle(`tier-${number}`, number === tier(level));
    }
  }

  function record(type, detail = "") {
    sessionEvents.push({
      at: new Date().toISOString(),
      elapsedMs: Date.now() - eventStartedAt,
      type,
      detail: String(detail).slice(0, 500),
    });
    if (sessionEvents.length > 300) sessionEvents.shift();
  }

  function audio() {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function tone({ frequency = 440, duration = 0.16, type = "sine", gain = 0.05, delay = 0 }) {
    if (!effectsEnabled) return;
    try {
      const context = audio();
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, context.currentTime + delay);
      volume.gain.exponentialRampToValueAtTime(
        gain,
        context.currentTime + delay + 0.015,
      );
      volume.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + delay + duration,
      );
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration + 0.03);
    } catch {}
  }

  const sounds = {
    send() {
      tone({ frequency: 230, duration: 0.12, type: "sawtooth" });
      tone({ frequency: 620, duration: 0.17, delay: 0.06 });
    },
    receive() {
      tone({ frequency: 440, duration: 0.12 });
      tone({ frequency: 660, duration: 0.18, delay: 0.1 });
    },
    level() {
      [392, 523, 659, 784].forEach((frequency, index) =>
        tone({ frequency, duration: 0.28, delay: index * 0.09, gain: 0.07 }),
      );
    },
    coins() {
      [1046, 1318, 1568].forEach((frequency, index) =>
        tone({ frequency, duration: 0.12, delay: index * 0.06, gain: 0.06 }),
      );
    },
    legend() {
      tone({ frequency: 880, duration: 0.45, type: "triangle", gain: 0.06 });
    },
  };

  function particles(count = 32) {
    if (!effectsEnabled || reduceMotion) return;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      particle.className = "rpg-particle";
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.top = `${Math.random() * 30 - 10}vh`;
      particle.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
      particle.style.setProperty(
        "--particle",
        ["#00ffff", "#ff00ff", "#ffcc00", "#6dff94"][index % 4],
      );
      document.body.append(particle);
      setTimeout(() => particle.remove(), 1800);
    }
  }

  function toast(text) {
    const item = document.createElement("div");
    item.className = "rpg-toast";
    item.textContent = text;
    document.body.append(item);
    setTimeout(() => item.remove(), 3900);
  }

  function addXp(points, reason) {
    const before = levelFromXp(state.xp);
    state.xp += points;
    saveState();
    updateHud();
    record("xp", `+${points} ${reason}`);
    const after = levelFromXp(state.xp);
    if (after > before) {
      sounds.level();
      toast(`LEVEL UP · NIVEL ${after}`);
      document.body.classList.add("time-warp");
      setTimeout(() => document.body.classList.remove("time-warp"), 750);
      particles(46);
      record("level-up", after);
    }
  }

  function achievement(id, points, label) {
    if (state.achievements.includes(id)) return;
    state.achievements.push(id);
    saveState();
    addXp(points, label);
    toast(`LOGRO · ${label}`);
    particles();
    record("achievement", label);
  }

  function appendGovernmentMessage(text, kind) {
    const messages = document.getElementById("messages");
    const item = document.createElement("div");
    item.className = `message ${kind} government-message`;
    item.textContent = text;
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
    let history = [];
    try {
      history = JSON.parse(
        localStorage.getItem("chongseb_chat_history") || "[]",
      );
    } catch {}
    history.push({ text, kind, government: true });
    localStorage.setItem(
      "chongseb_chat_history",
      JSON.stringify(history.slice(-50)),
    );
  }

  function secretEffect() {
    const flash = document.createElement("div");
    flash.className = "classified-flash";
    document.body.append(flash);
    document.getElementById("otter")?.classList.add("classified-otter");
    setTimeout(() => {
      flash.remove();
      document.getElementById("otter")?.classList.remove("classified-otter");
    }, 520);
  }

  const secretPattern =
    /(qui[eé]n\s+fue\s+el\s+donador\s+m[ií]stico|idk\s*z[aá]rate|z[aá]rate)/i;
  const chatForm = document.getElementById("chatForm");
  chatForm?.addEventListener(
    "submit",
    (event) => {
      const input = document.getElementById("chatInput");
      const question = input.value.trim();
      if (!question) return;
      sounds.send();
      addXp(10, "pregunta");
      record("question", question);
      if (!secretPattern.test(question)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = "";
      appendGovernmentMessage(question, "user");
      secretEffect();
      setTimeout(() => {
        const answer = "Idk Zarate knows preguntale a chong";
        appendGovernmentMessage(answer, "bot");
        sounds.receive();
        record("classified-response", answer);
      }, 180);
    },
    true,
  );

  const messageObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement) || !node.matches(".message.bot")) {
          continue;
        }
        if (!node.classList.contains("government-message")) sounds.receive();
        record("response", node.textContent);
      }
    }
  });
  const messageArea = document.getElementById("messages");
  if (messageArea) messageObserver.observe(messageArea, { childList: true });

  document.addEventListener("click", (event) => {
    const referralButton = event.target.closest("#referralPrompt button");
    if (referralButton) {
      setTimeout(() => {
        try {
          const referrals = JSON.parse(
            localStorage.getItem("chongseb_referrals") || "{}",
          );
          const code = localStorage.getItem("chongseb_referral_code");
          if (referrals[code]?.lastSharedAt) {
            achievement("shared", 20, "Compartió CHONGSEB");
          }
        } catch {}
      }, 1000);
    }
  });

  document.getElementById("kitDownload").addEventListener("click", () => {
    achievement("kit", 50, "Descargó el Kit");
    record("kit-download");
  });

  let activeMinutes = Number(sessionStorage.getItem("chongseb_active_minutes") || 0);
  setInterval(() => {
    if (document.hidden || activeMinutes >= 30) return;
    activeMinutes += 1;
    sessionStorage.setItem("chongseb_active_minutes", String(activeMinutes));
    addXp(5, `minuto activo ${activeMinutes}/30`);
    if (activeMinutes === 10) achievement("ten-minutes", 0, "10 minutos en misión");
  }, 60_000);

  document.getElementById("fxToggle").addEventListener("click", (event) => {
    effectsEnabled = !effectsEnabled;
    localStorage.setItem("chongseb_fx", String(effectsEnabled));
    event.currentTarget.setAttribute("aria-pressed", String(effectsEnabled));
    document.body.classList.toggle("fx-on", effectsEnabled);
  });

  document.getElementById("cinemaToggle").addEventListener("click", (event) => {
    const enabled = document.body.classList.toggle("cinema-bars");
    event.currentTarget.setAttribute("aria-pressed", String(enabled));
    record("cinema", enabled ? "on" : "off");
  });

  document.getElementById("musicToggle").addEventListener("click", (event) => {
    if (ambientNodes.length) {
      ambientNodes.forEach((node) => {
        try {
          node.stop?.();
          node.disconnect?.();
        } catch {}
      });
      ambientNodes = [];
      event.currentTarget.setAttribute("aria-pressed", "false");
      return;
    }
    const context = audio();
    const master = context.createGain();
    const delay = context.createDelay(1);
    const feedback = context.createGain();
    master.gain.value = 0.025;
    delay.delayTime.value = 0.32;
    feedback.gain.value = 0.18;
    delay.connect(feedback).connect(delay);
    master.connect(context.destination);
    master.connect(delay).connect(context.destination);
    [55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 3;
      oscillator.connect(master);
      oscillator.start();
      ambientNodes.push(oscillator);
    });
    ambientNodes.push(master, delay, feedback);
    event.currentTarget.setAttribute("aria-pressed", "true");
    record("music", "on");
  });

  document.getElementById("otter")?.addEventListener("click", () => {
    if (!effectsEnabled || reduceMotion) return;
    document.body.classList.add("slow-motion");
    setTimeout(() => document.body.classList.remove("slow-motion"), 2000);
    record("slow-motion");
  });

  function replay(events) {
    const target = document.getElementById("clipEvents");
    target.replaceChildren();
    clipStage.classList.add("open");
    events.forEach((item, index) => {
      setTimeout(() => {
        const card = document.createElement("div");
        card.className = "clip-event";
        card.textContent = `${item.type.toUpperCase()} · ${item.detail}`;
        target.append(card);
      }, index * 900);
    });
  }

  document.getElementById("shortClip").addEventListener("click", () =>
    replay(sessionEvents.slice(-5)),
  );
  document.getElementById("longClip").addEventListener("click", () =>
    replay(
      sessionEvents.filter(
        (item) => Date.now() - Date.parse(item.at) <= 60_000,
      ),
    ),
  );
  document.getElementById("clipClose").addEventListener("click", () =>
    clipStage.classList.remove("open"),
  );
  document.getElementById("exportClip").addEventListener("click", () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            app: "CHONGSEB",
            exportedAt: new Date().toISOString(),
            events: sessionEvents,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chongseb-clip-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    record("clip-export");
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!event.target.closest("#donateButton")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      donationDialog.showModal();
    },
    true,
  );
  document.getElementById("donationCancel").addEventListener("click", () =>
    donationDialog.close(),
  );
  document
    .getElementById("publicDonationForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      const status = document.getElementById("donationStatus");
      const publicDonor = document.getElementById("publicDonor").checked;
      const donorName = document.getElementById("donorName").value.trim();
      button.disabled = true;
      status.textContent = "Abriendo Mercado Pago…";
      try {
        const response = await fetch(
          "/.netlify/functions/create-checkout-session",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              serviceKey: "",
              userId: localStorage.getItem("chongseb_user_id") || "",
              referralCode:
                localStorage.getItem("chongseb_referral_code") || "",
              publicDonor,
              donorName,
            }),
          },
        );
        const data = await response.json();
        const target = data.init_point || data.approval_url || data.url;
        if (!response.ok || !target) throw new Error(data.error);
        location.href = target;
      } catch {
        status.textContent = "No se pudo abrir Mercado Pago ni PayPal. Intenta de nuevo.";
        button.disabled = false;
      }
    });

  const mystical = [
    "La Marmota",
    "Big Bird",
    "El Oso Mañoso",
    "El Boneless",
    "Polar",
    "Gitania",
    "Don Doggy",
    "Samano",
  ];
  const knownDonors = new Set();

  function donorCard({ name, amount, currency, legend = false }) {
    const card = document.createElement("article");
    card.className = `donor-card${legend ? " legend" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "donor-avatar";
    avatar.textContent = name.slice(0, 2).toUpperCase();
    avatar.style.filter = `hue-rotate(${Math.floor(Math.random() * 360)}deg)`;
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = name;
    const detail = document.createElement("small");
    detail.textContent = legend
      ? "PERSONAJE MÍSTICO · LEYENDA"
      : `${(amount / 100).toLocaleString("es-MX", {
          style: "currency",
          currency,
        })}`;
    copy.append(title, detail);
    card.append(avatar, copy);
    return card;
  }

  async function refreshDonors(initial = false) {
    if (document.hidden) return;
    try {
      const response = await fetch("/.netlify/functions/donors");
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.donors)) return;
      const grid = document.getElementById("donorGrid");
      grid
        .querySelectorAll(".donor-card:not(.legend)")
        .forEach((item) => item.remove());
      for (const donor of data.donors) {
        grid.prepend(donorCard(donor));
        if (!initial && !knownDonors.has(donor.id)) {
          toast(`¡${donor.name} ha donado $${(donor.amount / 100).toFixed(2)}!`);
          sounds.coins();
        }
        knownDonors.add(donor.id);
      }
    } catch {}
  }

  function showMystical() {
    if (document.hidden) return;
    const grid = document.getElementById("donorGrid");
    grid.querySelector(".donor-card.legend")?.remove();
    const name = mystical[Math.floor(Math.random() * mystical.length)];
    const card = donorCard({ name, legend: true });
    grid.prepend(card);
    sounds.legend();
    setTimeout(() => card.remove(), 12_000);
  }

  refreshDonors(true);
  setInterval(() => refreshDonors(false), 60_000);
  setInterval(showMystical, 25_000);

  const paymentParams = new URLSearchParams(location.search);
  const payment = paymentParams.get("payment");
  const paypalReturn = paymentParams.get("paypal");
  const paypalOrder = paymentParams.get("token");
  if (payment === "success") {
    toast("Mercado Pago recibió el pago. La confirmación aparecerá en el muro.");
    history.replaceState({}, "", location.pathname);
  }
  if (paypalReturn === "return" && paypalOrder) {
    fetch("/.netlify/functions/capture-paypal-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: paypalOrder }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.captured) throw new Error();
        sounds.coins();
        toast("¡Pago PayPal confirmado! Gracias por impulsar la misión.");
        achievement("supporter", 50, "Apoyó la misión");
        refreshDonors(false);
      })
      .catch(() => toast("PayPal aún no confirmó el pago."))
      .finally(() => history.replaceState({}, "", location.pathname));
  }

  updateHud();
  record("session-start");
})();
