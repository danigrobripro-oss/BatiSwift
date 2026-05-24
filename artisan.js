(function () {
  "use strict";

  const API = "";
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
    var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    if (token) headers["X-Artisan-Token"] = token;
    var sep = path.indexOf("?") >= 0 ? "&" : "?";
    var url = token && path.indexOf("token=") < 0
      ? API + path + sep + "token=" + encodeURIComponent(token)
      : API + path;
    return fetch(url, Object.assign({}, options, { headers: headers })).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || "Erreur serveur");
        return data;
      });
    });
  }

  var authView = document.getElementById("auth-view");
  var dashboardView = document.getElementById("dashboard-view");
  var userNameEl = document.getElementById("artisan-name");
  var alertBox = document.getElementById("alert-box");

  function showAlert(message, type) {
    if (!alertBox) return;
    alertBox.className = "alert alert--" + type;
    alertBox.textContent = message;
    alertBox.hidden = false;
  }

  function showDashboard() {
    authView.hidden = true;
    dashboardView.hidden = false;
    loadMe();
    loadAvailableLeads();
    loadPurchasedLeads();
    handleReturnFromStripe();
  }

  function showAuth() {
    authView.hidden = false;
    dashboardView.hidden = true;
  }

  function loadMe() {
    return api("/api/artisan/me").then(function (data) {
      if (userNameEl) userNameEl.textContent = data.name;
    }).catch(function () {});
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
    html += '<span class="lead-card__price">' + lead.price_eur + " €</span>";
    html += "</div>";
    html += '<div class="lead-card__meta">';
    html += '<span class="badge badge--accent">' + escapeHtml(lead.location_city || "—") + "</span>";
    html += '<span class="' + urgencyClass(lead.urgency) + '">' + escapeHtml(lead.urgency_label) + "</span>";
    html += '<span class="badge">' + escapeHtml(lead.budget_label) + "</span>";
    html += '<span class="badge">📷 ' + lead.photo_count + "</span>";
    html += "</div>";
    html += '<p class="lead-card__desc">' + escapeHtml(lead.description_preview) + "</p>";
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
    container.innerHTML = '<p class="loading">Chargement…</p>';
    return api("/api/artisan/leads").then(function (data) {
      var leads = data.leads || [];
      if (!leads.length) {
        container.innerHTML = '<div class="empty-state"><p>Aucun lead disponible pour le moment.</p></div>';
        return;
      }
      var grid = '<div class="leads-grid">';
      for (var i = 0; i < leads.length; i++) grid += renderAvailableLead(leads[i]);
      grid += "</div>";
      container.innerHTML = grid;
      container.querySelectorAll(".btn-buy").forEach(function (btn) {
        btn.addEventListener("click", function () {
          purchaseLead(btn.getAttribute("data-lead-id"));
        });
      });
    }).catch(function (e) {
      container.innerHTML = '<p class="empty-state">' + escapeHtml(e.message) + "</p>";
    });
  }

  function loadPurchasedLeads() {
    var container = document.getElementById("leads-purchased");
    container.innerHTML = '<p class="loading">Chargement…</p>';
    return api("/api/artisan/leads/purchased").then(function (data) {
      var leads = data.leads || [];
      if (!leads.length) {
        container.innerHTML = '<div class="empty-state"><p>Vous n\'avez pas encore acheté de lead.</p></div>';
        return;
      }
      var grid = '<div class="leads-grid">';
      for (var j = 0; j < leads.length; j++) grid += renderPurchasedLead(leads[j]);
      grid += "</div>";
      container.innerHTML = grid;
    }).catch(function (e) {
      container.innerHTML = '<p class="empty-state">' + escapeHtml(e.message) + "</p>";
    });
  }

  function purchaseLead(leadId) {
    var btn = document.querySelector('.btn-buy[data-lead-id="' + leadId + '"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Redirection Stripe…";
    }
    return api("/api/artisan/purchase/" + leadId, { method: "POST", body: "{}" })
      .then(function (data) {
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
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
    if (params.get("success") === "1") {
      showAlert("Paiement réussi ! Coordonnées envoyées sur Telegram et par email.", "success");
      loadPurchasedLeads();
      loadAvailableLeads();
    } else if (params.get("cancel") === "1") {
      showAlert("Paiement annulé.", "error");
      var leadId = params.get("lead_id");
      if (leadId) {
        api("/api/artisan/release/" + leadId, { method: "POST", body: "{}" }).catch(function () {});
      }
    }
  }

  var loginForm = document.getElementById("email-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("login-email").value.trim();
      var errEl = document.getElementById("login-error");
      errEl.textContent = "";
      fetch(API + "/api/artisan/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || "Erreur");
            saveToken(data.token);
            showDashboard();
          });
        })
        .catch(function (err) {
          errEl.textContent = err.message;
        });
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
      document.getElementById(tab.getAttribute("data-panel")).classList.add("is-active");
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
