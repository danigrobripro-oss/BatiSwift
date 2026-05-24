/**
 * BatiFlash — Liens et paramètres du site
 * Modifiez ces valeurs pour coller à votre déploiement réel.
 */
const BATIFLASH_CONFIG = {
  siteName: "BatiFlash",
  siteUrl: "https://batiflash.onrender.com",

  telegram: {
    botUsername: "my_artisan_bot",                // ← corrigé (anciennement mon_agent_btp_bot)
    botUrl: "https://t.me/my_artisan_bot",        // ← corrigé
    supportUrl: "https://t.me/my_artisan_bot",    // ← corrigé
    artisanWaitlistUrl: "https://t.me/my_artisan_bot?start=artisan", // ← corrigé
  },

  contact: {
    email: "contact@batiflash.fr",
  },

  links: {
    github: "https://github.com/DANIEL-GROBRI/BatiFlash", // ton dépôt actuel
    render: "https://batiflash.onrender.com",
    renderDashboard: "https://dashboard.render.com",
    artisanDashboard: "/artisan-dashboard.html",
  },

  apiBaseUrl: "",
};
