/** Module 4 — Détecteur de travaux supplémentaires : comparaison devis / constat → écarts → projet d'avenant. */
(() => {
  const { h, fmtEur, fmtDateTime, run, badge, loading, empty, field, header, list, toast, confirmBox } = AIUI;
  let sources = [], devisSel, devisTxt, constatTxt, titre, out, histSel, current = null;
  const ST = { confirme: ['Confirmé', 'ok'], probable: ['Probable', 'warn'], a_verifier: ['À vérifier', 'neutral'] };

  async function loadHistory() {
    const { analyses } = await AIApi.get('/api/ai/travaux_sup/analyses');
    histSel.replaceChildren(h('option', { value: '', text: 'Analyses précédentes…' }), ...analyses.map((a) => h('option', { value: a.id, text: `${a.titre} — ${fmtDateTime(a.created_at)}${a.has_avenant ? ' (avenant)' : ''}` })));
  }

  function showResult(a) {
    current = a; const r = a.result, checks = [];
    const rows = r.elements.map((e, i) => {
      const cb = h('input', { type: 'checkbox', 'aria-label': `Inclure « ${e.libelle} » dans l'avenant`, checked: e.statut !== 'a_verifier' }); checks.push(cb);
      return h('tr', null, h('td', null, cb), h('td', null, h('strong', { text: e.libelle }), h('div', { class: 'ts-just', text: e.justification || 'Aucune justification fournie par l\'analyse.' })),
        h('td', null, badge(ST[e.statut][0], ST[e.statut][1])),
        h('td', { class: 'num', text: e.quantite ? `${e.quantite} ${e.unite || ''}` : '—' }),
        h('td', { class: 'num' }, e.montant_ht_cents != null ? h('span', null, fmtEur(e.montant_ht_cents), h('small', { style: 'display:block;color:var(--bs-text-muted)', text: e.origine_montant === 'calcule' ? 'qté × PU fournis' : 'indiqué dans les documents' })) : h('span', { text: 'à définir' })));
    });
    const genBtn = h('button', { type: 'button', class: 'btn btn-primary', text: a.avenant_text ? 'Régénérer le projet d\'avenant' : 'Préparer le projet d\'avenant', onclick: () => run(genBtn, async () => {
      const idx = checks.map((c, i) => (c.checked ? i : -1)).filter((i) => i >= 0);
      const res = await AIApi.post(`/api/ai/travaux_sup/analyses/${a.id}/avenant`, { indexes: idx }); current.avenant_text = res.avenant_text; showResult(current);
    }, 'Projet d\'avenant rédigé.') });
    out.replaceChildren(
      stepsBar(a.avenant_text ? 3 : 2),
      h('div', { class: 'ai-card' }, h('h2', { text: a.titre }), h('p', { text: r.resume }),
        h('div', { class: 'ai-kpis' }, h('div', { class: 'ai-kpi' }, h('span', { text: 'Écarts relevés' }), h('strong', { text: String(r.elements.length) })),
          h('div', { class: 'ai-kpi' }, h('span', { text: 'Total confirmé (HT, chiffré)' }), h('strong', { text: fmtEur(r.total_confirme_cents) })),
          h('div', { class: 'ai-kpi' }, h('span', { text: 'Total probable (HT, chiffré)' }), h('strong', { text: fmtEur(r.total_probable_cents) })),
          h('div', { class: `ai-kpi${r.elements_sans_montant ? ' warn' : ''}` }, h('span', { text: 'Sans montant disponible' }), h('strong', { text: String(r.elements_sans_montant) }))),
        r.elements.length ? h('div', { class: 'ai-table-wrap' }, h('table', { class: 'ai-table ts-diff' },
          h('thead', null, h('tr', null, h('th'), ['Travaux détectés', 'Statut', 'Quantité', 'Montant HT'].map((t, k) => h('th', { class: k > 1 ? 'num' : '', text: t })))), h('tbody', null, rows))) : empty('Aucun écart détecté entre le devis et le constat.'),
        r.dans_le_perimetre.length ? h('div', null, h('h3', { text: 'Déjà couvert par le devis', style: 'margin-top:1rem' }), list(r.dans_le_perimetre)) : null,
        r.informations_manquantes.length ? h('div', null, h('h3', { text: 'Informations manquantes pour chiffrer ou confirmer' }), list(r.informations_manquantes)) : null,
        r.limites.length ? h('div', { class: 'ai-note-muted', text: `Limites : ${r.limites.join(' · ')}` }) : null,
        h('div', { class: 'ai-actions', style: 'margin-top:1rem' },
          h('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer l\'analyse', onclick: async () => {
            if (!(await confirmBox('Supprimer cette analyse et son avenant ?', 'Supprimer'))) return;
            await run(null, () => AIApi.del(`/api/ai/travaux_sup/analyses/${a.id}`), 'Analyse supprimée.');
            current = null; out.replaceChildren(stepsBar(1)); loadHistory(); } }),
          r.elements.length ? genBtn : null)),
      a.avenant_text ? avenantEditor(a) : null);
  }

  function avenantEditor(a) {
    const ta = h('textarea', { class: 'ts-editor', 'aria-label': 'Projet d\'avenant' }); ta.value = a.avenant_text;
    const save = h('button', { type: 'button', class: 'btn btn-primary', text: 'Enregistrer mes modifications', onclick: () => run(save, async () => { await AIApi.put(`/api/ai/travaux_sup/analyses/${a.id}/avenant`, { avenant_text: ta.value }); current.avenant_text = ta.value; }, 'Avenant enregistré.') });
    const copy = h('button', { type: 'button', class: 'btn', text: 'Copier', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); toast('Texte copié.', 'success'); } catch (_) { ta.select(); toast('Sélectionnez puis copiez le texte (Ctrl+C).', 'info'); } } });
    return h('div', { class: 'ai-card', style: 'margin-top:1rem' }, h('h2', { text: 'Projet d\'avenant' }),
      h('div', { class: 'ai-notice', text: 'Projet généré à partir des éléments sélectionnés : il n\'a aucune valeur juridique tant qu\'il n\'est pas relu, complété et accepté par les deux parties. Vérifiez chaque montant avant de l\'envoyer à votre client.' }),
      ta, h('div', { class: 'ai-actions', style: 'margin-top:.75rem' }, copy, h('button', { type: 'button', class: 'btn', text: 'Imprimer', onclick: () => window.print() }), save));
  }

  const stepsBar = (n) => h('div', { class: 'ts-steps' }, ['1. Devis et constat', '2. Écarts détectés', '3. Projet d\'avenant'].map((t, i) => h('span', { class: `ts-step${i + 1 === n ? ' on' : ''}`, text: t })));

  AIUI.bootModule({ id: 'travaux_sup', render: async (c) => {
    sources = (await AIApi.get('/api/ai/travaux_sup/sources')).analyses;
    titre = h('input', { type: 'text', maxlength: '150', placeholder: 'Ex. Salle de bain Martin — constat du 27/10' });
    devisSel = h('select', null, h('option', { value: '', text: 'Coller le devis ci-dessous…' }), sources.map((s) => h('option', { value: s.id, text: `Analyse : ${s.titre}` })));
    devisTxt = h('textarea', { maxlength: '30000', placeholder: 'Postes du devis signé (désignation, quantités, prix)…' });
    constatTxt = h('textarea', { maxlength: '30000', placeholder: 'Ce que vous constatez sur le chantier : imprévus, reprises, demandes du client…' });
    out = h('div', { style: 'margin-top:1.25rem' }, stepsBar(1));
    histSel = h('select', { class: 'ai-input', style: 'width:auto;max-width:100%', 'aria-label': 'Analyses précédentes', onchange: async () => {
      if (!histSel.value) return; out.replaceChildren(loading());
      try { showResult((await AIApi.get(`/api/ai/travaux_sup/analyses/${histSel.value}`)).analysis); } catch (e) { out.replaceChildren(empty(e.message)); } } });
    const go = h('button', { type: 'button', class: 'btn btn-primary', text: 'Comparer et détecter les écarts', onclick: () => run(go, async () => {
      out.replaceChildren(stepsBar(2), loading('Comparaison en cours…'));
      const body = { titre: titre.value, devis_text: devisTxt.value, constat_text: constatTxt.value };
      if (devisSel.value) body.quote_analysis_id = Number(devisSel.value);
      try { showResult((await AIApi.post('/api/ai/travaux_sup/analyze', body)).analysis); loadHistory(); }
      catch (e) { out.replaceChildren(stepsBar(1)); throw e; }
    }) });
    c.append(header('Détecteur de travaux supplémentaires', 'Comparez le périmètre vendu au constat de chantier, repérez ce qui sort du devis et préparez un projet d\'avenant à faire valider par votre client.'),
      h('div', { class: 'ai-row', style: 'justify-content:space-between;margin-bottom:1rem' }, h('div'), histSel),
      field('Intitulé de l\'analyse', titre),
      h('div', { class: 'ts-compare' },
        h('div', { class: 'ai-card ts-col' }, h('h3', { text: 'Avant — devis initial' }), field('Source du devis', devisSel, 'Vos analyses du module Qualification sont réutilisables.'), field('Contenu du devis', devisTxt)),
        h('div', { class: 'ai-card ts-col after' }, h('h3', { text: 'Après — constat de chantier' }), field('Travaux constatés', constatTxt))),
      h('div', { class: 'ai-actions' }, go), out);
    await loadHistory();
  } });
})();
