(function () {
  "use strict";

  // Récupération de la configuration (nouveau nom)
  const cfg = typeof BATISWIFT_CONFIG !== "undefined" ? BATISWIFT_CONFIG : {};
  const BOT_URL = cfg.telegram?.botUrl || "https://t.me/my_artisan_bot";

  // ———— Thème clair/sombre ————
  const THEME_KEY = "batiswift-theme";
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  applyTheme(getPreferredTheme());

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  // ———— Gestion des liens (footer, etc.) ————
  function setHref(id, url) {
    const el = document.getElementById(id);
    if (el && url) el.href = url;
  }
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
  }

  setHref("link-telegram", BOT_URL);
  setHref("link-telegram-footer", cfg.telegram?.supportUrl || BOT_URL);
  setHref("link-telegram-artisan", cfg.telegram?.artisanWaitlistUrl || BOT_URL);
  setHref("link-github", cfg.links?.github);
  setHref("link-render", cfg.links?.render);
  setHref("link-email", cfg.contact?.email ? "mailto:" + cfg.contact.email : null);
  setText("footer-email", cfg.contact?.email || "contact@batiswift.fr");

  document.querySelectorAll("[data-bot-link]").forEach((el) => {
    el.href = BOT_URL;
  });

  // Ancres smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ———— Panneau de chat ————
  const chatFab = document.getElementById("chat-fab");
  const chatPanel = document.getElementById("chat-panel");
  const chatClose = document.getElementById("chat-close");
  const chatForm = document.getElementById("chat-form");
  const chatMessages = document.getElementById("chat-messages");

  function addBotMessage(text) {
    if (!chatMessages) return;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble--bot";
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function openChat(prefillCategory) {
    if (!chatPanel) return;
    chatPanel.classList.add("is-open");
    chatPanel.setAttribute("aria-hidden", "false");
    if (prefillCategory) {
      const select = document.getElementById("chat-category");
      if (select) select.value = prefillCategory;
    }
    const textarea = document.getElementById("chat-message");
    if (textarea) setTimeout(() => textarea.focus(), 200);
    if (chatMessages) {
      chatMessages.innerHTML = "";
      addBotMessage("Bonjour ! Décrivez votre problème. Après envoi, vous serez redirigé vers Telegram.");
    }
  }

  function closeChat() {
    if (!chatPanel) return;
    chatPanel.classList.remove("is-open");
    chatPanel.setAttribute("aria-hidden", "true");
  }

  function resetChatForm() {
    if (chatForm) chatForm.reset();
    if (chatMessages) {
      chatMessages.innerHTML = "";
      addBotMessage("Bonjour ! Décrivez votre problème. Après envoi, vous serez redirigé vers Telegram.");
    }
  }

  if (chatFab) chatFab.addEventListener("click", () => openChat());
  if (chatClose) chatClose.addEventListener("click", closeChat);

  document.querySelectorAll("[data-open-chat]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const category = btn.getAttribute("data-category") || "";
      openChat(category);
    });
  });

  document.querySelectorAll(".service-card").forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.addEventListener("click", () => {
      const category = card.getAttribute("data-category") || "";
      openChat(category);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeChat();
  });

  // ———— Soumission du formulaire : redirection directe vers Telegram ————
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const category = document.getElementById("chat-category")?.value || "";
      const city = document.getElementById("chat-city")?.value?.trim() || "";
      const message = document.getElementById("chat-message")?.value?.trim() || "";
      const name = document.getElementById("chat-name")?.value?.trim() || "";

      if (!message) {
        document.getElementById("chat-message")?.focus();
        return;
      }

      // Construction du message (nom du bot mis à jour)
      let fullMessage = `Bonjour Bati, je viens de BatiSwift.\n`;
      fullMessage += `Travaux : ${category || "non précisé"}\n`;
      fullMessage += `Localisation : ${city || "non précisée"}\n`;
      fullMessage += `Description : ${message}\n`;
      if (name) fullMessage += `Nom : ${name}\n`;

      const encoded = encodeURIComponent(fullMessage);
      const finalUrl = `${BOT_URL}?text=${encoded}`;

      window.open(finalUrl, "_blank");
      closeChat();
      resetChatForm();
    });
  }

  // Année dynamique dans le footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
