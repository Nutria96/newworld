"use strict";

(() => {
  const root = document.getElementById("metaverse");
  if (!root) return;
  const grid = document.getElementById("characterGrid");
  const chat = document.getElementById("companionChat");
  const messages = document.getElementById("companionMessages");
  const form = document.getElementById("companionForm");
  const input = document.getElementById("companionInput");
  const portrait = document.getElementById("companionPortrait");
  const title = document.getElementById("companionTitle");
  const speakToggle = document.getElementById("companionSpeak");
  const mediaInput = document.getElementById("adultMediaInput");
  const mediaPreview = document.getElementById("adultMediaPreview");
  const mediaProgress = document.getElementById("adultMediaProgress");
  let characterId = "";
  let speak = false;
  let pendingFiles = [];

  function add(text, kind, attachments = []) {
    const item = document.createElement("div");
    item.className = `companion-message ${kind}`;
    item.textContent = text;
    window.CHONGSEB_MEDIA.render(item, attachments, "adult");
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function learningLinks(links) {
    if (!Array.isArray(links) || !links.length) return;
    const allowed = {
      tiktok: /^(?:www\.)?tiktok\.com$/i,
      facebook: /^(?:(?:www\.|m\.)?facebook\.com|fb\.watch)$/i,
      instagram: /^(?:www\.)?instagram\.com$/i,
    };
    const panel = document.createElement("section");
    panel.className = "learning-links";
    const head = document.createElement("div");
    head.className = "learning-head";
    const title = document.createElement("strong");
    title.textContent = "📚 Aprende más sobre este tema:";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "learning-close";
    close.textContent = "Cerrar sugerencias";
    close.addEventListener("click", () => panel.remove());
    head.append(title, close);
    const grid = document.createElement("div");
    grid.className = "learning-grid";
    for (const item of links.slice(0, 3)) {
      try {
        const platform = String(item.platform || "").toLowerCase();
        const url = new URL(item.url);
        if (url.protocol !== "https:" || !allowed[platform]?.test(url.hostname)) continue;
        const card = document.createElement("a");
        card.className = "learning-card";
        card.href = url.href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        const icon = document.createElement("span");
        icon.className = `social-icon ${platform}`;
        icon.textContent = platform === "tiktok" ? "♪" : platform === "facebook" ? "f" : "◎";
        const label = document.createElement("span");
        label.textContent = String(item.title || platform).slice(0, 160);
        card.append(icon, label);
        grid.append(card);
      } catch {}
    }
    if (!grid.children.length) return;
    panel.append(head, grid);
    messages.append(panel);
    messages.scrollTop = messages.scrollHeight;
  }

  function researchSources(sources) {
    if (!Array.isArray(sources) || !sources.length) return;
    const panel = document.createElement("section");
    panel.className = "research-panel";
    const head = document.createElement("div");
    head.className = "research-head";
    const heading = document.createElement("strong");
    heading.textContent = "🔎 Investigación y recursos";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Cerrar fuentes";
    close.addEventListener("click", () => panel.remove());
    head.append(heading, close);
    panel.append(head);
    for (const item of sources.slice(0, 6)) {
      if (item?.type === "real") {
        try {
          const url = new URL(item.url);
          if (url.protocol !== "https:") continue;
          const link = document.createElement("a");
          link.className = "real-source";
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = `🌐 ${String(item.title || url.hostname).slice(0, 180)}`;
          panel.append(link);
        } catch {}
      } else if (item?.type === "synthetic") {
        const card = document.createElement("article");
        card.className = "synthetic-card";
        const name = document.createElement("strong");
        name.textContent = `🧠 ${String(item.title || "Recurso generado").slice(0, 180)}`;
        const description = document.createElement("p");
        description.textContent = String(item.description || "").slice(0, 700);
        const warning = document.createElement("small");
        warning.textContent = "Generado por IA; no es una fuente publicada.";
        card.append(name, description, warning);
        panel.append(card);
      }
    }
    if (panel.children.length === 1) return;
    messages.append(panel);
    messages.scrollTop = messages.scrollHeight;
  }

  async function select(character, card) {
    characterId = character.id;
    grid.querySelectorAll(".avatar-card").forEach(item => item.classList.toggle("selected", item === card));
    portrait.textContent = character.avatar;
    title.textContent = `${character.name} · personaje virtual de IA`;
    chat.classList.add("open");
    messages.replaceChildren();
    try {
      const response = await fetch("/.netlify/functions/adult-chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "history", characterId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      if (data.history?.length) {
        data.history.forEach(item => add(item.content, item.role === "assistant" ? "assistant" : "user", item.attachments || []));
      } else {
        add(character.greeting, "assistant");
      }
    } catch {
      add(character.greeting, "assistant");
    }
    input.focus();
  }

  function card(character) {
    const button = document.createElement("button");
    button.className = "avatar-card";
    button.type = "button";
    button.dataset.characterId = character.id;
    const label = document.createElement("span");
    label.className = "ai-label";
    label.textContent = "IA FICTICIA";
    const art = document.createElement("span");
    art.className = "avatar-art";
    art.textContent = character.avatar;
    const name = document.createElement("strong");
    name.textContent = `${character.name} · ${character.category}`;
    const note = document.createElement("small");
    note.textContent = "Personaje virtual generado por IA; no representa a una persona real.";
    button.append(label, art, name, note);
    button.addEventListener("click", () => select(character, button));
    return button;
  }

  Promise.all([
    fetch("/adult/characters.json", { cache: "no-cache" }).then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    }),
    window.CHONGSEB_SUBSCRIPTION_READY || Promise.resolve({ characterLimit: 3, voice: false }),
  ])
    .then(([characters, subscription]) => {
      const visible = subscription.characterLimit ? characters.slice(0, subscription.characterLimit) : characters;
      visible.forEach(character => grid.append(card(character)));
    })
    .catch(() => { grid.textContent = "No se pudo cargar la biblioteca de personajes."; });

  speakToggle.addEventListener("click", () => {
    if (!window.CHONGSEB_SUBSCRIPTION?.voice) {
      location.href = "/account";
      return;
    }
    speak = !speak;
    speakToggle.setAttribute("aria-pressed", String(speak));
    speakToggle.textContent = speak ? "🔊 Voz activa" : "🔇 Voz apagada";
    if (!speak) speechSynthesis.cancel();
  });

  mediaInput.addEventListener("change", () => {
    try {
      pendingFiles = window.CHONGSEB_MEDIA.validate(mediaInput.files);
      window.CHONGSEB_MEDIA.preview(pendingFiles, mediaPreview);
    } catch (error) {
      pendingFiles = [];
      mediaInput.value = "";
      mediaPreview.replaceChildren();
      add(error.message, "assistant");
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const files = pendingFiles;
    const message = input.value.trim() || (files.length ? "Revisa los archivos adjuntos." : "");
    if (!message || !characterId) return;
    input.value = "";
    pendingFiles = [];
    mediaInput.value = "";
    mediaPreview.replaceChildren();
    const activeCard = grid.querySelector(`[data-character-id="${CSS.escape(characterId)}"]`);
    activeCard?.classList.add("active");
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      let attachments = [];
      if (files.length) {
        mediaProgress.hidden = false;
        attachments = await window.CHONGSEB_MEDIA.upload(files, {
          scope: "adult",
          chatId: characterId,
          onProgress: value => { mediaProgress.value = Math.round(value * 100); },
        });
      }
      add(message, "user", attachments);
      const response = await fetch("/.netlify/functions/adult-chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, message, attachments: attachments.map(item => item.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      add(data.reply, "assistant");
      researchSources(data.sources);
      learningLinks(data.links);
      if (speak && "speechSynthesis" in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(data.reply);
        utterance.lang = navigator.language || "es-MX";
        speechSynthesis.speak(utterance);
      }
    } catch {
      add("La conexión está ocupada. Intenta de nuevo en un momento.", "assistant");
    } finally {
      mediaProgress.hidden = true;
      mediaProgress.value = 0;
      submit.disabled = false;
      setTimeout(() => activeCard?.classList.remove("active"), 550);
    }
  });
})();
