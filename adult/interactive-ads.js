"use strict";

(() => {
  const panel = document.getElementById("interactiveAd");
  const canvas = document.getElementById("adGameCanvas");
  const context = canvas?.getContext("2d");
  const controls = document.getElementById("adGameControls");
  if (!panel || !context || !controls) return;

  const STATE_KEY = "chongseb_ad_games";
  const RPG_KEY = "chongseb_rpg";
  let games = [];
  let current = null;
  let rotation = 0;
  let cleanup = () => {};

  function adState() {
    try {
      const value = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
      return {
        views: Math.max(0, Number(value.views || 0)),
        recent: Array.isArray(value.recent) ? value.recent.slice(-3) : [],
        rewarded: Array.isArray(value.rewarded) ? value.rewarded : [],
      };
    } catch {
      return { views: 0, recent: [], rewarded: [] };
    }
  }

  function saveAdState(value) {
    localStorage.setItem(STATE_KEY, JSON.stringify(value));
  }

  function rpgState() {
    try {
      const value = JSON.parse(localStorage.getItem(RPG_KEY) || "{}");
      return {
        xp: Math.max(0, Number(value.xp || 0)),
        achievements: Array.isArray(value.achievements) ? value.achievements : [],
      };
    } catch {
      return { xp: 0, achievements: [] };
    }
  }

  function gameSize() {
    const width = Math.min(640, Math.max(280, canvas.clientWidth));
    const height = width * (innerWidth < 620 ? .75 : .4375);
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    return { width, height };
  }

  function pointer(event, area) {
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) * area.width / box.width,
      y: (event.clientY - box.top) * area.height / box.height,
    };
  }

  function background(area, title) {
    const gradient = context.createLinearGradient(0, 0, area.width, area.height);
    gradient.addColorStop(0, "#28143f");
    gradient.addColorStop(1, "#090a18");
    context.fillStyle = gradient;
    context.fillRect(0, 0, area.width, area.height);
    context.fillStyle = "#f7dbff";
    context.font = "700 18px system-ui";
    context.textAlign = "center";
    context.fillText(title, area.width / 2, 28);
  }

  function complete(game, message = "Reto completado") {
    cleanup();
    const state = adState();
    const first = !state.rewarded.includes(game.id);
    if (first) {
      state.rewarded.push(game.id);
      saveAdState(state);
      const rpg = rpgState();
      rpg.xp += Number(game.reward || 0);
      if (!rpg.achievements.includes("ad_game_player")) {
        rpg.achievements.push("ad_game_player");
      }
      localStorage.setItem(RPG_KEY, JSON.stringify(rpg));
    }
    document.getElementById("adRewardText").textContent = first
      ? `${message} · +${game.reward} XP · Logro “Jugador de Anuncios”`
      : `${message} · recompensa ya obtenida anteriormente`;
    const offer = document.getElementById("adOfferLink");
    offer.href = game.link || "/account";
    offer.target = offer.origin === location.origin ? "_self" : "_blank";
    offer.rel = "noopener sponsored";
    document.getElementById("adGameReward").hidden = false;
  }

  function clicker(game) {
    const area = gameSize();
    const targets = Array.from({ length: 6 }, (_, index) => ({
      number: index + 1,
      x: 45 + Math.random() * (area.width - 90),
      y: 55 + Math.random() * (area.height - 100),
    }));
    let next = 1;
    function draw() {
      background(area, "Toca los destellos en orden");
      targets.filter(target => target.number >= next).forEach(target => {
        context.fillStyle = target.number === next ? "#ff73df" : "#7956ab";
        context.beginPath();
        context.arc(target.x, target.y, 24, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fff";
        context.font = "700 16px system-ui";
        context.fillText(target.number, target.x, target.y + 6);
      });
    }
    function tap(event) {
      const point = pointer(event, area);
      const target = targets.find(item => item.number === next);
      if (Math.hypot(point.x - target.x, point.y - target.y) <= 34) next += 1;
      draw();
      if (next > targets.length) complete(game);
    }
    canvas.addEventListener("pointerdown", tap);
    draw();
    cleanup = () => {
      canvas.removeEventListener("pointerdown", tap);
      cleanup = () => {};
    };
  }

  function wheel(game) {
    const area = gameSize();
    let angle = 0;
    let spinning = false;
    function draw() {
      background(area, "Ruleta artística");
      const radius = Math.min(area.width, area.height) * .3;
      for (let index = 0; index < 8; index += 1) {
        context.beginPath();
        context.moveTo(area.width / 2, area.height / 2 + 12);
        context.arc(area.width / 2, area.height / 2 + 12, radius, angle + index * Math.PI / 4, angle + (index + 1) * Math.PI / 4);
        context.fillStyle = index % 2 ? "#652d86" : "#bf4c9d";
        context.fill();
      }
      context.fillStyle = "#ffd166";
      context.beginPath();
      context.moveTo(area.width / 2, 45);
      context.lineTo(area.width / 2 - 12, 67);
      context.lineTo(area.width / 2 + 12, 67);
      context.fill();
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Girar";
    let animation = 0;
    button.onclick = () => {
      if (spinning) return;
      spinning = true;
      button.disabled = true;
      const started = performance.now();
      const animate = time => {
        angle += .16 * Math.max(.12, 1 - (time - started) / 1500);
        draw();
        if (time - started < 1600) animation = requestAnimationFrame(animate);
        else complete(game, "La ruleta eligió: Confianza");
      };
      animation = requestAnimationFrame(animate);
    };
    controls.append(button);
    draw();
    cleanup = () => {
      cancelAnimationFrame(animation);
      cleanup = () => {};
    };
  }

  function race(game) {
    const area = gameSize();
    let position = 0;
    function draw() {
      background(area, "Cruza la ciudad de medianoche");
      context.strokeStyle = "#9f67ff";
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(35, area.height * .65);
      context.lineTo(area.width - 35, area.height * .65);
      context.stroke();
      context.font = "44px system-ui";
      context.textAlign = "left";
      context.fillText("🏎️", 25 + position / 10 * (area.width - 105), area.height * .65 - 10);
      context.fillText("🏁", area.width - 65, area.height * .65 - 10);
    }
    const advance = document.createElement("button");
    advance.type = "button";
    advance.textContent = "Avanzar";
    advance.onclick = () => {
      position += 1;
      draw();
      if (position >= 10) complete(game, "Meta alcanzada");
    };
    controls.append(advance);
    draw();
    cleanup = () => { cleanup = () => {}; };
  }

  function puzzle(game) {
    const area = gameSize();
    let values = [0, 1, 2, 3, 4, 5];
    do values.sort(() => Math.random() - .5);
    while (values.every((value, index) => value === index));
    let selected = -1;
    const colors = ["#4d2472", "#6f2d81", "#963d8b", "#b85691", "#d6769b", "#f39dab"];
    function draw() {
      background(area, "Ordena el gradiente del 1 al 6");
      const width = (area.width - 50) / 3, height = (area.height - 75) / 2;
      values.forEach((value, slot) => {
        const x = 20 + slot % 3 * width, y = 48 + Math.floor(slot / 3) * height;
        context.fillStyle = colors[value];
        context.fillRect(x + 3, y + 3, width - 7, height - 7);
        context.strokeStyle = slot === selected ? "#fff" : "transparent";
        context.lineWidth = 4;
        context.strokeRect(x + 3, y + 3, width - 7, height - 7);
        context.fillStyle = "#fff";
        context.font = "700 24px system-ui";
        context.fillText(value + 1, x + width / 2, y + height / 2 + 8);
      });
    }
    function tap(event) {
      const point = pointer(event, area);
      const width = (area.width - 50) / 3, height = (area.height - 75) / 2;
      const col = Math.floor((point.x - 20) / width), row = Math.floor((point.y - 48) / height);
      if (col < 0 || col > 2 || row < 0 || row > 1) return;
      const slot = row * 3 + col;
      if (selected < 0) selected = slot;
      else {
        [values[selected], values[slot]] = [values[slot], values[selected]];
        selected = -1;
      }
      draw();
      if (values.every((value, index) => value === index)) complete(game);
    }
    canvas.addEventListener("pointerdown", tap);
    draw();
    cleanup = () => {
      canvas.removeEventListener("pointerdown", tap);
      cleanup = () => {};
    };
  }

  function quiz(game) {
    const area = gameSize();
    const questions = [
      ["¿Qué color surge al mezclar rojo y azul?", "Morado", ["Verde", "Morado", "Naranja"]],
      ["¿Qué género usa futuros imaginados?", "Ciencia ficción", ["Ciencia ficción", "Documental", "Noticiero"]],
      ["¿Qué accesorio completa un traje formal clásico?", "Corbata", ["Aletas", "Corbata", "Casco lunar"]],
    ];
    let index = 0;
    function render() {
      controls.replaceChildren();
      background(area, `Pregunta ${index + 1} de 3`);
      context.fillStyle = "#fff";
      context.font = "700 20px system-ui";
      context.fillText(questions[index][0], area.width / 2, area.height / 2);
      questions[index][2].forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option;
        button.onclick = () => {
          if (option !== questions[index][1]) {
            button.textContent = "Intenta otra vez";
            return;
          }
          index += 1;
          if (index >= questions.length) complete(game, "Quiz perfecto");
          else render();
        };
        controls.append(button);
      });
    }
    render();
    cleanup = () => { cleanup = () => {}; };
  }

  function start(game) {
    cleanup();
    current = game;
    document.getElementById("adGameTitle").textContent = game.title;
    document.getElementById("adGameDescription").textContent = game.description;
    document.getElementById("adGameReward").hidden = true;
    controls.replaceChildren();
    if (game.type === "clicker") clicker(game);
    else if (game.type === "wheel") wheel(game);
    else if (game.type === "race") race(game);
    else if (game.type === "puzzle") puzzle(game);
    else quiz(game);
  }

  function next() {
    if (!games.length) return;
    const state = adState();
    let candidates = games.filter(game => !state.recent.includes(game.id));
    if (!candidates.length) candidates = games;
    const game = candidates[Math.floor(Math.random() * candidates.length)];
    state.views += 1;
    state.recent.push(game.id);
    state.recent = state.recent.slice(-3);
    saveAdState(state);
    panel.classList.add("fade");
    setTimeout(() => {
      start(game);
      panel.classList.remove("fade");
    }, 350);
  }

  document.getElementById("adGameNext").addEventListener("click", next);
  document.getElementById("adGameClose").addEventListener("click", () => {
    cleanup();
    panel.hidden = true;
    sessionStorage.setItem("chongseb_interactive_ad_closed", "true");
    clearInterval(rotation);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cleanup();
    else if (current && !panel.hidden) start(current);
  });
  addEventListener("pagehide", () => {
    cleanup();
    clearInterval(rotation);
  });

  Promise.all([
    fetch("/adult/adult-ads.json", { cache: "no-store" }).then(response => response.json()),
    window.CHONGSEB_SUBSCRIPTION_READY || Promise.resolve({ ads: true }),
  ]).then(([data, subscription]) => {
    games = Array.isArray(data) ? data : [];
    if (!subscription.ads) {
      document.getElementById("premiumAdMessage").hidden = false;
      return;
    }
    if (sessionStorage.getItem("chongseb_interactive_ad_closed") === "true") return;
    panel.hidden = false;
    next();
    rotation = setInterval(next, 120000);
  }).catch(() => {
    panel.hidden = true;
  });
})();
