/** Module 2 — Assistant de chantier : suivi terrain (notes, photos, vocaux, comptes rendus), pensé mobile. */
(() => {
  const { h, fmtDateTime, fmtDate, dayKey, run, badge, loading, empty, field, modal, toast, confirmBox, header, list } = AIUI;
  let sites = [], siteId = null, feed, siteSel;

  async function loadSites(select) {
    sites = (await AIApi.get('/api/ai/chantier/sites')).sites;
    siteSel.replaceChildren(...sites.map((s) => h('option', { value: s.id, text: s.nom + (s.client_nom ? ` — ${s.client_nom}` : '') })));
    if (select) siteId = select;
    if (!sites.find((s) => s.id === siteId)) siteId = sites.length ? sites[0].id : null;
    if (siteId) siteSel.value = siteId;
    await loadFeed();
  }

  async function loadFeed() {
    if (!siteId) { feed.replaceChildren(empty('Créez votre premier chantier pour commencer.')); return; }
    feed.replaceChildren(loading());
    const { entries } = await AIApi.get(`/api/ai/chantier/sites/${siteId}/entries`);
    if (!entries.length) { feed.replaceChildren(empty('Aucune entrée. Ajoutez une note, une photo ou un mémo vocal.')); return; }
    const days = {};
    entries.forEach((e) => (days[dayKey(e.created_at)] = days[dayKey(e.created_at)] || []).push(e));
    feed.replaceChildren(...Object.keys(days).sort().reverse().flatMap((d) => [
      h('div', { class: 'ch-day', text: fmtDate(d) }),
      h('div', { class: 'ch-feed' }, days[d].map(entryCard))]));
  }

  const KIND = { note: ['Note', 'neutral'], photo: ['Photo', 'gold'], audio: ['Vocal transcrit', 'ok'], compte_rendu: ['Compte rendu', 'gold'] };
  function entryCard(e) {
    const ai = e.ai || {};
    return h('div', { class: `ch-item${e.kind === 'compte_rendu' ? ' cr' : ''}` },
      h('div', { class: 'ch-item-head' }, h('span', null, badge(KIND[e.kind][0], KIND[e.kind][1]), ' ', fmtDateTime(e.created_at).slice(-5)),
        h('button', { type: 'button', class: 'ai-x', style: 'font-size:1.2rem;min-width:32px;min-height:32px', 'aria-label': 'Supprimer', text: '×', onclick: async () => {
          if (await confirmBox('Supprimer cette entrée ?', 'Supprimer')) { await run(null, () => AIApi.del(`/api/ai/chantier/entries/${e.id}`)); loadFeed(); }
        } })),
      h('p', { text: e.content || '' }),
      e.kind === 'photo' ? h('div', null, e.filename ? h('small', { text: `Fichier : ${e.filename} (non conservé)` }) : null,
        ai.avancement ? h('p', null, h('strong', { text: 'Avancement : ' }), ai.avancement) : null,
        ai.points_a_verifier && ai.points_a_verifier.length ? h('div', null, h('strong', { text: 'À vérifier sur place :' }), list(ai.points_a_verifier)) : null) : null,
      e.kind === 'audio' && ai.passages_incertains && ai.passages_incertains.length ?
        h('div', { class: 'ai-note-muted', text: `Passages incertains : ${ai.passages_incertains.join(' · ')}` }) : null);
  }

  const upload = (fd) => AIApi.upload(`/api/ai/chantier/sites/${siteId}/entries`, fd);
  const needSite = () => { if (!siteId) { toast('Créez ou sélectionnez un chantier.', 'error'); return false; } return true; };

  function noteModal() {
    if (!needSite()) return;
    const t = h('textarea', { maxlength: '8000', placeholder: 'Observation, difficulté, décision…', style: 'min-height:160px' });
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Enregistrer', onclick: () => run(btn, async () => {
      const fd = new FormData(); fd.append('kind', 'note'); fd.append('texte', t.value); await upload(fd); m.close(); loadFeed();
    }, 'Note enregistrée.') });
    const m = modal('Nouvelle note', h('div', null, field('Note', t), h('div', { class: 'ai-actions' }, btn)));
    t.focus();
  }

  function photoModal() {
    if (!needSite()) return;
    let file = null;
    const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: () => { file = input.files[0] || null; info.textContent = file ? file.name : ''; } });
    const info = h('small');
    const cap = h('input', { type: 'text', maxlength: '300', placeholder: 'Légende (facultatif)' });
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Envoyer et analyser', onclick: () => {
      if (!file) { toast('Choisissez ou prenez une photo.', 'error'); return; }
      run(btn, async () => {
        const fd = new FormData(); fd.append('kind', 'photo'); fd.append('texte', cap.value); fd.append('fichier', file);
        await upload(fd); m.close(); loadFeed();
      }, 'Photo analysée et enregistrée.');
    } });
    const m = modal('Photo de chantier', h('div', null, field('Photo (JPG, PNG, WEBP — 10 Mo max)', input, 'Sur mobile, ouvre l\'appareil photo.'), info,
      field('Légende', cap), h('div', { class: 'ai-note-muted', style: 'margin-bottom:1rem', text: 'La photo est analysée puis le texte du constat est conservé. L\'image elle-même n\'est pas stockée.' }),
      h('div', { class: 'ai-actions' }, btn)));
  }

  function audioModal() {
    if (!needSite()) return;
    let rec = null, chunks = [], blob = null, ext = 'webm', timer = null, sec = 0, stream = null;
    const clock = h('div', { class: 'ch-rec', text: '00:00' });
    const state = h('p', { class: 'ai-note-muted', text: 'Appuyez sur Enregistrer, parlez, puis arrêtez.' });
    const send = h('button', { type: 'button', class: 'btn btn-primary', text: 'Envoyer et transcrire', disabled: true });
    const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); clearInterval(timer); clock.classList.remove('on'); recBtn.textContent = 'Enregistrer'; };
    const recBtn = h('button', { type: 'button', class: 'btn', style: 'width:100%;min-height:56px;font-size:1.05rem', text: 'Enregistrer', onclick: async () => {
      if (rec && rec.state === 'recording') { stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { toast("L'enregistrement n'est pas pris en charge ici : utilisez « Choisir un fichier audio ».", 'error'); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (_) { toast('Accès au micro refusé.', 'error'); return; }
      const type = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'; ext = type === 'audio/mp4' ? 'm4a' : 'webm';
      rec = new MediaRecorder(stream, { mimeType: type }); chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); blob = new Blob(chunks, { type }); send.disabled = !blob.size; state.textContent = `Enregistrement prêt (${sec}s).`; };
      sec = 0; rec.start(); clock.classList.add('on'); recBtn.textContent = 'Arrêter';
      timer = setInterval(() => { sec++; clock.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; if (sec >= 300) stop(); }, 1000);
    } });
    const pick = h('input', { type: 'file', accept: 'audio/*', onchange: () => { if (pick.files[0]) { blob = pick.files[0]; ext = 'bin'; send.disabled = false; state.textContent = `Fichier : ${blob.name}`; } } });
    send.onclick = () => run(send, async () => {
      const fd = new FormData(); fd.append('kind', 'audio');
      fd.append('fichier', blob, blob.name || `memo.${ext}`);
      await upload(fd); m.close(); loadFeed();
    }, 'Mémo transcrit et enregistré.');
    const m = modal('Mémo vocal', h('div', null, clock, recBtn, state, field('…ou choisir un fichier audio (MP3, WAV, OGG, M4A — 15 Mo max)', pick),
      h('div', { class: 'ai-actions' }, send)), { onClose: () => { stop(); if (stream) stream.getTracks().forEach((t) => t.stop()); } });
  }

  function reportModal() {
    if (!needSite()) return;
    const iso = (d) => d.toISOString().slice(0, 10);
    const d2 = h('input', { type: 'date', value: iso(new Date()) });
    const d1 = h('input', { type: 'date', value: iso(new Date(Date.now() - 7 * 864e5)) });
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Générer le compte rendu', onclick: () => run(btn, async () => {
      const r = await AIApi.post(`/api/ai/chantier/sites/${siteId}/report`, { date_debut: d1.value, date_fin: d2.value });
      m.close(); toast(`Compte rendu généré à partir de ${r.entries_used} entrée(s).`, 'success'); loadFeed();
    }) });
    const m = modal('Compte rendu de chantier', h('div', null, h('div', { class: 'ai-row' }, field('Du', d1), field('Au', d2)),
      h('p', { class: 'ai-note-muted', style: 'margin-bottom:1rem', text: 'Le compte rendu est rédigé uniquement à partir des notes, photos et mémos de la période. Relisez-le avant de le transmettre.' }),
      h('div', { class: 'ai-actions' }, btn)));
  }

  function siteModal() {
    const nom = h('input', { type: 'text', maxlength: '150', placeholder: 'Ex. Rénovation salle de bain' });
    const client = h('input', { type: 'text', maxlength: '150' }), adr = h('input', { type: 'text', maxlength: '250' });
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Créer le chantier', onclick: () => run(btn, async () => {
      const { site } = await AIApi.post('/api/ai/chantier/sites', { nom: nom.value, client_nom: client.value, adresse: adr.value });
      m.close(); await loadSites(site.id);
    }, 'Chantier créé.') });
    const m = modal('Nouveau chantier', h('div', null, field('Nom du chantier', nom), field('Client', client), field('Adresse', adr), h('div', { class: 'ai-actions' }, btn)));
  }

  AIUI.bootModule({ id: 'chantier', render: async (c) => {
    siteSel = h('select', { 'aria-label': 'Chantier', onchange: () => { siteId = Number(siteSel.value); loadFeed(); } });
    feed = h('div');
    const act = (ico, label, fn) => h('button', { type: 'button', class: 'ch-act', onclick: fn }, h('span', { class: 'ico', text: ico }), label);
    c.append(header('Assistant de chantier', 'Documentez le chantier sur le terrain : notes, photos, mémos vocaux, puis comptes rendus structurés.'),
      h('div', { class: 'ch-bar' }, siteSel, h('button', { type: 'button', class: 'btn', onclick: siteModal, text: '+ Chantier' })),
      h('div', { class: 'ch-actions' }, act('📝', 'Note', noteModal), act('📷', 'Photo', photoModal), act('🎙️', 'Vocal', audioModal)),
      h('div', { class: 'ai-row', style: 'justify-content:space-between' }, h('h3', { text: 'Journal du chantier' }),
        h('button', { type: 'button', class: 'btn btn-sm', onclick: reportModal, text: 'Générer un compte rendu' })),
      feed);
    await loadSites();
  } });
})();
