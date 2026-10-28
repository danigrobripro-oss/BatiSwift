/** Module 1 — Qualification & Analyse Devis : espace d'analyse (dossier ← → rapport). */
(() => {
  const { h, fmtEur, fmtDateTime, run, badge, loading, empty, field, dropzone, tabs, list, header, toast, confirmBox } = AIUI;
  let current = null, pendingFile = null, historyBox, reportBox, activeId = null;

  async function loadHistory() {
    historyBox.replaceChildren(loading());
    const { analyses } = await AIApi.get('/api/ai/qualification/analyses');
    historyBox.replaceChildren(...(analyses.length ? analyses.map((a) =>
      h('button', { type: 'button', class: `qa-hist-item${a.id === activeId ? ' active' : ''}`, onclick: () => openAnalysis(a.id) },
        h('strong', { text: a.titre }), h('small', { text: fmtDateTime(a.created_at) }))) : [empty('Aucune analyse enregistrée.')]));
  }

  async function openAnalysis(id) {
    reportBox.replaceChildren(loading('Ouverture…'));
    try { show((await AIApi.get(`/api/ai/qualification/analyses/${id}`)).analysis); }
    catch (e) { reportBox.replaceChildren(empty(e.message)); }
  }

  function show(a) {
    current = a; activeId = a.id;
    const r = a.result || {};
    const att = (r.anomalies || []).filter((x) => x.niveau === 'attention').length;
    const postesTable = () => (r.postes || []).length ? h('div', { class: 'ai-table-wrap' }, h('table', { class: 'ai-table' },
      h('thead', null, h('tr', null, ['Poste', 'Qté', 'PU HT', 'Total HT'].map((t, i) => h('th', { class: i ? 'num' : '', text: t })))),
      h('tbody', null, r.postes.map((p) => h('tr', null, h('td', { text: p.designation }),
        h('td', { class: 'num', text: p.quantite ? `${p.quantite} ${p.unite || ''}` : '—' }),
        h('td', { class: 'num', text: fmtEur(p.prix_unitaire_cents) }), h('td', { class: 'num', text: fmtEur(p.total_ht_cents) })))),
      h('tfoot', null, h('tr', null, h('td', { colspan: 3, class: 'num', text: 'Total HT / TTC lus' }),
        h('td', { class: 'num', text: `${fmtEur(r.total_ht_cents)} / ${fmtEur(r.total_ttc_cents)}` }))))) : empty('Aucun poste extrait.');
    const block = (items, none) => list(items) || empty(none);
    reportBox.replaceChildren(h('div', { class: 'ai-card' },
      h('div', { class: 'qa-report-head' },
        h('div', null, h('h2', { text: a.titre }), h('small', { text: `${fmtDateTime(a.created_at)}${a.filename ? ' · ' + a.filename : ''}` })),
        h('div', { class: 'ai-row' },
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => window.print(), text: 'Imprimer' }),
          h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: async () => {
            if (!(await confirmBox('Supprimer cette analyse ?', 'Supprimer'))) return;
            await run(null, () => AIApi.del(`/api/ai/qualification/analyses/${a.id}`), 'Analyse supprimée.');
            current = null; activeId = null; reportBox.replaceChildren(empty('Sélectionnez ou lancez une analyse.')); loadHistory();
          }, text: 'Supprimer' }))),
      h('div', { class: 'ai-kpis' },
        h('div', { class: 'ai-kpi' }, h('span', { text: 'Postes extraits' }), h('strong', { text: String((r.postes || []).length) })),
        h('div', { class: 'ai-kpi' }, h('span', { text: 'Total HT lu' }), h('strong', { text: fmtEur(r.total_ht_cents) })),
        h('div', { class: `ai-kpi${att ? ' warn' : ''}` }, h('span', { text: 'Points d\'attention' }), h('strong', { text: String(att) })),
        h('div', { class: 'ai-kpi' }, h('span', { text: 'Délai' }), h('strong', { style: 'font-size:1rem', text: r.delai || 'non précisé' }))),
      tabs([
        { label: 'Synthèse', render: () => h('div', null, h('p', { text: r.synthese || 'Aucune synthèse.' }),
          r.type_travaux ? h('p', null, badge(r.type_travaux, 'gold')) : null,
          r.limites && r.limites.length ? h('div', { class: 'ai-note-muted' }, h('strong', { text: 'Limites de l\'analyse : ' }), r.limites.join(' · ')) : null) },
        { label: 'Postes', render: postesTable, count: (r.postes || []).length },
        { label: 'Anomalies', count: (r.anomalies || []).length, render: () => (r.anomalies || []).length ?
          h('div', null, h('p', { class: 'ai-note-muted', style: 'margin-bottom:.75rem', text: 'Ce sont des points à vérifier dans le document, pas des certitudes.' }),
            r.anomalies.map((x) => h('div', { class: `qa-anom ${x.niveau === 'attention' ? '' : 'info'}` },
              x.message, x.poste ? h('small', { style: 'display:block', text: `Poste : ${x.poste}` }) : null,
              h('small', { style: 'display:block', text: x.origine === 'serveur' ? 'Recalculé par BâtiSwift' : 'Relevé par l\'IA' })))) : empty('Aucune anomalie relevée.') },
        { label: 'À compléter', count: (r.informations_manquantes || []).length, render: () => block(r.informations_manquantes, 'Aucune information manquante signalée.') },
        { label: 'Questions client', count: (r.questions_client || []).length, render: () => block(r.questions_client, 'Aucune question suggérée.') },
        { label: 'Vigilance', count: (r.points_vigilance || []).length, render: () => block(r.points_vigilance, 'Aucun point de vigilance relevé.') },
      ])));
    loadHistory();
  }

  function form() {
    const titre = h('input', { type: 'text', maxlength: '150', placeholder: 'Ex. Devis cuisine Dupont' });
    const texte = h('textarea', { placeholder: 'Ou collez ici le texte du devis / de la demande client…', maxlength: '30000' });
    const fileInfo = h('div', { class: 'ai-note-muted', style: 'display:none;margin-bottom:.75rem' });
    const drop = dropzone('.pdf,image/jpeg,image/png,image/webp', ([f]) => {
      if (!f) return;
      pendingFile = f; fileInfo.style.display = 'block'; fileInfo.textContent = `Fichier : ${f.name} (${Math.round(f.size / 1024)} Ko)`;
    }, 'Importer un devis (PDF, JPG, PNG, WEBP — 10 Mo max)');
    const btn = h('button', { type: 'button', class: 'btn btn-primary', style: 'width:100%', text: 'Analyser le dossier', onclick: () => {
      if (!pendingFile && !texte.value.trim()) { toast('Importez un document ou collez le texte du devis.', 'error'); return; }
      run(btn, async () => {
        reportBox.replaceChildren(loading('Analyse en cours… cela peut prendre une vingtaine de secondes.'));
        const fd = new FormData();
        fd.append('titre', titre.value.trim()); fd.append('texte', texte.value);
        if (pendingFile) fd.append('fichier', pendingFile);
        try {
          const { analysis } = await AIApi.upload('/api/ai/qualification/analyze', fd);
          pendingFile = null; fileInfo.style.display = 'none'; titre.value = ''; texte.value = '';
          show(analysis); toast('Analyse terminée et enregistrée.', 'success');
        } catch (e) { if (current) show(current); else reportBox.replaceChildren(empty('L\'analyse a échoué : vous pouvez réessayer.')); throw e; }
      });
    } });
    return h('div', { class: 'ai-card' }, h('h3', { text: 'Nouveau dossier' }), field('Titre du dossier', titre), drop, fileInfo,
      h('div', { style: 'height:.75rem' }), field('Texte du devis', texte), btn);
  }

  AIUI.bootModule({ id: 'qualification', render: async (c) => {
    historyBox = h('div', { class: 'qa-history' });
    reportBox = h('div', null, empty('Importez un devis ou collez son texte pour lancer une analyse, ou ouvrez une analyse précédente.'));
    c.append(header('Qualification & Analyse Devis', 'Extraction des postes, détection des oublis et incohérences, questions à poser au client.'),
      h('div', { class: 'qa-grid' }, h('div', null, form(), h('div', { class: 'ai-card', style: 'margin-top:1rem' }, h('h3', { text: 'Historique' }), historyBox)), reportBox));
    await loadHistory();
  } });
})();
