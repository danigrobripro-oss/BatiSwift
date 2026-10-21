// BâtiSwift — Interactions générales (formulaires, stats landing)

// Stats sur la page d'accueil
async function loadLandingStats() {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      const stats = await res.json();
      document.getElementById('stat-leads') && (document.getElementById('stat-leads').textContent = stats.leads_disponibles);
      document.getElementById('stat-artisans') && (document.getElementById('stat-artisans').textContent = stats.artisans_inscrits);
    } catch(e) { /* silencieux */ }
  }
  
  // Soumission du formulaire client
  async function submitClientRequest(formElement) {
    const formData = new FormData(formElement);
    // Convertit en JSON pour l'API
    const data = {
      description: formData.get('description') || '',
      nom: formData.get('nom') || '',
      telephone: formData.get('telephone') || '',
      ville: formData.get('ville') || '',
    };
    try {
      const res = await fetch(`${API_BASE}/api/client/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      const result = await res.json();
      return result;
    } catch(e) {
      throw new Error('Erreur réseau');
    }
  }
  
  // Initialisation commune aux pages
  document.addEventListener('DOMContentLoaded', async () => {
    // Met à jour les stats si présentes
    loadLandingStats();
  
    // Gestion du formulaire client si présent
    const clientForm = document.getElementById('client-form');
    if (clientForm) {
      clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('client-error');
        const successDiv = document.getElementById('client-success');
        errorDiv.textContent = '';
        successDiv.textContent = '';
        try {
          const resp = await submitClientRequest(clientForm);
          if (resp.lead_created) {
            successDiv.textContent = 'Votre demande a été créée. Un artisan va vous contacter.';
            clientForm.reset();
          } else if (resp.response) {
            successDiv.textContent = resp.response; // réponse intermédiaire de Claude
          }
        } catch (err) {
          errorDiv.textContent = err.message || 'Erreur lors de la soumission.';
        }
      });
    }
  });