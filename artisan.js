(function () {
  "use strict";

  const API_BASE = "https://agent-btp.onrender.com";
  const params = new URLSearchParams(window.location.search);
  let token = params.get("token") || localStorage.getItem("batiswift-artisan-token");
  const TOKEN_KEY = "batiswift-artisan-token";

  function saveToken(t) { token = t; localStorage.setItem(TOKEN_KEY, t); }

  function api(path, options) {
    options = options || {};
    var url = API_BASE + path;
    if (token) { var sep = url.indexOf('?') === -1 ? '?' : '&'; url += sep + 'token=' + encodeURIComponent(token); }
    return fetch(url, {
      method: options.method || 'GET',
      headers: { "Content-Type": "application/json" },
      body: options.body || null
    }).then(async function (r) {
      var data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur serveur");
      return data;
    });
  }

  // ... (autres fonctions inchangées)
})();