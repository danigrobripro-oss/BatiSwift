(function () {
  "use strict";

  const API_BASE = "https://agent-btp.onrender.com";
  const params = new URLSearchParams(window.location.search);
  let token = params.get("token") || localStorage.getItem("batiflash-artisan-token");
  const THEME_KEY = "batiflash-theme";
  const TOKEN_KEY = "batiflash-artisan-token";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  var savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) applyTheme(savedTheme);
  else if (matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");

  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  function saveToken(t) {
    token = t;
    localStorage.setItem(TOKEN_KEY, t);
    var url = new URL(window.location.href);
    url.searchParams.set("token", t);
    window.history.replaceState({}, "", url);
  }

  function api(path, options) {
    options = options || {};
    var url = API_BASE + path;
    if (token) {
      var separator = url.indexOf('?') === -1 ? '?' : '&';
      url += separator + 'token=' + encodeURIComponent(token);
    }
    return fetch(url, {
      method: options.method || 'GET',
      headers: { "Content-Type": "application/json" },
      body: options.body || null
    }).then(async function (r) {
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(data.error || "Erreur serveur");
      return data;
    });
  }

  var authView = document.getElementById("auth-view");
  var dashboardView = document.getElementById("dashboard-view");
  var alertBox = document.getElementById("alert-box");

  function showAlert(message, type) {
    if (!alertBox) return;
    alertBox.className = "alert alert--" + type;
    alertBox.textContent = message;
    alertBox.hidden = false;
    setTimeout(function () { alertBox.hidden = true; }, 5000);
  }

  function loadMe() {
    var nameEl = document.getElementById("artisan-name");
    if (nameEl) nameEl.textContent = "Artisan";
  }

  function urgencyClass(u) {
    return u === "urgent" ? "badge badge--urgent" : "badge";
  }

  function escapeHtml(s) {
    if (!s) return "";
    var el = document.createElement("div");
    el.textContent = String(s);
    return el.innerHTML;
  }

  function renderAvailableLead(lead) {
    var html = "";
    html += '<article class="lead-card">';
    html += '<div class="lead-card__top">';
    html += '<span class="lead-card__trade">' + escapeHtml(lead.trade_type) + "</span>";
    html += '<span class="lead-card__price">' + (lead.price_eur || (lead.price_cents / 100)) + " €</span>";
    html += "</div>";
    html += '<div class="lead-card__meta">';
    html += '<span class="badge badge--accent">' + escapeHtml(lead.location_city || "—") + "</span>";
    html += '<span class="' + urgencyClass(lead.urgency) + '">' + escapeHtml(lead.urgency_label || lead.urgency) + "</span>";
    html += '<span class="badge">' + escapeHtml(lead.budget_label || "—") + "</span>";
    html += '<span class="badge">📷 ' + (lead.photo_count || 0) + "</span>";
    html += "</div>";
    html += '<p class="lead-card__desc">' + escapeHtml(lead.description_preview || "") + "</p>";
    html += '<div class="lead-card__footer">';
    html += '<button type="button" class="btn btn--primary btn--block btn-buy" data-lead-id="' + lead.id + '">';
    html += "Acheter ce lead</button></div></article>";
    return html;
  }

  function renderPurchasedLead(lead) {
    var photos = (lead.photo_urls || []).length;
    var html = "";
    html += '<article class="lead-card lead-card--sold lead-card__full">';
    html += '<div class="lead-card__top">';
    html += '<span class="lead-card__trade">' + escapeHtml(lead.trade_type) + " · #" + lead.id + "</span>";
    html += '<span class="badge badge--accent">Acheté</span></div>';
    html += '<div class="contact-row"><strong>Client</strong><span>' + escapeHtml(lead.client_name || "—") + "</span></div>";
    html += '<div class="contact-row"><strong>Téléphone</strong><span><a href="tel:' + escapeHtml(lead.client_phone || "") + '">';
    html += escapeHtml(lead.client_phone || "—") + "</a></span></div>";
    html += '<div class="contact-row"><strong>Email</strong><span>' + escapeHtml(lead.client_email || "—") + "</span></div>";
    html += '<div class="contact-row"><strong>Adresse</strong><span>';
    html += escapeHtml(lead.location_address || lead.location_city || "—") + " ";
    html += escapeHtml(lead.location_postal || "") + "</span></div>";
    html += '<div class="contact-row"><strong>Description</strong><span>' + escapeHtml(lead.description || "—") + "</span></div>";
    html += '<div class="contact-row"><strong>Photos</strong><span>' + photos + " fichier(s)</span></div>";
    html += "</article>";
    return html;
  }

  function loadAvailableLeads() {
    var container = document.getElementById("leads-available");
    if (!container) return;
    container.innerHTML = '<p class="loading">Chargement…</p>';
    api("/api/leads/available")
      .then(function (leads) {
        if (!leads.length) {
          container.innerHTML = '<div class="empty-state"><p>Aucun lead disponible pour le moment.</p></div>';
          return;
        }
        var grid = '<div class="leads-grid">';
        leads.forEach(function (lead) {
          grid += renderAvailableLead(lead);
        });
        grid += "</div>";
        container.innerHTML = grid;
        document.querySelectorAll(".btn-buy").forEach(function (btn) {
          btn.addEventListener("click", function () {
            purchaseLead(btn.getAttribute("data-lead-id"));
          });
        });
      })
      .catch(function (e) {
        container.innerHTML = '<p class="empty-state">' + escapeHtml(e.message) + "</p>";
      });
  }

  function loadPurchasedLeads() {
    var container = document.getElementById("leads-purchased");
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><p>Cette fonctionnalité sera bientôt disponible.</p></div>';
  }

  function purchaseLead(leadId) {
    var btn = document.querySelector('.btn-buy[data-lead-id="' + leadId + '"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Redirection Stripe…";
    }
    api("/api/leads/purchase", {
      method: "POST",
      body: JSON.stringify({ lead_id: leadId })
    })
      .then(function (data) {
        if (data.url) window.location.href = data.url;
        else throw new Error("URL de paiement non reçue");
      })
      .catch(function (e) {
        showAlert(e.message, "error");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Acheter ce lead";
        }
      });
  }

  function handleReturnFromStripe() {
    var sessionId = params.get("session_id");
    if (sessionId) {
      showAlert("Paiement réussi ! Le lead a été débloqué.", "success");
      loadAvailableLeads();
      loadPurchasedLeads();
      var url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url);
    }
  }

  // Abonnement
  function loadSubscriptionStatus() {
    var subContainer = document.getElementById("subscription-status");
    if (!subContainer) return;
    api("/api/artisan/subscription/status")
      .then(function (data) {
        if (data.active) {
          subContainer.innerHTML = '<span class="badge badge--success">✅ Abonnement actif</span>';
          var subBtn = document.getElementById("subscribe-btn");
          if (subBtn) subBtn.style.display = "none";
        } else {
          subContainer.innerHTML = '<span class="badge badge--danger">❌ Aucun abonnement actif</span>';
          var subBtn = document.getElementById("subscribe-btn");
          if (subBtn) subBtn.style.display = "inline-block";
        }
      })
      .catch(function () {});
  }

  function subscribe() {
    api("/api/artisan/subscribe", { method: "POST" })
      .then(function (data) {
        if (data.url) window.location.href = data.url;
        else showAlert("Erreur lors de la création de l'abonnement", "error");
      })
      .catch(function (e) {
        showAlert(e.message, "error");
      });
  }

  function showDashboard() {
    if (authView) authView.hidden = true;
    if (dashboardView) dashboardView.hidden = false;
    loadMe();
    loadAvailableLeads();
    loadPurchasedLeads();
    handleReturnFromStripe();
    loadSubscriptionStatus();
    var subBtn = document.getElementById("subscribe-btn");
    if (subBtn) subBtn.addEventListener("click", subscribe);
  }

  function showAuth() {
    if (authView) authView.hidden = false;
    if (dashboardView) dashboardView.hidden = true;
  }

  var loginForm = document.getElementById("email-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("login-email").value.trim();
      var errEl = document.getElementById("login-error");
      errEl.textContent = "Connexion par email non disponible. Utilisez votre lien d'inscription.";
    });
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) {
        t.classList.remove("is-active");
      });
      document.querySelectorAll(".tab-panel").forEach(function (p) {
        p.classList.remove("is-active");
      });
      tab.classList.add("is-active");
      var panelId = tab.getAttribute("data-panel");
      if (panelId) document.getElementById(panelId).classList.add("is-active");
    });
  });

  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "artisan-dashboard.html";
    });
  }

  var tgLink = document.getElementById("telegram-register");
  if (tgLink && typeof BATIFLASH_CONFIG !== "undefined") {
    tgLink.href = BATIFLASH_CONFIG.telegram.artisanWaitlistUrl || tgLink.href;
  }

  if (token) {
    saveToken(token);
    showDashboard();
  } else {
    showAuth();
  }
})();
