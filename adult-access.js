"use strict";

(() => {
  if (new URLSearchParams(location.search).get("adult") === "denied") {
    const notice = document.createElement("div");
    notice.className = "adult-denied-notice";
    notice.textContent = "Esta sección es solo para mayores de edad. Vuelve cuando tengas 18.";
    document.body.append(notice);
    window.history.replaceState({}, "", location.pathname);
    setTimeout(() => notice.remove(), 8000);
  }
  const otter = document.getElementById("otter");
  if (!otter) return;
  const userId = localStorage.getItem("chongseb_user_id");
  let taps = 0;
  let tapTimer = 0;
  let biometricVerified = false;
  let biometricSupported = Boolean(window.PublicKeyCredential && navigator.credentials);
  let voiceVerified = false;
  let enrolled = false;

  const trigger = document.createElement("button");
  trigger.className = "restricted-trigger";
  trigger.type = "button";
  trigger.textContent = "🔐";
  trigger.setAttribute("aria-label", "Acceso especial");
  document.body.append(trigger);

  const dialog = document.createElement("dialog");
  dialog.className = "restricted-dialog";
  dialog.innerHTML = `
    <form class="restricted-form" id="restrictedForm">
      <h2>🔐 Acceso restringido para adultos</h2>
      <p>Requiere mayoría de edad, verificación del dispositivo y revisión manual de identidad.</p>
      <fieldset>
        <legend>1. Verificación del dispositivo</legend>
        <button id="biometricButton" type="button">Usar Face ID / Huella</button>
        <span id="biometricState" class="factor-pending">Pendiente</span>
      </fieldset>
      <fieldset>
        <legend>2. Frase de voz opcional</legend>
        <button id="voiceFactor" type="button">Decir frase secreta</button>
        <span id="voiceState">Factor opcional</span>
      </fieldset>
      <fieldset>
        <legend>3. Identidad y edad</legend>
        <label>Nombre de usuario único <input id="adultUsername" type="text" minlength="3" maxlength="30" pattern="[A-Za-z0-9_.-]{3,30}" autocomplete="username" required></label>
        <label>Correo electrónico <input id="adultEmail" type="email" maxlength="254" autocomplete="email" required></label>
        <label>Contraseña <input id="adultPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label>
        <label>Fecha de nacimiento <input id="adultBirthDate" type="date" required></label>
        <label>Documento privado (JPG, PNG o PDF; máximo 3 MB) <input id="adultDocument" type="file" accept="image/jpeg,image/png,application/pdf" required></label>
        <label>Selfie privada para cotejo manual (JPG o PNG; máximo 3 MB) <input id="adultSelfie" type="file" accept="image/jpeg,image/png" capture="user" required></label>
        <label><input id="adultConsent" type="checkbox" required> Acepto el tratamiento cifrado del documento exclusivamente para verificar edad e identidad.</label>
      </fieldset>
      <div class="privacy-note">Privacidad: CHONGSEB no almacena datos biométricos. WebAuthn conserva la clave privada dentro del autenticador del dispositivo. El documento se cifra con AES‑256‑GCM antes de almacenarse en un bucket privado y queda sujeto a revisión manual y eliminación conforme a la política de conservación.</div>
      <div class="restricted-status" id="restrictedStatus" role="status"></div>
      <div class="restricted-actions"><button id="restrictedCancel" type="button">Cancelar</button><button id="restrictedContinue" type="submit" disabled>Continuar</button></div>
    </form>`;
  document.body.append(dialog);

  const form = dialog.querySelector("#restrictedForm");
  const status = dialog.querySelector("#restrictedStatus");
  const biometricButton = dialog.querySelector("#biometricButton");
  const biometricState = dialog.querySelector("#biometricState");
  const birthDate = dialog.querySelector("#adultBirthDate");
  const username = dialog.querySelector("#adultUsername");
  const email = dialog.querySelector("#adultEmail");
  const password = dialog.querySelector("#adultPassword");
  const documentInput = dialog.querySelector("#adultDocument");
  const selfieInput = dialog.querySelector("#adultSelfie");
  const consent = dialog.querySelector("#adultConsent");
  const continueButton = dialog.querySelector("#restrictedContinue");

  function b64urlToBytes(value) {
    const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  function bytesToB64url(value) {
    if (!value) return null;
    let binary = "";
    new Uint8Array(value).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function registrationJSON(credential) {
    return {
      id: credential.id,
      rawId: bytesToB64url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: bytesToB64url(credential.response.clientDataJSON),
        attestationObject: bytesToB64url(credential.response.attestationObject),
        transports: credential.response.getTransports?.() || [],
      },
    };
  }

  function authenticationJSON(credential) {
    return {
      id: credential.id,
      rawId: bytesToB64url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: bytesToB64url(credential.response.clientDataJSON),
        authenticatorData: bytesToB64url(credential.response.authenticatorData),
        signature: bytesToB64url(credential.response.signature),
        userHandle: bytesToB64url(credential.response.userHandle),
      },
    };
  }

  async function api(action, credential) {
    const response = await fetch("/.netlify/functions/adult-webauthn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, userId, credential }),
    });
    const data = await response.json();
    if (!response.ok && response.status !== 202) throw new Error(data.error || "No se pudo verificar");
    return data;
  }

  async function refresh() {
    if (!userId) return;
    try {
      const response = await fetch(`/.netlify/functions/adult-status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      enrolled = Boolean(data.biometricEnrolled);
      if (data.authenticated) location.href = "/adult";
      if (data.status === "pending") status.textContent = "Tu solicitud está pendiente de revisión manual.";
      if (data.status === "approved") status.textContent = "Identidad aprobada. Autentícate para entrar.";
      if (data.status === "rejected") status.textContent = "La solicitud fue rechazada. Contacta al responsable para corregirla.";
    } catch {}
  }

  function updateReady() {
    const date = new Date(`${birthDate.value}T00:00:00Z`);
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
    const adult = !Number.isNaN(date.getTime()) && date <= cutoff;
    if (!Number.isNaN(date.getTime()) && date > cutoff) {
      location.href = "/?adult=denied";
      return;
    }
    const file = documentInput.files?.[0];
    const selfie = selfieInput.files?.[0];
    const validFile = file && file.size <= 3 * 1024 * 1024 && ["image/jpeg", "image/png", "application/pdf"].includes(file.type);
    const validSelfie = selfie && selfie.size <= 3 * 1024 * 1024 && ["image/jpeg", "image/png"].includes(selfie.type);
    const validAccount = /^[A-Za-z0-9_.-]{3,30}$/.test(username.value) && email.validity.valid && password.value.length >= 12;
    continueButton.disabled = !(adult && validFile && validSelfie && validAccount && consent.checked && (biometricVerified || !biometricSupported));
  }

  biometricButton.addEventListener("click", async () => {
    if (!biometricSupported) {
      biometricState.textContent = "Tu dispositivo no es compatible con biometría. Usa la verificación manual.";
      updateReady();
      return;
    }
    biometricButton.disabled = true;
    status.textContent = "Esperando al autenticador del dispositivo…";
    try {
      if (enrolled) {
        const options = await api("auth-options");
        options.challenge = b64urlToBytes(options.challenge);
        options.allowCredentials = (options.allowCredentials || []).map(item => ({ ...item, id: b64urlToBytes(item.id) }));
        const credential = await navigator.credentials.get({ publicKey: options });
        const result = await api("auth-verify", authenticationJSON(credential));
        biometricVerified = true;
        biometricState.textContent = "Dispositivo verificado";
        biometricState.className = "factor-ok";
        if (result.approved) location.href = "/adult";
      } else {
        const options = await api("register-options");
        options.challenge = b64urlToBytes(options.challenge);
        options.user.id = b64urlToBytes(options.user.id);
        options.excludeCredentials = (options.excludeCredentials || []).map(item => ({ ...item, id: b64urlToBytes(item.id) }));
        const credential = await navigator.credentials.create({ publicKey: options });
        await api("register-verify", registrationJSON(credential));
        biometricVerified = true;
        enrolled = true;
        biometricState.textContent = "Dispositivo registrado";
        biometricState.className = "factor-ok";
      }
      status.textContent = "Biometría verificada localmente; no se almacenaron datos biométricos.";
    } catch (error) {
      status.textContent = error.name === "NotAllowedError" ? "La verificación fue cancelada." : error.message;
    } finally {
      biometricButton.disabled = false;
      updateReady();
    }
  });

  dialog.querySelector("#voiceFactor").addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      dialog.querySelector("#voiceState").textContent = "Reconocimiento de voz no disponible";
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "es-MX";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    dialog.querySelector("#voiceState").textContent = "Escuchando…";
    recognition.onresult = event => {
      const heard = Array.from(event.results[0]).map(item => item.transcript.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
      voiceVerified = heard.some(value => value === "idk zarate knows" || value === "idk zárate knows");
      dialog.querySelector("#voiceState").textContent = voiceVerified ? "Frase verificada" : "La frase no coincidió";
      dialog.querySelector("#voiceState").className = voiceVerified ? "factor-ok" : "";
    };
    recognition.onerror = () => { dialog.querySelector("#voiceState").textContent = "No se pudo reconocer la frase"; };
    recognition.start();
  });

  [birthDate, documentInput, selfieInput, consent, username, email, password].forEach(node => {
    node.addEventListener("change", updateReady);
    node.addEventListener("input", updateReady);
  });
  dialog.querySelector("#restrictedCancel").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async event => {
    event.preventDefault();
    updateReady();
    if (continueButton.disabled) return;
    continueButton.disabled = true;
    status.textContent = "Cifrando y enviando el documento…";
    try {
      const file = documentInput.files[0];
      const readFile = selected => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(selected);
      });
      const [document, selfie] = await Promise.all([readFile(file), readFile(selfieInput.files[0])]);
      const response = await fetch("/api/verify-age", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, username: username.value, email: email.value, password: password.value, birthDate: birthDate.value, type: file.type, document, selfieType: selfieInput.files[0].type, selfie, voiceVerified }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar");
      status.textContent = "Solicitud recibida. El acceso queda pendiente de revisión manual.";
      form.querySelectorAll("input,button").forEach(node => { node.disabled = true; });
      setTimeout(() => dialog.close(), 3000);
    } catch (error) {
      status.textContent = error.message;
      continueButton.disabled = false;
    }
  });

  otter.addEventListener("click", () => {
    taps += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 1200);
    if (taps >= 3) {
      taps = 0;
      trigger.classList.add("visible");
      sessionStorage.setItem("chongseb_special_revealed", "true");
    }
  });
  if (sessionStorage.getItem("chongseb_special_revealed")) trigger.classList.add("visible");
  trigger.addEventListener("click", () => { dialog.showModal(); refresh(); updateReady(); });
  refresh();
})();
