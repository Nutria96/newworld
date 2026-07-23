"use strict";

(() => {
  const plansRoot = document.getElementById("plans");
  const status = document.getElementById("status");
  const summary = document.getElementById("summary");
  const eventsRoot = document.getElementById("events");
  const cancel = document.getElementById("cancelSubscription");
  let state = null;

  async function subscribe(planId, paymentMethod, button) {
    button.disabled = true;
    status.textContent = "Preparando suscripción segura…";
    try {
      const response = await fetch("/.netlify/functions/create-subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, paymentMethod }),
      });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "No se pudo iniciar");
      location.href = data.checkoutUrl;
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  }

  function renderPlans(plans) {
    plansRoot.replaceChildren();
    plans.forEach(plan => {
      const card = document.createElement("article");
      card.className = `plan${state.plan === plan.id ? " current" : ""}`;
      const title = document.createElement("h2");
      title.textContent = plan.name;
      const price = document.createElement("div");
      price.className = "price";
      price.textContent = plan.price ? `$${plan.price.toFixed(2)} ${plan.currency}/mes` : "Gratis";
      const list = document.createElement("ul");
      plan.features.forEach(feature => {
        const item = document.createElement("li");
        item.textContent = feature;
        list.append(item);
      });
      card.append(title, price, list);
      if (plan.price > 0 && !state.active) {
        for (const provider of [["mercadopago", "Mercado Pago"], ["paypal", "PayPal"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `Elegir con ${provider[1]}`;
          button.addEventListener("click", () => subscribe(plan.id, provider[0], button));
          card.append(button);
        }
      }
      plansRoot.append(card);
    });
  }

  async function load() {
    try {
      const [plansResponse, statusResponse] = await Promise.all([
        fetch("/adult/subscription-plans.json", { cache: "no-cache" }),
        fetch("/.netlify/functions/subscription-status", { credentials: "same-origin" }),
      ]);
      if (statusResponse.status === 401) {
        location.href = "/adult";
        return;
      }
      const plans = await plansResponse.json();
      state = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(state.error);
      summary.textContent = `Plan actual: ${state.plan.toUpperCase()} · Estado: ${state.subscription?.status || "gratuito"}${state.subscription?.expiresAt ? ` · Vigencia técnica: ${new Date(state.subscription.expiresAt).toLocaleDateString()}` : ""}`;
      cancel.hidden = !state.active && state.subscription?.status !== "pending";
      renderPlans(plans);
      eventsRoot.replaceChildren();
      if (!state.events.length) eventsRoot.textContent = "Sin movimientos.";
      state.events.forEach(event => {
        const item = document.createElement("div");
        item.className = "event";
        item.textContent = `${new Date(event.createdAt).toLocaleString()} · ${event.type} · ${event.plan || ""} · ${event.status || ""}`;
        eventsRoot.append(item);
      });
    } catch (error) {
      status.textContent = error.message || "No se pudo cargar la cuenta.";
    }
  }

  cancel.addEventListener("click", async () => {
    if (!confirm("¿Cancelar la renovación de tu suscripción?")) return;
    cancel.disabled = true;
    try {
      const response = await fetch("/.netlify/functions/cancel-subscription", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
    } catch (error) {
      status.textContent = error.message;
      cancel.disabled = false;
    }
  });

  load();
})();
