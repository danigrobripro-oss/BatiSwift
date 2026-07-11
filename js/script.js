const API_BASE = "https://agent-btp.onrender.com";
const stripe = Stripe("pk_test_votre_cle_publique"); // déjà dans l'env Render

let currentUser = null;

// --- Gestion de session ---
async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    if (res.ok) {
      currentUser = await res.json();
      updateUIForLoggedInUser();
    } else {
      currentUser = null;
      updateUIForVisitor();
    }
  } catch { currentUser = null; updateUIForVisitor(); }
}

// --- UI (exemple pour artisan.html, à adapter) ---
function updateUIForLoggedInUser() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("dashboard-section").style.display = "block";
  document.getElementById("logout-link").style.display = "inline";
  document.getElementById("artisan-nom").textContent = currentUser.nom;
  document.getElementById("artisan-ville").textContent = currentUser.ville || "Non renseignée";
  document.getElementById("artisan-rayon").textContent = currentUser.rayon;
  loadArtisanLeads();
}
function updateUIForVisitor() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("dashboard-section").style.display = "none";
  document.getElementById("logout-link").style.display = "none";
}

// --- Inscription/Connexion (inchangé) ---

// --- Chargement des leads avec distance ---
async function loadArtisanLeads() {
  const container = document.getElementById("leads-container");
  try {
    const res = await fetch(`${API_BASE}/api/artisan/leads`, { credentials: "include" });
    if (!res.ok) throw new Error("Non autorisé");
    const leads = await res.json();
    container.innerHTML = "";
    if (leads.length === 0) {
      container.innerHTML = "<p>Aucun lead disponible dans votre secteur.</p>";
      return;
    }
    leads.forEach(lead => {
      const card = document.createElement("div");
      card.className = "lead-card";
      card.innerHTML = `
        <span class="urgence">${lead.urgence}</span>
        <strong>${lead.client_ville}</strong> ${lead.distance_km ? `(≈ ${lead.distance_km} km)` : ""}
        <p>${lead.description}</p>
        <small>${lead.type_travaux} – ${lead.date_creation}</small>
        <div class="actions">
          <button class="btn-primary acheter-btn" data-lead-id="${lead.id}">Acheter (10€)</button>
        </div>
      `;
      container.appendChild(card);
    });
    // Attacher les événements d'achat Stripe
    document.querySelectorAll(".acheter-btn").forEach(btn => {
      btn.addEventListener("click", () => acheterLead(btn.dataset.leadId));
    });
  } catch (err) {
    container.innerHTML = `<p class="error-msg">Erreur: ${err.message}</p>`;
  }
}

// --- Achat (inchangé) ---

// --- Gestion des tags et notes (pour les leads achetés) ---
// Vous pouvez intégrer ces appels dans votre dashboard après achat.

async function updateTags(leadId, tagsArray) {
  await fetch(`${API_BASE}/api/leads/${leadId}/tag`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ tags: tagsArray }),
    credentials: "include"
  });
}

async function addNote(leadId, noteText) {
  await fetch(`${API_BASE}/api/leads/${leadId}/note`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ note: noteText }),
    credentials: "include"
  });
}

// --- FAQ (à intégrer sur une page ou un widget) ---
async function askFAQ(question) {
  const res = await fetch(`${API_BASE}/api/faq`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ question }),
    credentials: "include"
  });
  const data = await res.json();
  return data.reponse || "Désolé, je n'ai pas compris.";
}