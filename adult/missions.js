"use strict";

(() => {
  const launch = document.getElementById("missionsLaunch");
  const hub = document.getElementById("missionsHub");
  const grid = document.getElementById("missionGrid");
  const player = document.getElementById("missionPlayer");
  const canvas = document.getElementById("missionCanvas");
  if (!launch || !hub || !grid || !player || !canvas) return;

  const context = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let missions = [];
  let active = null;
  let frame = 0;
  let lastFrame = 0;
  let cleanupGame = () => {};

  function readRpg() {
    try {
      const state = JSON.parse(localStorage.getItem("chongseb_rpg") || "{}");
      return {
        xp: Math.max(0, Number(state.xp || 0)),
        achievements: Array.isArray(state.achievements) ? state.achievements : [],
      };
    } catch {
      return { xp: 0, achievements: [] };
    }
  }

  function achievementId(id) {
    return `mission_${id}`;
  }

  function isComplete(id) {
    return readRpg().achievements.includes(achievementId(id));
  }

  function saveChatCongratulations(mission) {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem("chongseb_chat_history") || "[]");
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
    history.push({
      kind: "bot",
      text: `🦦 ¡Misión completada! Ganaste +${mission.rewardXp} XP en “${mission.title}”. La Nutria de CHONGSEB celebra tu decisión de cuidar tu bienestar.`,
      government: false,
    });
    localStorage.setItem("chongseb_chat_history", JSON.stringify(history.slice(-50)));
  }

  function reward(mission) {
    const state = readRpg();
    const id = achievementId(mission.id);
    const firstCompletion = !state.achievements.includes(id);
    if (firstCompletion) {
      state.achievements.push(id);
      state.xp += Number(mission.rewardXp || 50);
      localStorage.setItem("chongseb_rpg", JSON.stringify(state));
      saveChatCongratulations(mission);
    }
    document.getElementById("missionResultText").textContent = mission.message;
    const source = document.getElementById("missionResultSource");
    source.href = mission.source.url;
    source.textContent = mission.source.title;
    document.getElementById("missionReward").textContent = firstCompletion
      ? `Logro desbloqueado · +${mission.rewardXp} XP`
      : "Misión ya completada · puedes repetirla sin sumar XP";
    document.getElementById("missionResult").hidden = false;
    if (firstCompletion) celebrate();
    renderCards();
  }

  function celebrate() {
    if (reduceMotion) return;
    const colors = ["#8b7cff", "#4ce9ff", "#ffd166", "#65e7a4"];
    for (let index = 0; index < 38; index += 1) {
      const bit = document.createElement("i");
      bit.className = "mission-confetti";
      bit.style.left = `${Math.random() * 100}vw`;
      bit.style.setProperty("--drift", `${(Math.random() - .5) * 180}px`);
      bit.style.setProperty("--confetti", colors[index % colors.length]);
      bit.style.animationDelay = `${Math.random() * .35}s`;
      document.body.append(bit);
      setTimeout(() => bit.remove(), 2000);
    }
    try {
      const audio = new (window.AudioContext || window.webkitAudioContext)();
      [392, 523, 659].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.035, audio.currentTime + index * .08);
        gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .25 + index * .08);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(audio.currentTime + index * .08);
        oscillator.stop(audio.currentTime + .3 + index * .08);
      });
      setTimeout(() => audio.close(), 900);
    } catch {}
  }

  function renderCards() {
    grid.replaceChildren();
    for (const mission of missions) {
      const card = document.createElement("article");
      card.className = `mission-card${isComplete(mission.id) ? " is-complete" : ""}`;
      const title = document.createElement("h3");
      title.textContent = mission.title;
      const copy = document.createElement("p");
      copy.textContent = mission.subtitle;
      const rewardLabel = document.createElement("small");
      rewardLabel.textContent = isComplete(mission.id) ? "✓ Logro obtenido" : `Recompensa: +${mission.rewardXp} XP`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = isComplete(mission.id) ? "Repetir" : "Iniciar misión";
      button.addEventListener("click", () => openMission(mission));
      card.append(title, copy, rewardLabel, button);
      grid.append(card);
    }
  }

  function sizeCanvas() {
    const width = Math.min(560, Math.max(280, canvas.clientWidth));
    canvas.width = Math.round(width * devicePixelRatio);
    canvas.height = Math.round(width * .75 * devicePixelRatio);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    return { width, height: width * .75 };
  }

  function openMission(mission) {
    cleanupGame();
    active = mission;
    document.getElementById("missionTitle").textContent = mission.title;
    document.getElementById("missionInstructions").textContent = mission.subtitle;
    document.getElementById("missionResult").hidden = true;
    player.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => startGame(mission));
  }

  function closeMission() {
    cleanupGame();
    active = null;
    player.hidden = true;
    document.body.style.overflow = "";
  }

  function frameLoop(draw) {
    cancelAnimationFrame(frame);
    const run = (time) => {
      if (!active || document.hidden) {
        frame = requestAnimationFrame(run);
        return;
      }
      if (time - lastFrame >= 1000 / 30) {
        lastFrame = time;
        draw(time);
      }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
  }

  function pointerPosition(event, metrics) {
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) * (metrics.width / box.width),
      y: (event.clientY - box.top) * (metrics.height / box.height),
    };
  }

  function startRhythm(mission) {
    const metrics = sizeCanvas();
    const started = performance.now();
    let hits = 0;
    let target = newTarget();
    function newTarget() {
      return { x: 45 + Math.random() * (metrics.width - 90), y: 60 + Math.random() * (metrics.height - 105), radius: 27 };
    }
    const onPointer = (event) => {
      const point = pointerPosition(event, metrics);
      if (Math.hypot(point.x - target.x, point.y - target.y) <= target.radius + 8) {
        hits += 1;
        target = newTarget();
        if (hits >= 12) {
          cleanupGame();
          reward(mission);
        }
      }
    };
    canvas.addEventListener("pointerdown", onPointer);
    frameLoop((time) => {
      const remaining = Math.max(0, 30 - (time - started) / 1000);
      context.clearRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = "#080b20";
      context.fillRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = "#a695ff";
      context.beginPath();
      context.arc(target.x, target.y, target.radius + Math.sin(time / 130) * 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.font = "600 18px system-ui";
      context.fillText(`Pulsos ${hits}/12`, 18, 30);
      context.fillText(`${Math.ceil(remaining)} s`, metrics.width - 65, 30);
      if (remaining <= 0) {
        cleanupGame();
        reward(mission);
      }
    });
    cleanupGame = () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onPointer);
      cleanupGame = () => {};
    };
  }

  function startGarden(mission) {
    const metrics = sizeCanvas();
    const started = performance.now();
    let health = 60;
    let previous = started;
    const onPointer = () => { health = Math.min(100, health + 13); };
    canvas.addEventListener("pointerdown", onPointer);
    frameLoop((time) => {
      const delta = Math.min(.1, (time - previous) / 1000);
      previous = time;
      health = Math.max(0, health - delta * 3);
      const elapsed = (time - started) / 1000;
      context.clearRect(0, 0, metrics.width, metrics.height);
      const sky = context.createLinearGradient(0, 0, 0, metrics.height);
      sky.addColorStop(0, "#11183f");
      sky.addColorStop(1, "#182d2f");
      context.fillStyle = sky;
      context.fillRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = "#65e7a4";
      context.fillRect(metrics.width / 2 - 8, metrics.height - 150, 16, 100);
      context.beginPath();
      context.arc(metrics.width / 2 - 35, metrics.height - 135, 40 * health / 100, 0, Math.PI * 2);
      context.arc(metrics.width / 2 + 35, metrics.height - 165, 40 * health / 100, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.font = "600 17px system-ui";
      context.fillText(`Salud ${Math.round(health)}% · toca para regar`, 18, 30);
      context.fillText(`${Math.max(0, Math.ceil(30 - elapsed))} s`, metrics.width - 65, 30);
      if (elapsed >= 30 && health >= 35) {
        cleanupGame();
        reward(mission);
      } else if (health <= 0) {
        health = 45;
      }
    });
    cleanupGame = () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onPointer);
      cleanupGame = () => {};
    };
  }

  function startPuzzle(mission) {
    const metrics = sizeCanvas();
    const timeout = setTimeout(() => {
      if (active?.id === mission.id) {
        cleanupGame();
        reward(mission);
      }
    }, 120000);
    const size = Math.min(metrics.width, metrics.height) * .78;
    const tileSize = size / 3;
    const originX = (metrics.width - size) / 2;
    const originY = (metrics.height - size) / 2;
    let tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    do {
      tiles.sort(() => Math.random() - .5);
    } while (tiles.every((value, index) => value === index));
    let selected = -1;
    const faces = ["👩", "👨", "🧒", "💬", "❤️", "🤝", "🏡", "🌿", "✨"];
    const onPointer = (event) => {
      const point = pointerPosition(event, metrics);
      const col = Math.floor((point.x - originX) / tileSize);
      const row = Math.floor((point.y - originY) / tileSize);
      if (col < 0 || col > 2 || row < 0 || row > 2) return;
      const slot = row * 3 + col;
      if (selected < 0) selected = slot;
      else {
        [tiles[selected], tiles[slot]] = [tiles[slot], tiles[selected]];
        selected = -1;
        if (tiles.every((value, index) => value === index)) {
          draw();
          cleanupGame();
          reward(mission);
        }
      }
      draw();
    };
    function draw() {
      context.clearRect(0, 0, metrics.width, metrics.height);
      context.fillStyle = "#080b20";
      context.fillRect(0, 0, metrics.width, metrics.height);
      tiles.forEach((value, slot) => {
        const x = originX + (slot % 3) * tileSize;
        const y = originY + Math.floor(slot / 3) * tileSize;
        context.fillStyle = slot === selected ? "#594ba5" : `hsl(${225 + value * 7} 48% 22%)`;
        context.fillRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
        context.fillStyle = "#fff";
        context.font = `${Math.floor(tileSize * .38)}px system-ui`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(faces[value], x + tileSize / 2, y + tileSize / 2);
      });
      context.textAlign = "start";
      context.textBaseline = "alphabetic";
    }
    canvas.addEventListener("pointerdown", onPointer);
    draw();
    cleanupGame = () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onPointer);
      cleanupGame = () => {};
    };
  }

  function startGame(mission) {
    if (mission.id === "mind_rhythm") startRhythm(mission);
    else if (mission.id === "clarity_garden") startGarden(mission);
    else startPuzzle(mission);
  }

  launch.addEventListener("click", () => {
    hub.hidden = !hub.hidden;
    launch.setAttribute("aria-expanded", String(!hub.hidden));
  });
  document.getElementById("missionClose").addEventListener("click", closeMission);
  document.getElementById("missionDone").addEventListener("click", closeMission);
  addEventListener("resize", () => {
    if (!active) return;
    const mission = active;
    cleanupGame();
    startGame(mission);
  });
  addEventListener("pagehide", cleanupGame);

  fetch("/adult/missions.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudieron cargar las misiones.");
      return response.json();
    })
    .then((data) => {
      missions = Array.isArray(data.missions) ? data.missions : [];
      renderCards();
    })
    .catch((error) => {
      grid.textContent = error.message;
      launch.disabled = true;
    });
})();
