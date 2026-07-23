"use strict";

(() => {
  const supported = ["es", "en", "zh", "ja", "ko", "fr", "de", "pt", "ru", "ar"];
  const labels = { es: "Español", en: "English", zh: "简体中文", ja: "日本語", ko: "한국어", fr: "Français", de: "Deutsch", pt: "Português", ru: "Русский", ar: "العربية" };
  const fallback = {
    navServices: "Services", navContact: "Contact", heroTag: "Graphic Design · Carlos Chong",
    heroTitle: "Ideas that cross galaxies.", heroText: "Visual identity, digital pieces and cyberpunk creativity for brands that want to leave a signal.",
    callButton: "Call: 833 159 4714", donateTag: "Support the mission", donateTitle: "Boost independent creativity",
    donateText: "Secure payment through Mercado Pago with automatic PayPal fallback.", donateButton: "Donate securely",
    chatSend: "Send", chatPlaceholder: "Write your message…", welcome: "Hi, I am the CHONGSEB assistant. What design do you need?",
    quote: "Get a quote", servicesTag: "Capabilities", servicesTitle: "Design ready for takeoff",
    serviceIdentity: "Visual identity", serviceIdentityText: "Logos, palettes and memorable graphic systems.",
    serviceContent: "Digital content", serviceContentText: "Assets for social media, campaigns and launches.",
    serviceArt: "Custom art", serviceArtText: "Unique visual concepts with creative direction.",
    baseTag: "Operations base", baseTitle: "Let’s build something extraordinary.", requestQuote: "Request a quote",
    sourcesTitle: "Trusted sources", permissionTitle: "Welcome to CHONGSEB",
    permissionText: "Where are you visiting from? May we use your location to personalize the experience?",
    yes: "Yes", later: "Later", activateMedia: "🎙️ Activate multimedia experience", mediaLoading: "Requesting permissions…",
    chatTitle: "🦦 CHONGSEB AI", donorsTag: "MISSION GUARDIANS", donorsTitle: "Real donor wall",
    donorsText: "Only names with public consent appear. Mystical characters are marked as legends.",
    mysticalLabel: "MYSTICAL CHARACTER · LEGEND", level: "LEVEL", music: "Music", cinema: "Cinema", export: "Export",
    tutorial1: "Click the creative portal to begin.", tutorial2: "Write your question in the central mission bar.",
    tutorial3: "Watch the otter react and your XP level rise.", tutorial4: "Explore the mystical donor wall.",
    tutorialNext: "Next", tutorialDone: "Finish", tutorialSkip: "Skip tutorial", language: "Language",
    marmota: "The Groundhog", bigBird: "Big Bird", oso: "The Crafty Bear", boneless: "The Boneless",
    polar: "Polar", gitania: "Gitania", donDoggy: "Don Doggy", samano: "Samano"
  };
  let current = normalize(localStorage.getItem("chongseb_language") || navigator.language);
  let strings = fallback;
  let step = 0;
  const targets = [
    [".orb", "tutorial1"],
    ["#chatInput", "tutorial2"],
    [".rpg-hud", "tutorial3"],
    [".donor-wall", "tutorial4"]
  ];

  function normalize(value) {
    const code = String(value || "").toLowerCase().split("-")[0];
    return supported.includes(code) ? code : "en";
  }

  function text(selector, value) {
    const node = document.querySelector(selector);
    if (node && value) node.textContent = value;
  }

  function apply() {
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
    text("#navServices", strings.navServices); text("#navContact", strings.navContact);
    text("#heroTag", strings.heroTag); text("#heroTitle", strings.heroTitle); text("#heroText", strings.heroText);
    text("#callButton", strings.callButton); text("#donateTag", strings.donateTag); text("#donateTitle", strings.donateTitle);
    text("#donateText", strings.donateText); text("#donateButton", strings.donateButton); text("#chatSend", strings.chatSend);
    text("#permissionTitle", strings.permissionTitle); text("#permissionText", strings.permissionText);
    text("#locationYes", strings.yes); text("#locationLater", strings.later); text("#activateMedia", strings.activateMedia);
    text("#mediaLoading", strings.mediaLoading); text(".sources-head h2", strings.sourcesTitle);
    text("#servicios>.tag", strings.servicesTag); text("#servicios>h2", strings.servicesTitle);
    const cards = document.querySelectorAll("#servicios .card");
    if (cards.length >= 3) {
      text("#servicios .card:nth-of-type(1) b", strings.serviceIdentity); text("#servicios .card:nth-of-type(1) p", strings.serviceIdentityText);
      text("#servicios .card:nth-of-type(2) b", strings.serviceContent); text("#servicios .card:nth-of-type(2) p", strings.serviceContentText);
      text("#servicios .card:nth-of-type(3) b", strings.serviceArt); text("#servicios .card:nth-of-type(3) p", strings.serviceArtText);
    }
    text("#contacto .tag", strings.baseTag); text("#contacto h2", strings.baseTitle); text("#contacto .btn", strings.requestQuote);
    text(".chat-head strong", strings.chatTitle);
    const input = document.querySelector("#chatInput");
    if (input) input.placeholder = strings.chatPlaceholder;
    text(".donor-wall>.tag", strings.donorsTag); text(".donor-wall>h2", strings.donorsTitle); text(".donor-wall>p", strings.donorsText);
    text("#rpgLevelLabel", strings.level);
    text("#musicToggle", `♫ ${strings.music}`); text("#cinemaToggle", `▰ ${strings.cinema}`); text("#exportClip", strings.export);
    text("#rpgDonorsTag", strings.donorsTag); text("#rpgDonorsTitle", strings.donorsTitle); text("#rpgDonorsText", strings.donorsText);
    text("#donationDialogTitle", strings.donateTag); text("#donationContinue", strings.donateButton);
    document.querySelectorAll(".language-panel button").forEach(button => button.setAttribute("aria-current", String(button.dataset.lang === current)));
    const toggle = document.querySelector("#langToggle");
    if (toggle) toggle.textContent = current.toUpperCase();
    const floating = document.querySelector("#globalLanguageButton");
    if (floating) floating.textContent = `🌍 ${current.toUpperCase()}`;
    updateTutorial();
    translateMysticalNames();
    window.dispatchEvent(new CustomEvent("chongseb:language", { detail: { language: current, strings } }));
  }

  function translateMysticalNames() {
    const map = {
      "La Marmota": strings.marmota, "Big Bird": strings.bigBird, "El Oso Mañoso": strings.oso,
      "El Boneless": strings.boneless, Polar: strings.polar, Gitania: strings.gitania,
      "Don Doggy": strings.donDoggy, Samano: strings.samano
    };
    document.querySelectorAll(".donor-card.legend strong").forEach(node => {
      const original = node.dataset.originalName || node.textContent;
      node.dataset.originalName = original;
      node.textContent = map[original] || original;
    });
    document.querySelectorAll(".donor-card.legend small").forEach(node => { node.textContent = strings.mysticalLabel; });
  }

  async function setLanguage(value) {
    current = normalize(value);
    localStorage.setItem("chongseb_language", current);
    try {
      const response = await fetch(`/locales/${current}.json`, { cache: "no-cache" });
      if (!response.ok) throw new Error("locale");
      strings = { ...fallback, ...(await response.json()) };
    } catch {
      if (current !== "en") {
        current = "en";
        localStorage.setItem("chongseb_language", current);
      }
      strings = fallback;
    }
    apply();
    document.querySelector(".language-panel")?.classList.remove("open");
  }

  function createLanguageDock() {
    const dock = document.createElement("div");
    dock.className = "language-dock";
    dock.innerHTML = '<button id="globalLanguageButton" type="button" aria-haspopup="true">🌍</button><div class="language-panel" role="menu"></div>';
    const panel = dock.querySelector(".language-panel");
    supported.forEach(code => {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.lang = code; button.textContent = labels[code];
      button.addEventListener("click", () => setLanguage(code));
      panel.append(button);
    });
    dock.querySelector("#globalLanguageButton").addEventListener("click", () => panel.classList.toggle("open"));
    document.body.append(dock);
  }

  function clearFocus() {
    document.querySelectorAll(".tutorial-focus,.tutorial-pulse").forEach(node => node.classList.remove("tutorial-focus", "tutorial-pulse"));
  }

  function updateTutorial() {
    const guide = document.querySelector("#guideBot");
    if (!guide || guide.hidden) return;
    clearFocus();
    const [selector, key] = targets[step];
    const target = document.querySelector(selector);
    target?.classList.add("tutorial-focus", "tutorial-pulse");
    text("#guideMessage", strings[key]);
    text("#guideSkip", strings.tutorialSkip);
    text("#guideNext", step === targets.length - 1 ? strings.tutorialDone : strings.tutorialNext);
  }

  function closeTutorial(done = true) {
    const guide = document.querySelector("#guideBot");
    if (guide) guide.hidden = true;
    clearFocus();
    if (done) localStorage.setItem("chongseb_global_tutorial_seen", "true");
  }

  function createTutorial() {
    if (localStorage.getItem("chongseb_global_tutorial_seen")) return;
    const guide = document.createElement("aside");
    guide.className = "guide-bot"; guide.id = "guideBot"; guide.setAttribute("aria-live", "polite");
    guide.innerHTML = '<div class="guide-avatar" aria-hidden="true">🦦</div><button class="guide-close" type="button" aria-label="Close">×</button><div class="guide-message" id="guideMessage"></div><div class="guide-actions"><button id="guideSkip" type="button"></button><button class="guide-next" id="guideNext" type="button"></button></div>';
    guide.querySelector(".guide-close").addEventListener("click", () => closeTutorial());
    guide.querySelector("#guideSkip").addEventListener("click", () => closeTutorial());
    guide.querySelector("#guideNext").addEventListener("click", () => {
      if (step >= targets.length - 1) closeTutorial();
      else { step += 1; updateTutorial(); }
    });
    document.body.append(guide);
    setTimeout(updateTutorial, 900);
  }

  const observer = new MutationObserver(() => {
    translateMysticalNames();
    if (document.querySelector(".rpg-hud") && !observer.rpgApplied) {
      observer.rpgApplied = true;
      apply();
    }
  });

  window.CHONGSEB_I18N = {
    get language() { return current; },
    get strings() { return strings; },
    setLanguage,
    openSelector() { document.querySelector(".language-panel")?.classList.toggle("open"); }
  };

  createLanguageDock();
  createTutorial();
  observer.observe(document.body, { childList: true, subtree: true });
  setLanguage(current);
})();
