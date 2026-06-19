(function () {
  "use strict";

  const API_BASE = "https://agent-btp.onrender.com";
  const params = new URLSearchParams(window.location.search);
  let token = params.get("token") || localStorage.getItem("batiswift-artisan-token");
  const THEME_KEY = "batiswift-theme";
  const TOKEN_KEY = "batiswift-artisan-token";

  // Thème
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  var savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) applyTheme(savedTheme);
  else if (matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");

  document.getElementById("theme-toggle")?.addEventListener("click", function() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

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
    if (u === "urgent") return "badge badge-urgent";
    if (u === "normal") return "badge badge-normal";
    return "badge";
  }

  function escapeHtml(s) {
    if (!s) return "";
    var el = document.createElement("div");
    el.textContent = String(s);
    return el.innerHTML;
  }

  function renderAvailableLead(lead) {
    var urgencyIcon = lead.urgency === "urgent" ? "🚨" : "📅";
    var html = "";
    html += '<article class="lead-card" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;margin-bottom:1rem;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">';
    html += '<span style="font-weight:700;color:var(--accent);">' + urgencyIcon + ' ' + escapeHtml(lead.trade_type) + '</span>';
    html += '<span style="font-weight:800;color:var(--accent);">' + (lead.price_eur || (lead.price_cents / 100)) + ' €</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.5rem 0;">';
    html += '<span class="badge">📍 ' + escapeHtml(lead.location_city || "—") + '</span>';
    html += '<span class="' + urgencyClass(lead.urgency) + '">' + escapeHtml(lead.urgency_label || lead.urgency) + '</span>';
    html += '<span class="badge">💰 ' + escapeHtml(lead.budget_label || "—") + '</span>';
    html += '<span class="badge">📷 ' + (lead.photo_count || 0) + '</span>';
    html += '</div>';
    html += '<p style="color:var(--text-muted);font-size:0.9rem;margin:0.5rem 0;">' + escapeHtml(lead.description_preview || "") + '</p>';
    html += '<button type="button" class="btn btn--primary btn--block btn-buy" data-lead-id="' + lead.id + '">🔥 Acheter ce lead</button>';
    html += '</article>';
    return html;
  }

  function renderPurchasedLead(lead) {
    var photos = (lead.photo_urls || []).length;
    var html = '<article style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem;margin-bottom:1rem;">';
    html += '<div style="display:flex;justify-content:space-between;"><span style="font-weight:700;">' + escapeHtml(lead.trade_type) + ' · #' + lead.id + '</span><span class="badge badge-success">✅ Acheté</span></div>';
    html += '<div style="margin:0.5rem 0;"><strong>Client</strong> ' + escapeHtml(lead.client_name || "—") + '</div>';
    html += '<div><strong>Tél</strong> <a href="tel:' + escapeHtml(lead.client_phone || "") + '">' + escapeHtml(lead.client_phone || "—") + '</a></div>';
    html += '<div><strong>Email</strong> ' + escapeHtml(lead.client_email || "—") + '</div>';
    html += '<div><strong>Adresse</strong> ' + escapeHtml(lead.location_address || lead.location_city || "—") + '</div>';
    html += '<div><strong>Description</strong> ' + escapeHtml(lead.description || "—") + '</div>';
    html += '<div><strong>Photos</strong> ' + photos + ' fichier(s)</div>';
    html += '</article>';
    return html;
  }

  function loadAvailableLeads() {
    var container = document.getElementById("leads-available");
    if (!container) return;
    container.innerHTML = '<p class="loading">Chargement…</p>';
    api("/api/leads/available")
      .then(function (leads) {
        if (!leads.length) {
          container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">Aucun lead disponible pour le moment.</div>';
          return;
        }
        var grid = '';
        leads.forEach(function (lead) {
          grid += renderAvailableLead(lead);
        });
        container.innerHTML = grid;
        document.querySelectorAll(".btn-buy").forEach(function (btn) {
          btn.addEventListener("click", function () {
            purchaseLead(btn.getAttribute("data-lead-id"));
          });
        });
      })
      .catch(function (e) {
        container.innerHTML = '<p style="color:var(--accent);">' + escapeHtml(e.message) + '</p>';
      });
  }

  function loadPurchasedLeads() {
    var container = document.getElementById("leads-purchased");
    if (!container) return;
    container.innerHTML = '<p class="loading">Chargement…</p>';
    api("/api/leads/purchased")
      .then(function (leads) {
        if (!leads.length) {
          container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);">Vous n\'avez pas encore acheté de lead.</div>';
          return;
        }
        var grid = '';
        leads.forEach(function (lead) {
          grid += renderPurchasedLead(lead);
        });
        container.innerHTML = grid;
      })
      .catch(function (e) {
        container.innerHTML = '<p style="color:var(--accent);">' + escapeHtml(e.message) + '</p>';
      });
  }

  function purchaseLead(leadId) {
    var btn = document.querySelector('.btn-buy[data-lead-id="' + leadId + '"]');
    if (btn) { btn.disabled = true; btn.textContent = "Redirection Stripe…"; }
    api("/api/leads/purchase", { method: "POST", body: JSON.stringify({ lead_id: leadId }) })
      .then(function (data) {
        if (data.url) window.location.href = data.url;
        else throw new Error("URL de paiement non reçue");
      })
      .catch(function (e) {
        showAlert(e.message, "error");
        if (btn) { btn.disabled = false; btn.textContent = "🔥 Acheter ce lead"; }
      });
  }

  function handleReturnFromStripe() {
    var sessionId = params.get("session_id");
    if (sessionId) {
      showAlert("✅ Paiement réussi ! Le lead a été débloqué.", "success");
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
          subContainer.innerHTML = '<span class="badge badge-success">✅ Abonnement actif</span>';
          var subBtn = document.getElementById("subscribe-btn");
          if (subBtn) subBtn.style.display = "none";
        } else {
          subContainer.innerHTML = '<span class="badge badge-warning">❌ Aucun abonnement actif</span>';
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
      .catch(function (e) { showAlert(e.message, "error"); });
  }

  // Paramètres
  function loadSettings() {
    api("/api/artisan/settings")
      .then(function (data) {
        document.getElementById("artisan-phone").value = data.phone || "";
        document.getElementById("artisan-whatsapp").value = data.whatsapp || "";
        document.getElementById("auto-relance").checked = data.auto_relance || false;
      })
      .catch(function () {});
  }

  function saveSettings(phone, whatsapp, autoRelance) {
    return api("/api/artisan/settings", { method: "POST", body: JSON.stringify({ phone, whatsapp, auto_relance }) });
  }

  // Zones
  function loadZones() {
    api("/api/artisan/zones")
      .then(function (zones) {
        var container = document.getElementById("zones-list");
        container.innerHTML = "";
        zones.forEach(function (z) {
          var chip = document.createElement("span");
          chip.className = "badge";
          chip.style.cssText = "background:var(--accent-soft);color:var(--accent);padding:0.4rem 0.8rem;border-radius:20px;display:inline-flex;align-items:center;gap:0.4rem;";
          chip.innerHTML = escapeHtml(z) + ' <span style="cursor:pointer;color:var(--text-muted);" data-zone="' + escapeHtml(z) + '" class="zone-remove">✕</span>';
          container.appendChild(chip);
        });
        document.querySelectorAll(".zone-remove").forEach(function (el) {
          el.addEventListener("click", function () {
            var zone = el.getAttribute("data-zone");
            var zones = getCurrentZones();
            var idx = zones.indexOf(zone);
            if (idx > -1) zones.splice(idx, 1);
            document.getElementById("zone-input").value = zones.join(", ");
            loadZones();
          });
        });
      })
      .catch(function () {});
  }

  function getCurrentZones() {
    var input = document.getElementById("zone-input");
    return input.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function saveZones(zones) {
    return api("/api/artisan/zones", { method: "POST", body: JSON.stringify({ zones: zones }) });
  }

  // Notifications
  function loadPushPrefs() {
    api("/api/artisan/push-prefs")
      .then(function (data) {
        document.getElementById("push-sms").checked = data.sms !== false;
        document.getElementById("push-whatsapp").checked = data.whatsapp !== false;
      })
      .catch(function () {});
  }

  function savePushPrefs(sms, whatsapp) {
    return api("/api/artisan/push-prefs", { method: "POST", body: JSON.stringify({ sms, whatsapp }) });
  }

  // Dashboard
  function showDashboard() {
    if (authView) authView.hidden = true;
    if (dashboardView) dashboardView.hidden = false;
    loadMe();
    loadAvailableLeads();
    loadPurchasedLeads();
    handleReturnFromStripe();
    loadSubscriptionStatus();
    loadSettings();
    loadZones();
    loadPushPrefs();

    var subBtn = document.getElementById("subscribe-btn");
    if (subBtn) subBtn.addEventListener("click", subscribe);

    // Settings form
    var settingsForm = document.getElementById("artisan-settings-form");
    if (settingsForm) {
      settingsForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var phone = document.getElementById("artisan-phone").value.trim();
        var whatsapp = document.getElementById("artisan-whatsapp").value.trim();
        var autoRelance = document.getElementById("auto-relance").checked;
        saveSettings(phone, whatsapp, autoRelance)
          .then(function () {
            var status = document.getElementById("settings-status");
            status.textContent = "✅ Paramètres enregistrés !";
            status.style.color = "#2ecc71";
            setTimeout(function () { status.textContent = ""; }, 3000);
          })
          .catch(function () {
            var status = document.getElementById("settings-status");
            status.textContent = "❌ Erreur";
            status.style.color = "#ff2d7a";
          });
      });
    }

    // Zone add
    document.getElementById("zone-add-btn").addEventListener("click", function () {
      var input = document.getElementById("zone-input");
      var zones = getCurrentZones();
      if (input.value.trim() && !zones.includes(input.value.trim())) {
        zones.push(input.value.trim());
        input.value = zones.join(", ");
        loadZones();
      }
    });

    // Zone save
    document.getElementById("zone-save-btn").addEventListener("click", function () {
      var zones = getCurrentZones();
      saveZones(zones)
        .then(function () {
          var status = document.getElementById("zone-status");
          status.textContent = "✅ Zones enregistrées !";
          status.style.color = "#2ecc71";
          setTimeout(function () { status.textContent = ""; }, 3000);
        })
        .catch(function () {
          var status = document.getElementById("zone-status");
          status.textContent = "❌ Erreur";
          status.style.color = "#ff2d7a";
        });
    });

    // Push save
    document.getElementById("push-save-btn").addEventListener("click", function () {
      var sms = document.getElementById("push-sms").checked;
      var whatsapp = document.getElementById("push-whatsapp").checked;
      savePushPrefs(sms, whatsapp)
        .then(function () {
          var status = document.getElementById("push-status");
          status.textContent = "✅ Préférences enregistrées !";
          status.style.color = "#2ecc71";
          setTimeout(function () { status.textContent = ""; }, 3000);
        })
        .catch(function () {
          var status = document.getElementById("push-status");
          status.textContent = "❌ Erreur";
          status.style.color = "#ff2d7a";
        });
    });
  }

  function showAuth() {
    if (authView) authView.hidden = false;
    if (dashboardView) dashboardView.hidden = true;
  }

  // Login
  var loginForm = document.getElementById("email-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("login-email").value.trim();
      var errEl = document.getElementById("login-error");
      errEl.textContent = "Connexion par email non disponible. Utilisez votre lien d'inscription.";
    });
  }

  // Tabs
  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("is-active"); });
      tab.classList.add("is-active");
      var panelId = tab.getAttribute("data-panel");
      if (panelId) document.getElementById(panelId).classList.add("is-active");
    });
  });

  // Logout
  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "artisan-dashboard.html";
    });
  }

  // Telegram link
  var tgLink = document.getElementById("telegram-register");
  if (tgLink && typeof BATISWIFT_CONFIG !== "undefined") {
    tgLink.href = BATISWIFT_CONFIG.telegram.artisanWaitlistUrl || tgLink.href;
  }

  // Start
  if (token) {
    saveToken(token);
    showDashboard();
  } else {
    showAuth();
  }
})();

