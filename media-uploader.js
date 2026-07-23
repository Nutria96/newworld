"use strict";

window.CHONGSEB_MEDIA = (() => {
  const MAX_FILES = 5;
  const MAX_BYTES = 50 * 1024 * 1024;
  const allowed = /^(image\/(?:jpeg|png|gif|webp)|audio\/(?:mpeg|mp4|ogg|wav|webm)|video\/(?:mp4|webm|quicktime)|application\/(?:pdf|json|vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet))|text\/(?:plain|csv|markdown))$/;
  const blockedName = /\.(?:exe|msi|bat|cmd|com|scr|ps1|sh|js|mjs|cjs|html?|svg|php|jar|apk)$/i;

  function validate(files) {
    const list = [...(files || [])];
    if (list.length > MAX_FILES) throw new Error(`Máximo ${MAX_FILES} archivos por mensaje.`);
    for (const file of list) {
      if (!file.size || file.size > MAX_BYTES) throw new Error(`${file.name}: máximo 50 MB.`);
      if (!allowed.test(file.type) || blockedName.test(file.name)) throw new Error(`${file.name}: tipo no permitido.`);
    }
    return list;
  }

  function preview(files, container) {
    container.replaceChildren();
    for (const file of validate(files)) {
      const card = document.createElement("div");
      card.className = "media-preview-item";
      if (file.type.startsWith("image/")) {
        const image = document.createElement("img");
        const url = URL.createObjectURL(file);
        image.src = url;
        image.alt = "";
        image.onload = () => URL.revokeObjectURL(url);
        card.append(image);
      } else {
        const icon = document.createElement("b");
        icon.textContent = file.type.startsWith("audio/") ? "🎵" : file.type.startsWith("video/") ? "🎬" : "📄";
        card.append(icon);
      }
      const name = document.createElement("span");
      name.textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`;
      card.append(name);
      container.append(card);
    }
  }

  async function jsonFetch(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Error de almacenamiento");
    return data;
  }

  function put(file, uploadUrl, onProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", uploadUrl);
      request.setRequestHeader("Content-Type", file.type);
      request.upload.onprogress = event => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Falló la subida"));
      request.onerror = () => reject(new Error("Falló la conexión de subida"));
      request.send(file);
    });
  }

  async function upload(rawFiles, { scope = "main", chatId = "default", onProgress } = {}) {
    const files = validate(rawFiles);
    if (!files.length) return [];
    if (scope === "main") {
      await jsonFetch("/.netlify/functions/media-session", { method: "POST" });
    }
    const signed = await jsonFetch("/.netlify/functions/media-upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, chatId, files: files.map(({ name, type, size }) => ({ name, type, size })) }),
    });
    let finished = 0;
    for (let index = 0; index < signed.uploads.length; index += 1) {
      await put(files[index], signed.uploads[index].uploadUrl, ratio => onProgress?.((finished + ratio) / files.length));
      finished += 1;
      onProgress?.(finished / files.length);
    }
    const complete = await jsonFetch("/.netlify/functions/media-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, ids: signed.uploads.map(item => item.id) }),
    });
    return complete.attachments;
  }

  async function resolveUrl(id, scope) {
    const params = new URLSearchParams({ id, scope });
    return jsonFetch(`/.netlify/functions/media-download?${params}`);
  }

  function render(container, attachments, scope = "main") {
    if (!Array.isArray(attachments) || !attachments.length) return;
    container.classList.add("has-attachments");
    const list = document.createElement("div");
    list.className = "chat-attachments";
    container.append(list);
    attachments.slice(0, MAX_FILES).forEach(async attachment => {
      try {
        const { url } = await resolveUrl(attachment.id, scope);
        let node;
        if (attachment.kind === "image") {
          const link = document.createElement("a");
          link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
          node = document.createElement("img"); node.src = url; node.alt = attachment.name; node.loading = "lazy";
          node.className = "chat-attachment image"; link.append(node); list.append(link); return;
        }
        if (attachment.kind === "audio") {
          node = document.createElement("audio"); node.controls = true; node.preload = "metadata"; node.src = url;
        } else if (attachment.kind === "video") {
          node = document.createElement("video"); node.controls = true; node.preload = "metadata"; node.src = url;
        } else {
          node = document.createElement("a"); node.href = url; node.target = "_blank"; node.rel = "noopener noreferrer";
          node.download = attachment.name; node.textContent = `📄 Descargar ${attachment.name}`;
        }
        node.classList.add("chat-attachment", attachment.kind || "document");
        list.append(node);
      } catch {
        const unavailable = document.createElement("span");
        unavailable.textContent = `📎 ${attachment.name} (sesión no disponible)`;
        list.append(unavailable);
      }
    });
  }

  return { validate, preview, upload, render };
})();
