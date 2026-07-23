"use strict";

(() => {
  const ads = [
    { art: "🔥", title: "Desbloquea toda la colección", text: "Accede a los 10 personajes y disfruta voz sin interrupciones." },
    { art: "💎", title: "Una experiencia más intensa", text: "Premium elimina anuncios y abre conversaciones con voz." },
    { art: "🌙", title: "Entra al nivel VIP", text: "Galería privada y soporte prioritario para miembros VIP." },
  ];
  let adIndex = 0;
  let timer = 0;

  function renderAd() {
    const ad = ads[adIndex];
    document.getElementById("adultAdArt").textContent = ad.art;
    document.getElementById("adultAdTitle").textContent = ad.title;
    document.getElementById("adultAdText").textContent = ad.text;
    [...document.getElementById("adultAdDots").children].forEach((dot, index) => dot.classList.toggle("active", index === adIndex));
  }

  function startAds() {
    if (Date.now() < Number(sessionStorage.getItem("chongseb_ad_hidden_until") || 0)) return;
    const ad = document.getElementById("adultAd");
    ad.hidden = false;
    const dots = document.getElementById("adultAdDots");
    if (!dots.children.length) {
      ads.forEach((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Anuncio ${index + 1}`);
        dot.addEventListener("click", () => { adIndex = index; renderAd(); });
        dots.append(dot);
      });
    }
    renderAd();
    timer = setInterval(() => { adIndex = (adIndex + 1) % ads.length; renderAd(); }, 10_000);
  }

  window.CHONGSEB_SUBSCRIPTION_READY = fetch("/.netlify/functions/subscription-status", { credentials: "same-origin" })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error();
      window.CHONGSEB_SUBSCRIPTION = data;
      document.getElementById("vipExclusive").hidden = !data.exclusive;
      return data;
    })
    .catch(() => {
      const basic = { plan: "basic", ads: true, voice: false, exclusive: false, characterLimit: 3 };
      window.CHONGSEB_SUBSCRIPTION = basic;
      return basic;
    });

  document.getElementById("adultAdClose").addEventListener("click", () => {
    document.getElementById("adultAd").hidden = true;
    sessionStorage.setItem("chongseb_ad_hidden_until", String(Date.now() + 5 * 60 * 1000));
    clearInterval(timer);
  });
})();
