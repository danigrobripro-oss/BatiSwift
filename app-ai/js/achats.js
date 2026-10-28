/** Module 3 — Contrôle Coûts & Factures : tableau de bord financier (prévu/réel, factures, écarts). */
(() => {
  const { h, fmtEur, fmtDate, run, badge, loading, empty, field, modal, toast, confirmBox, header, dropzone, list } = AIUI;
  let sites = [], invoices = [], summary = null, filterSite = '', kpis, siteBox, table, importMsg;
  const CATS = ['gros_oeuvre', 'plomberie', 'electricite', 'menuiserie', 'peinture', 'isolation', 'outillage', 'location', 'autre'];
  const catLabel = (c) => ({ gros_oeuvre: 'Gros œuvre', electricite: 'Électricité', outillage: 'Outillage' }[c] || (c ? c[0].toUpperCase() + c.slice(1) : '—'));
  const siteName = (id) => (sites.find((s) => s.id === id) || {}).nom || 'Non affectée';
  const eurToStr = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

  async function refresh() {
    const q = filterSite ? `?chantier_id=${filterSite}` : '';
    [sites, invoices, summary] = await Promise.all([
      AIApi.get('/api/ai/achats/sites').then((r) => r.sites),
      AIApi.get(`/api/ai/achats/invoices${q}`).then((r) => r.invoices),
      AIApi.get('/api/ai/achats/summary')]);
    renderAll();
  }

  function renderAll() {
    const total = invoices.reduce((s, i) => s + (i.total_ht_cents || 0), 0);
    const toCheck = invoices.filter((i) => i.anomalies.some((a) => a.niveau === 'attention')).length;
    kpis.replaceChildren(
      kpi('Achats importés (HT)', fmtEur(total)), kpi('Factures', String(invoices.length)),
      kpi('À vérifier', String(toCheck), toCheck > 0),
      kpi('Non affectées', String(summary.non_affectees.factures)),
      summary.sans_montant ? kpi('Sans montant lu', String(summary.sans_montant), true) : null);
    siteBox.replaceChildren(...(summary.chantiers.length ? summary.chantiers.map(siteCard) : [empty('Créez un chantier pour suivre le prévu / réel.')]));
    renderTable();
  }
  const kpi = (l, v, warn) => h('div', { class: `ai-kpi${warn ? ' warn' : ''}` }, h('span', { text: l }), h('strong', { text: v }));

  function siteCard(c) {
    const k = c.controle, pct = k.budget_achats_cents ? Math.min(100, Math.round(k.achats_reels_cents / k.budget_achats_cents * 100)) : 0;
    const lvl = { depassement: ['Dépassement', 'bad'], vigilance: ['Vigilance', 'warn'], dans_le_budget: ['Dans le budget', 'ok'], inconnu: ['Budget à renseigner', 'neutral'] }[k.niveau];
    return h('div', { class: 'ai-card' },
      h('div', { class: 'ai-row', style: 'justify-content:space-between' }, h('h3', { text: c.site.nom, style: 'margin:0' }), badge(lvl[0], lvl[1])),
      k.budget_achats_cents ? h('div', { class: `ac-bar ${k.niveau}` }, h('i', { style: `width:${pct}%` })) : null,
      h('div', { class: 'ac-nums' }, h('span', { text: `Réel : ${fmtEur(k.achats_reels_cents)}` }), h('span', { text: `Prévu : ${fmtEur(k.budget_achats_cents)}` }),
        k.ecart_cents != null ? h('strong', { text: `Écart : ${fmtEur(k.ecart_cents)} (${k.ecart_pct} %)` }) : null),
      Object.keys(c.par_categorie).length ? h('p', { class: 'ai-note-muted', style: 'margin-top:.6rem', text: Object.entries(c.par_categorie).map(([a, b]) => `${catLabel(a)} ${fmtEur(b)}`).join(' · ') }) : null,
      list(k.messages, 'ai-list'),
      h('button', { type: 'button', class: 'btn btn-sm', text: 'Budget du chantier', onclick: () => budgetModal(c.site) }));
  }

  function budgetModal(s) {
    const b = h('input', { type: 'text', inputmode: 'decimal', value: eurToStr(s.budget_achats_cents), placeholder: 'Ex. 12 500,00' });
    const v = h('input', { type: 'text', inputmode: 'decimal', value: eurToStr(s.prix_vente_ht_cents), placeholder: 'Ex. 28 000,00 (facultatif)' });
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Enregistrer', onclick: () => run(btn, async () => {
      await AIApi.put(`/api/ai/achats/sites/${s.id}`, { budget_achats: b.value.trim(), prix_vente_ht: v.value.trim() }); m.close(); refresh();
    }, 'Budget enregistré.') });
    const m = modal(`Budget — ${s.nom}`, h('div', null, field('Budget prévu pour les achats (€ HT)', b, 'Vide = pas de comparaison.'),
      field('Prix de vente HT du chantier (€)', v, 'Sert uniquement à une marge indicative sur achats.'), h('div', { class: 'ai-actions' }, btn)));
  }

  function renderTable() {
    if (!invoices.length) { table.replaceChildren(empty('Aucune facture. Importez-en une ci-dessus.')); return; }
    const body = h('tbody');
    invoices.forEach((i) => {
      const att = i.anomalies.filter((a) => a.niveau === 'attention').length;
      const detail = h('tr', { class: 'ac-detail', hidden: true }, h('td', { colspan: 8 }, detailBox(i)));
      body.append(h('tr', { class: 'ac-row', onclick: () => { detail.hidden = !detail.hidden; } },
        h('td', { text: i.fournisseur || '—' }), h('td', { text: i.numero || '—' }), h('td', { text: fmtDate(i.date_facture) }),
        h('td', { text: catLabel(i.categorie) }), h('td', { class: 'num', text: fmtEur(i.total_ht_cents) }), h('td', { class: 'num', text: fmtEur(i.total_ttc_cents) }),
        h('td', { text: siteName(i.chantier_id) }),
        h('td', null, att ? badge(`${att} à vérifier`, 'warn') : i.anomalies.length ? badge('Infos', 'neutral') : badge('Cohérente', 'ok'))), detail);
    });
    table.replaceChildren(h('div', { class: 'ai-table-wrap' }, h('table', { class: 'ai-table' },
      h('thead', null, h('tr', null, ['Fournisseur', 'N°', 'Date', 'Catégorie', 'HT', 'TTC', 'Chantier', 'Contrôle'].map((t, k) => h('th', { class: k === 4 || k === 5 ? 'num' : '', text: t })))), body)));
  }

  function detailBox(i) {
    return h('div', null,
      i.anomalies.length ? h('div', null, h('strong', { text: 'Points à vérifier (écarts constatés, pas des certitudes) :' }), list(i.anomalies.map((a) => a.message))) : null,
      i.lines.length ? h('table', { class: 'ai-table' }, h('thead', null, h('tr', null, ['Désignation', 'Qté', 'PU HT', 'Total HT'].map((t, k) => h('th', { class: k ? 'num' : '', text: t })))),
        h('tbody', null, i.lines.map((l) => h('tr', null, h('td', { text: l.designation }), h('td', { class: 'num', text: l.quantite ? `${l.quantite} ${l.unite || ''}` : '—' }),
          h('td', { class: 'num', text: fmtEur(l.prix_unitaire_cents) }), h('td', { class: 'num', text: fmtEur(l.total_ht_cents) }))))) : h('p', { class: 'ai-note-muted', text: 'Aucune ligne détaillée lue.' }),
      h('div', { class: 'ai-row', style: 'margin-top:.75rem' },
        h('button', { type: 'button', class: 'btn btn-sm', text: 'Corriger / affecter', onclick: (e) => { e.stopPropagation(); editModal(i); } }),
        h('button', { type: 'button', class: 'btn btn-sm btn-danger', text: 'Supprimer', onclick: async (e) => {
          e.stopPropagation();
          if (await confirmBox('Supprimer cette facture ?', 'Supprimer')) { await run(null, () => AIApi.del(`/api/ai/achats/invoices/${i.id}`), 'Facture supprimée.'); refresh(); }
        } })));
  }

  function editModal(i) {
    const f = {
      fournisseur: h('input', { type: 'text', value: i.fournisseur || '' }), numero: h('input', { type: 'text', value: i.numero || '' }),
      date_facture: h('input', { type: 'date', value: i.date_facture || '' }),
      categorie: h('select', null, CATS.map((c) => h('option', { value: c, text: catLabel(c), selected: c === i.categorie }))),
      chantier_id: h('select', null, h('option', { value: '', text: 'Non affectée' }), sites.map((s) => h('option', { value: s.id, text: s.nom, selected: s.id === i.chantier_id }))),
      total_ht: h('input', { type: 'text', inputmode: 'decimal', value: eurToStr(i.total_ht_cents) }),
      tva: h('input', { type: 'text', inputmode: 'decimal', value: eurToStr(i.tva_cents) }),
      total_ttc: h('input', { type: 'text', inputmode: 'decimal', value: eurToStr(i.total_ttc_cents) }) };
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Enregistrer', onclick: () => run(btn, async () => {
      const p = {}; Object.entries(f).forEach(([k, el]) => (p[k] = el.value.trim())); await AIApi.put(`/api/ai/achats/invoices/${i.id}`, p); m.close(); refresh();
    }, 'Facture mise à jour.') });
    const m = modal('Corriger la facture', h('div', null, field('Fournisseur', f.fournisseur), h('div', { class: 'ai-row' }, field('N°', f.numero), field('Date', f.date_facture)),
      h('div', { class: 'ai-row' }, field('Catégorie', f.categorie), field('Chantier', f.chantier_id)),
      h('div', { class: 'ai-row' }, field('Total HT (€)', f.total_ht), field('TVA (€)', f.tva), field('Total TTC (€)', f.total_ttc)), h('div', { class: 'ai-actions' }, btn)), { wide: true });
  }

  async function importFiles(files) {
    for (const [n, file] of files.entries()) {
      importMsg.textContent = `Analyse de « ${file.name} » (${n + 1}/${files.length})…`;
      try {
        const fd = new FormData(); fd.append('fichier', file); if (filterSite) fd.append('chantier_id', filterSite);
        const { invoice } = await AIApi.upload('/api/ai/achats/invoices/analyze', fd);
        toast(`« ${file.name} » : ${invoice.fournisseur || 'fournisseur non lu'} — ${fmtEur(invoice.total_ht_cents)} HT${invoice.lisibilite === 'faible' ? ' (lecture difficile, vérifiez)' : ''}.`, 'success');
      } catch (e) { if (!e.redirecting) toast(`« ${file.name} » : ${e.message}`, 'error'); }
    }
    importMsg.textContent = ''; refresh();
  }

  AIUI.bootModule({ id: 'achats', render: async (c) => {
    kpis = h('div', { class: 'ai-kpis' }); siteBox = h('div', { class: 'ac-sites' }); table = h('div'); importMsg = h('p', { class: 'ai-note-muted', style: 'min-height:1.2rem;margin-top:.5rem' });
    const sel = h('select', { class: 'ai-input', style: 'width:auto', 'aria-label': 'Filtrer par chantier', onchange: () => { filterSite = sel.value; refresh(); } },
      h('option', { value: '', text: 'Tous les chantiers' }));
    const newSite = () => { const n = h('input', { type: 'text', maxlength: '150' });
      const b = h('button', { type: 'button', class: 'btn btn-primary', text: 'Créer', onclick: () => run(b, async () => { await AIApi.post('/api/ai/achats/sites', { nom: n.value }); m.close(); await refresh(); fillSel(); }, 'Chantier créé.') });
      const m = modal('Nouveau chantier', h('div', null, field('Nom', n), h('div', { class: 'ai-actions' }, b))); };
    const fillSel = () => { sel.replaceChildren(h('option', { value: '', text: 'Tous les chantiers' }), ...sites.map((s) => h('option', { value: s.id, text: s.nom, selected: String(s.id) === filterSite }))); };
    c.append(header('Contrôle Coûts & Factures', 'Importez vos factures fournisseurs, comparez le réel au budget d\'achats prévu et repérez les écarts à vérifier.'),
      kpis, h('div', { class: 'ai-row', style: 'justify-content:space-between;margin-bottom:.75rem' }, h('h3', { text: 'Prévu / réel par chantier' }), h('button', { type: 'button', class: 'btn btn-sm', text: '+ Chantier', onclick: newSite })), siteBox,
      h('div', { class: 'ai-card' }, h('h3', { text: 'Importer des factures' }),
        dropzone('.pdf,image/jpeg,image/png,image/webp', importFiles, 'Factures fournisseurs (PDF, JPG, PNG, WEBP — 10 Mo max chacune)', true), importMsg,
        h('p', { class: 'ai-note-muted', text: 'Les montants sont lus par l\'IA : vérifiez-les. Les factures sont comptabilisées dans le chantier sélectionné ci-dessous.' })),
      h('div', { class: 'ai-row', style: 'justify-content:space-between;margin:1.5rem 0 .75rem' }, h('h3', { text: 'Factures' }), sel), table);
    await refresh(); fillSel();
  } });
})();
