/** Module 5 — Coordinateur IA & Relances : tableau d'actions, devis sans réponse, messages validés avant envoi. */
(() => {
  const { h, fmtDate, fmtDateTime, run, badge, loading, empty, field, modal, toast, confirmBox, header } = AIUI;
  let data = null, kpis, board, doneBox;
  const todayISO = () => new Date().toISOString().slice(0, 10);

  async function refresh() { data = await AIApi.get('/api/ai/coordination/overview'); renderAll(); }

  function renderAll() {
    const open = data.followups.filter((f) => f.statut === 'a_faire');
    const late = open.filter((f) => f.due_date && f.due_date < data.today);
    const upcoming = open.filter((f) => !(f.due_date && f.due_date < data.today));
    const tracked = new Set(open.map((f) => f.lead_id).filter(Boolean));
    const quotes = data.quotes_waiting.filter((q) => !tracked.has(q.lead_id));
    kpis.replaceChildren(
      k('Devis envoyés sans action de suivi', String(quotes.length)), k('Actions à faire', String(open.length)),
      k('En retard', String(late.length), late.length > 0));
    board.replaceChildren(
      col('En retard', late.map((f) => card(f, true)), 'late', 'Aucune action en retard.'),
      col('À venir', upcoming.map((f) => card(f, false)), '', 'Aucune action planifiée.'),
      col('Devis envoyés — à suivre', quotes.map(quoteCard), '', 'Aucun devis en attente de suivi.'),
    );
    const done = data.followups.filter((f) => f.statut === 'fait');
    doneBox.replaceChildren(...(done.length ? [h('details', { class: 'ai-card', style: 'margin-top:1rem' }, h('summary', { text: `Terminées (${done.length})`, style: 'cursor:pointer;font-weight:600' }),
      h('div', { class: 'co-stack', style: 'margin-top:.75rem' }, done.map((f) => card(f, false, true))))] : []));
  }
  const k = (l, v, warn) => h('div', { class: `ai-kpi${warn ? ' warn' : ''}` }, h('span', { text: l }), h('strong', { text: v }));
  const col = (title, cards, cls, none) => h('div', { class: `co-col ${cls}` }, h('h3', null, h('span', { text: title }), h('span', { text: String(cards.length) })),
    h('div', { class: 'co-stack' }, cards.length ? cards : [empty(none)]));

  function card(f, late, done) {
    return h('div', { class: `co-card${late ? ' late' : ''}` },
      h('strong', { text: f.contact_nom }), h('small', { text: `${f.sujet}${f.due_date ? ' · échéance ' + fmtDate(f.due_date) : ''}` }),
      f.note ? h('small', { text: f.note }) : null,
      h('div', { class: 'ai-row' },
        done ? null : h('button', { type: 'button', class: 'btn btn-sm btn-primary', text: 'Relancer', onclick: () => composer(f) }),
        done ? h('button', { type: 'button', class: 'btn btn-sm', text: 'Rouvrir', onclick: () => setStatus(f, 'a_faire') })
          : h('button', { type: 'button', class: 'btn btn-sm', text: 'Marquer fait', onclick: () => setStatus(f, 'fait') }),
        h('button', { type: 'button', class: 'btn btn-sm', text: 'Modifier', onclick: () => editModal(f) }),
        h('button', { type: 'button', class: 'btn btn-sm btn-danger', text: 'Supprimer', onclick: async () => {
          if (await confirmBox('Supprimer cette action et son historique d\'envois ?', 'Supprimer')) { await run(null, () => AIApi.del(`/api/ai/coordination/followups/${f.id}`), 'Action supprimée.'); refresh(); }
        } })));
  }

  function quoteCard(q) {
    return h('div', { class: 'co-card' }, h('strong', { text: q.client_nom || 'Client' }),
      h('small', { text: `${q.type_travaux || 'Travaux'} · devis envoyé il y a ${q.jours} j · statut : ${q.statut_lead}` }),
      q.relance_auto_envoyee ? h('div', null, badge('Relance automatique déjà envoyée par BâtiSwift', 'gold')) : null,
      h('div', { class: 'ai-row', style: 'margin-top:.5rem' }, h('button', { type: 'button', class: 'btn btn-sm btn-primary', text: 'Planifier un suivi', onclick: () =>
        editModal(null, { lead_id: q.lead_id, contact_nom: q.client_nom, contact_tel: q.client_telephone, sujet: `Suite au devis (${q.type_travaux || 'travaux'})` }) })));
  }

  async function setStatus(f, statut) { await run(null, () => AIApi.put(`/api/ai/coordination/followups/${f.id}`, { statut })); refresh(); }

  function editModal(f, preset) {
    const v = f || preset || {};
    const el = { contact_nom: h('input', { type: 'text', maxlength: '150', value: v.contact_nom || '' }), sujet: h('input', { type: 'text', maxlength: '200', value: v.sujet || '' }),
      contact_tel: h('input', { type: 'tel', maxlength: '30', value: v.contact_tel || '', placeholder: '+33612345678' }), contact_email: h('input', { type: 'email', maxlength: '150', value: v.contact_email || '' }),
      due_date: h('input', { type: 'date', value: v.due_date || todayISO() }), note: h('textarea', { maxlength: '3000', style: 'min-height:70px' }) };
    el.note.value = v.note || '';
    const btn = h('button', { type: 'button', class: 'btn btn-primary', text: f ? 'Enregistrer' : 'Créer l\'action', onclick: () => run(btn, async () => {
      const p = {}; Object.entries(el).forEach(([key, node]) => (p[key] = node.value.trim())); if (v.lead_id && !f) p.lead_id = v.lead_id;
      if (f) await AIApi.put(`/api/ai/coordination/followups/${f.id}`, p); else await AIApi.post('/api/ai/coordination/followups', p);
      m.close(); refresh();
    }, 'Action enregistrée.') });
    const m = modal(f ? 'Modifier l\'action' : 'Nouvelle action de suivi', h('div', null, field('Contact', el.contact_nom), field('Objet', el.sujet),
      h('div', { class: 'ai-row' }, field('Téléphone (SMS / WhatsApp)', el.contact_tel), field('E-mail', el.contact_email)), field('Échéance', el.due_date), field('Note', el.note), h('div', { class: 'ai-actions' }, btn)));
  }

  async function composer(f) {
    const canal = h('select', null, [['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail']].map(([val, t]) => h('option', { value: val, text: t })));
    const ton = h('select', null, [['chaleureux', 'Chaleureux'], ['professionnel', 'Professionnel'], ['direct', 'Direct']].map(([val, t]) => h('option', { value: val, text: t })));
    const msg = h('textarea', { maxlength: '1600', style: 'min-height:140px', placeholder: 'Rédigez votre message ou demandez une proposition…' });
    const dest = () => (canal.value === 'email' ? f.contact_email : f.contact_tel);
    const info = h('p', { class: 'ai-note-muted' });
    const upd = () => { info.textContent = dest() ? `Destinataire : ${dest()}` : `Aucun ${canal.value === 'email' ? 'e-mail' : 'numéro'} enregistré : utilisez « Modifier » pour l'ajouter.`; };
    canal.onchange = upd; upd();
    const draft = h('button', { type: 'button', class: 'btn', text: 'Proposer un message (IA)', onclick: () => run(draft, async () => { msg.value = (await AIApi.post('/api/ai/coordination/draft', { followup_id: f.id, canal: canal.value, ton: ton.value })).message; }) });
    const send = h('button', { type: 'button', class: 'btn btn-primary', text: 'Envoyer', onclick: async () => {
      if (!msg.value.trim()) { toast('Le message est vide.', 'error'); return; }
      if (!dest()) { toast('Aucun destinataire pour ce canal.', 'error'); return; }
      if (!(await confirmBox(`Envoyer ce message à ${f.contact_nom} (${dest()}) ?`, 'Envoyer'))) return;
      const r = await run(send, () => AIApi.post('/api/ai/coordination/send', { followup_id: f.id, canal: canal.value, message: msg.value, confirm: true }));
      if (r && r.sent) { toast('Message envoyé (confirmé par le service).', 'success'); loadLogs(); }
      else loadLogs();   // un échec est journalisé côté serveur : on l'affiche tel quel
    } });
    const logs = h('div', { class: 'co-log' });
    async function loadLogs() {
      try { const { logs: rows } = await AIApi.get(`/api/ai/coordination/followups/${f.id}/logs`);
        logs.replaceChildren(h('strong', { text: 'Historique des envois' }), ...(rows.length ? rows.map((l) => h('div', null, badge(l.resultat === 'envoye' ? 'Envoyé' : 'Échec', l.resultat === 'envoye' ? 'ok' : 'bad'), ` ${l.canal.toUpperCase()} · ${fmtDateTime(l.created_at)}`, h('div', { text: l.message, style: 'color:var(--bs-text-muted)' }))) : [h('small', { text: 'Aucun envoi pour le moment.' })]));
      } catch (_) { logs.replaceChildren(h('small', { text: 'Historique indisponible.' })); }
    }
    modal(`Relancer — ${f.contact_nom}`, h('div', null, h('div', { class: 'ai-row' }, field('Canal', canal), field('Ton (pour la proposition)', ton)), info, draft, h('div', { style: 'height:.75rem' }), field('Message', msg),
      h('div', { class: 'ai-note-muted', style: 'margin-bottom:1rem', text: 'Rien n\'est envoyé sans votre confirmation. Le statut « Envoyé » n\'apparaît que si le service de messagerie a accepté le message.' }),
      h('div', { class: 'ai-actions' }, send), logs), { wide: true });
    loadLogs();
  }

  AIUI.bootModule({ id: 'coordination', render: async (c) => {
    kpis = h('div', { class: 'ai-kpis' }); board = h('div', { class: 'co-board' }); doneBox = h('div');
    c.append(header('Coordinateur IA & Relances', 'Suivez vos devis sans réponse et vos échéances, rédigez des relances adaptées et envoyez-les après validation.'),
      kpis, h('div', { class: 'ai-row', style: 'justify-content:space-between;margin-bottom:.75rem' }, h('h3', { text: 'Tableau d\'actions' }),
        h('button', { type: 'button', class: 'btn btn-primary', text: '+ Nouvelle action', onclick: () => editModal(null) })), board, doneBox,
      h('p', { class: 'ai-note-muted', style: 'margin-top:1rem', text: 'Les relances automatiques de devis de BâtiSwift continuent de fonctionner séparément ; ce module n\'en crée pas de nouvelles et n\'en modifie pas le calendrier.' }));
    await refresh();
  } });
})();
