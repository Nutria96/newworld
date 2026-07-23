"use strict";

(() => {
  const video = document.getElementById("lessonVideo");
  const fallback = document.getElementById("lessonFallback");
  const context = fallback?.getContext("2d");
  if (!video || !fallback || !context) return;

  const playButton = document.getElementById("lessonPlay");
  const muteButton = document.getElementById("lessonMute");
  const progress = document.getElementById("lessonProgress");
  const timeLabel = document.getElementById("lessonTime");
  const breakPanel = document.getElementById("learningBreak");
  const breakProgress = document.getElementById("breakProgress");
  const countdown = document.getElementById("breakCountdown");
  const finish = document.getElementById("lessonFinish");
  let lessons = [], breaks = [], selected = null;
  let elapsed = 0, watchedSinceBreak = 0, playing = false;
  let inBreak = false, premium = false, frame = 0, previous = 0;
  let breakTimer = 0, usingVideo = false;

  function format(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function updateControls() {
    const duration = selected?.duration || 0;
    progress.value = duration ? Math.min(100, elapsed / duration * 100) : 0;
    timeLabel.textContent = `${format(elapsed)} / ${format(duration)}`;
    playButton.textContent = playing ? "⏸️" : "▶️";
  }

  function drawScene(time) {
    const width = fallback.width, height = fallback.height;
    const wave = Math.sin(time / 450);
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#3b4ea1");
    gradient.addColorStop(1, "#17213d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.font = "700 27px system-ui";
    context.fillText(selected?.title || "CHONGSEB", width / 2, 48);
    context.font = "92px system-ui";
    const scene = {
      recycle: ["🦦", "♻️", "🧴"],
      friendship: ["🦦", "🤝", "🐢"],
      water: ["🦦", "💧", "🚰"],
      garden: ["🦦", "🌱", "🌻"],
    }[selected?.scene] || ["🦦", "✨", "🌍"];
    scene.forEach((icon, index) => {
      context.fillText(icon, width * (.25 + index * .25), height * .55 + wave * (index % 2 ? 18 : -18));
    });
    context.font = "18px system-ui";
    context.fillStyle = "#e7eaff";
    context.fillText(selected?.description || "", width / 2, height - 42);
  }

  function stopLoop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }

  function loop(time) {
    if (!playing || inBreak || usingVideo) return;
    if (!previous) previous = time;
    const delta = Math.min(.1, (time - previous) / 1000);
    previous = time;
    elapsed += delta;
    watchedSinceBreak += delta;
    drawScene(time);
    updateControls();
    if (watchedSinceBreak >= (premium ? 240 : 120)) {
      showBreak(false);
      return;
    }
    if (elapsed >= selected.duration) {
      playing = false;
      elapsed = selected.duration;
      updateControls();
      showLesson();
      if (!premium) showBreak(true);
      return;
    }
    frame = requestAnimationFrame(loop);
  }

  function play() {
    if (!selected || inBreak) return;
    finish.hidden = true;
    playing = true;
    if (usingVideo) {
      video.play().catch(() => {
        usingVideo = false;
        video.hidden = true;
        fallback.hidden = false;
        frame = requestAnimationFrame(loop);
      });
    } else {
      frame = requestAnimationFrame(loop);
    }
    updateControls();
  }

  function pause() {
    playing = false;
    video.pause();
    stopLoop();
    updateControls();
  }

  function choose(lesson, autoplay = false) {
    pause();
    selected = lesson;
    elapsed = 0;
    finish.hidden = true;
    usingVideo = Boolean(lesson.video);
    video.hidden = !usingVideo;
    fallback.hidden = usingVideo;
    if (usingVideo) video.src = lesson.video;
    else {
      video.removeAttribute("src");
      video.load();
      drawScene(0);
    }
    document.querySelectorAll(".lesson-card").forEach(card =>
      card.classList.toggle("active", card.dataset.id === lesson.id),
    );
    updateControls();
    if (autoplay) play();
  }

  function showLesson() {
    document.getElementById("lessonMessage").textContent = selected.lesson;
    finish.hidden = false;
  }

  function lockControls(locked) {
    playButton.disabled = locked;
    muteButton.disabled = locked;
    progress.disabled = locked;
    document.getElementById("randomLesson").disabled = locked;
    document.querySelectorAll(".lesson-card").forEach(card => {
      card.disabled = locked;
    });
  }

  function showBreak(afterClip) {
    if (inBreak) return;
    pause();
    inBreak = true;
    lockControls(true);
    breakPanel.hidden = false;
    document.getElementById("breakMessage").textContent =
      breaks[Math.floor(Math.random() * breaks.length)] ||
      "Cuidar el planeta también se aprende jugando.";
    let remaining = 15;
    countdown.textContent = `${remaining} s`;
    breakProgress.style.width = "0%";
    clearInterval(breakTimer);
    breakTimer = setInterval(() => {
      remaining -= 1;
      countdown.textContent = `${remaining} s`;
      breakProgress.style.width = `${(15 - remaining) / 15 * 100}%`;
      if (remaining > 0) return;
      clearInterval(breakTimer);
      breakPanel.hidden = true;
      inBreak = false;
      lockControls(false);
      watchedSinceBreak = 0;
      if (!afterClip && elapsed < selected.duration) play();
    }, 1000);
  }

  function renderList() {
    const list = document.getElementById("lessonList");
    list.replaceChildren();
    const icons = ["♻️", "🤝", "💧", "🌱"];
    lessons.forEach((lesson, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lesson-card";
      card.dataset.id = lesson.id;
      const icon = document.createElement("span");
      icon.textContent = icons[index % icons.length];
      const title = document.createElement("strong");
      title.textContent = lesson.title;
      const description = document.createElement("small");
      description.textContent = lesson.description;
      card.append(icon, title, description);
      card.addEventListener("click", () => choose(lesson));
      list.append(card);
    });
  }

  playButton.addEventListener("click", () => playing ? pause() : play());
  muteButton.addEventListener("click", () => {
    video.muted = !video.muted;
    muteButton.textContent = video.muted ? "🔇" : "🔊";
  });
  progress.addEventListener("input", () => {
    if (!selected || inBreak) return;
    elapsed = selected.duration * Number(progress.value) / 100;
    if (usingVideo) video.currentTime = elapsed;
    else drawScene(performance.now());
    updateControls();
  });
  document.getElementById("randomLesson").addEventListener("click", () => {
    if (lessons.length) choose(lessons[Math.floor(Math.random() * lessons.length)], true);
  });
  video.addEventListener("timeupdate", () => {
    if (!usingVideo || inBreak) return;
    const delta = Math.max(0, video.currentTime - elapsed);
    elapsed = video.currentTime;
    watchedSinceBreak += Math.min(delta, 1);
    updateControls();
    if (watchedSinceBreak >= (premium ? 240 : 120)) showBreak(false);
  });
  video.addEventListener("ended", () => {
    playing = false;
    elapsed = selected.duration;
    showLesson();
    updateControls();
    if (!premium) showBreak(true);
  });
  video.addEventListener("error", () => {
    if (!selected) return;
    usingVideo = false;
    video.hidden = true;
    fallback.hidden = false;
    drawScene(performance.now());
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  addEventListener("pagehide", () => {
    pause();
    clearInterval(breakTimer);
  });
  addEventListener("chongseb:kids-premium", event => {
    premium = event.detail === true;
  });

  fetch("/kids/lessons.json", { cache: "no-store" })
    .then(response => response.json())
    .then(data => {
      lessons = Array.isArray(data.lessons) ? data.lessons : [];
      breaks = Array.isArray(data.breaks) ? data.breaks : [];
      renderList();
      if (lessons[0]) choose(lessons[0]);
    })
    .catch(() => {
      document.getElementById("lessonList").textContent =
        "Las caricaturas no están disponibles en este momento.";
    });
})();
