/* global netlifyIdentity */
const state = {
  token: null,
  user: null,
  leads: [],
  templates: [],
  selectedLead: null
};

// Stages are stored as free-text in Postgres (leads.stage).
// Keep the UI stages aligned with the funnel Kyle wants:
// Contacted → Qualified → Booked → Closed/Lost.
// Back-compat: older data may contain "Won"; treat it as "Closed" in the UI.
const stages = ['New', 'Contacted', 'Qualified', 'Booked', 'Closed', 'Lost', 'Nurture'];

function normalizeStageForUi(stage) {
  if (!stage) return 'New';
  if (stage === 'Won') return 'Closed';
  return stage;
}

const elements = {
  auth: document.getElementById('admin-auth'),
  app: document.getElementById('admin-app'),
  login: document.getElementById('admin-login'),
  logout: document.getElementById('admin-logout'),
  userEmail: document.getElementById('admin-user-email'),
  denied: document.getElementById('admin-access-denied'),
  tabs: document.querySelectorAll('.admin-tab'),
  views: document.querySelectorAll('.admin-view'),
  pipeline: document.getElementById('pipeline-board'),
  refreshLeads: document.getElementById('refresh-leads'),
  leadEmpty: document.getElementById('lead-empty'),
  leadDetail: document.getElementById('lead-detail'),
  refreshTemplates: document.getElementById('refresh-templates'),
  templateForm: document.getElementById('template-form'),
  templateList: document.getElementById('template-list'),
  auditList: document.getElementById('audit-list'),
  refreshAudit: document.getElementById('refresh-audit'),
  analyticsDays: document.getElementById('analytics-days'),
  analyticsRange: document.getElementById('analytics-range'),
  refreshAnalytics: document.getElementById('refresh-analytics'),
  analyticsTotals: document.getElementById('analytics-totals'),
  analyticsCta: document.getElementById('analytics-cta')
};

function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  return fetch(path, { ...options, headers });
}

function setView(viewId) {
  elements.views.forEach((view) => {
    view.classList.toggle('is-hidden', view.id !== `view-${viewId}`);
  });
  elements.tabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.view === viewId);
  });
}

function showAuth() {
  elements.auth.classList.remove('is-hidden');
  elements.app.classList.add('is-hidden');
  elements.denied.classList.add('is-hidden');
}

function showAccessDenied() {
  elements.auth.classList.remove('is-hidden');
  elements.denied.classList.remove('is-hidden');
  elements.app.classList.add('is-hidden');
}

function showApp() {
  elements.auth.classList.add('is-hidden');
  elements.app.classList.remove('is-hidden');
  elements.denied.classList.add('is-hidden');
}

async function loadWhoami() {
  try {
    const response = await apiFetch('/api/admin/whoami');
    if (!response.ok) {
      showAuth();
      return null;
    }
    const data = await response.json();
    if (!data.is_admin) {
      showAccessDenied();
      return null;
    }
    elements.userEmail.textContent = data.email;
    showApp();
    return data;
  } catch (error) {
    showAuth();
    return null;
  }
}

async function loadLeads() {
  const response = await apiFetch('/api/admin/leads');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  state.leads = data.leads || [];
  renderPipeline();
}

function renderPipeline() {
  elements.pipeline.innerHTML = '';
  stages.forEach((stage) => {
    const column = document.createElement('div');
    column.className = 'pipeline-column';
    const count = state.leads.filter((lead) => normalizeStageForUi(lead.stage) === stage).length;
    column.innerHTML = `<h4>${stage} <span>${count}</span></h4>`;

    state.leads
      .filter((lead) => normalizeStageForUi(lead.stage) === stage)
      .forEach((lead) => {
        const card = document.createElement('div');
        card.className = 'lead-card';
        card.innerHTML = `
          <strong>${lead.name || 'Unknown'}</strong>
          <span>${lead.business_type || ''}</span>
          <span>${lead.goal || ''} ? ${lead.urgency || ''}</span>
        `;
        card.addEventListener('click', () => loadLead(lead.id));
        column.appendChild(card);
      });

    elements.pipeline.appendChild(column);
  });
}

async function loadLead(id) {
  const response = await apiFetch(`/api/admin/lead?id=${encodeURIComponent(id)}`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  state.selectedLead = data;
  renderLeadDetail();
  setView('lead');
}

function renderLeadDetail() {
  const data = state.selectedLead;
  if (!data || !data.lead) {
    elements.leadEmpty.classList.remove('is-hidden');
    elements.leadDetail.classList.add('is-hidden');
    return;
  }

  elements.leadEmpty.classList.add('is-hidden');
  elements.leadDetail.classList.remove('is-hidden');

  const lead = data.lead;
  const leadStageUi = normalizeStageForUi(lead.stage);
  const transcriptHtml = (lead.transcript || []).map((item) => {
    const role = item.role === 'agent' ? 'agent' : 'visitor';
    return `<div class="chat-bubble ${role}">${item.text}</div>`;
  }).join('');

  const eventsHtml = data.events.map((event) => {
    return `<div class="audit-item"><strong>${event.event_type}</strong> ? ${new Date(event.created_at).toLocaleString()}</div>`;
  }).join('') || '<div>No events yet.</div>';

  const notesHtml = data.notes.map((note) => {
    return `<div class="audit-item">${note.body}<br/><small>${new Date(note.created_at).toLocaleString()}</small></div>`;
  }).join('') || '<div>No notes yet.</div>';

  const messagesHtml = data.messages.map((message) => {
    return `<div class="message-item"><strong>${message.channel.toUpperCase()}</strong> ? ${message.status}<br/>${message.rendered_content}</div>`;
  }).join('') || '<div>No messages yet.</div>';

  const templateKeys = Array.from(new Set(state.templates.map((template) => template.template_key)));

  elements.leadDetail.innerHTML = `
    <div class="lead-detail-grid">
      <div class="lead-detail-section">
        <h3>${lead.name}</h3>
        <p>${lead.business_type || ''} ? ${lead.service_area || ''}</p>
        <div class="admin-actions">
          <label>Stage
            <select id="lead-stage">
              ${stages.map((stage) => `<option value="${stage}" ${leadStageUi === stage ? 'selected' : ''}>${stage}</option>`).join('')}
            </select>
          </label>
          <label>Tags (comma separated)
            <input id="lead-tags" type="text" value="${(lead.tags || []).join(', ')}" />
          </label>
          <button class="btn btn-primary" id="save-lead">Save</button>
        </div>
      </div>

      <div class="lead-detail-section">
        <h4>Contact</h4>
        <p>${lead.phone} ? ${lead.email}</p>
        <p>Goal: ${lead.goal || ''} ? Platforms: ${(lead.platforms || []).join(', ')}</p>
        <p>Locations: ${lead.locations_count || '?'} ? Weekly volume: ${lead.weekly_volume || '?'}</p>
        <p>Urgency: ${lead.urgency || ''} ? Callback: ${lead.callback_window || ''}</p>
      </div>

      <div class="lead-detail-section">
        <h4>Transcript</h4>
        <div class="lead-transcript">${transcriptHtml}</div>
      </div>

      <div class="lead-detail-section">
        <h4>Send message</h4>
        <label>Template key
          <select id="message-template">
            ${templateKeys.map((key) => `<option value="${key}">${key}</option>`).join('')}
          </select>
        </label>
        <div class="admin-actions">
          <button class="btn btn-outline" id="send-sms">Send SMS</button>
          <button class="btn btn-outline" id="send-email">Send Email</button>
          <button class="btn btn-primary" id="send-both">Send both</button>
        </div>
        <div class="message-list">${messagesHtml}</div>
      </div>

      <div class="lead-detail-section">
        <h4>Notes</h4>
        <textarea id="note-body" rows="3" placeholder="Add a note"></textarea>
        <button class="btn btn-outline" id="save-note">Add note</button>
        <div class="audit-list">${notesHtml}</div>
      </div>

      <div class="lead-detail-section">
        <h4>Event log</h4>
        <div class="audit-list">${eventsHtml}</div>
      </div>
    </div>
  `;

  elements.leadDetail.querySelector('#save-lead').addEventListener('click', saveLead);
  elements.leadDetail.querySelector('#save-note').addEventListener('click', saveNote);
  elements.leadDetail.querySelector('#send-sms').addEventListener('click', () => sendMessage(['sms']));
  elements.leadDetail.querySelector('#send-email').addEventListener('click', () => sendMessage(['email']));
  elements.leadDetail.querySelector('#send-both').addEventListener('click', () => sendMessage(['sms', 'email']));
}

async function saveLead() {
  const stage = elements.leadDetail.querySelector('#lead-stage').value;
  const tags = elements.leadDetail.querySelector('#lead-tags').value;
  const response = await apiFetch(`/api/admin/lead?id=${encodeURIComponent(state.selectedLead.lead.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, tags })
  });
  if (response.ok) {
    await loadLeads();
    await loadLead(state.selectedLead.lead.id);
  }
}

async function saveNote() {
  const note = elements.leadDetail.querySelector('#note-body').value;
  if (!note.trim()) {
    return;
  }
  const response = await apiFetch(`/api/admin/lead?id=${encodeURIComponent(state.selectedLead.lead.id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'note', note })
  });
  if (response.ok) {
    await loadLead(state.selectedLead.lead.id);
  }
}

async function sendMessage(channels) {
  const templateKey = elements.leadDetail.querySelector('#message-template').value;
  const response = await apiFetch('/api/admin/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead_id: state.selectedLead.lead.id,
      template_key: templateKey,
      channels
    })
  });
  if (response.ok) {
    await loadLead(state.selectedLead.lead.id);
  }
}

async function loadTemplates() {
  const response = await apiFetch('/api/admin/templates');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  state.templates = data.templates || [];
  renderTemplates();
}

function renderTemplates() {
  if (!state.templates.length) {
    elements.templateList.innerHTML = '<div>No templates yet.</div>';
    return;
  }
  elements.templateList.innerHTML = state.templates.map((template) => {
    return `
      <div class="template-item">
        <div class="badge">${template.template_key} ? v${template.version} ? ${template.channel.toUpperCase()}</div>
        <strong>${template.name}</strong>
        <div>${template.active ? 'Active' : 'Inactive'}</div>
        <button class="btn btn-outline" data-template-id="${template.id}">Set active</button>
      </div>
    `;
  }).join('');

  elements.templateList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.templateId;
      await apiFetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', template_id: id })
      });
      await loadTemplates();
    });
  });
}

async function loadAudit() {
  const response = await apiFetch('/api/admin/audit');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  elements.auditList.innerHTML = (data.logs || []).map((log) => {
    return `<div class="audit-item"><strong>${log.action}</strong> ? ${log.actor_email || 'system'} ? ${new Date(log.created_at).toLocaleString()}</div>`;
  }).join('') || '<div>No audit activity yet.</div>';
}

function renderAnalytics(data) {
  if (!data) {
    elements.analyticsTotals.innerHTML = '<div>No data.</div>';
    elements.analyticsCta.innerHTML = '<div>No data.</div>';
    return;
  }

  if (elements.analyticsDays) {
    elements.analyticsDays.textContent = String(data.days || 14);
  }

  const totals = Array.isArray(data.totals) ? data.totals : [];
  const leadsCreated = Number(data.leads_created || 0);

  const totalsHtml = [
    `<div class="audit-item"><strong>Leads created</strong> ? ${leadsCreated}</div>`,
    ...totals.map((row) => {
      const name = String(row.event_type || 'unknown').replace(/^anon_/, '');
      return `<div class="audit-item"><strong>${name}</strong> ? ${row.count}</div>`;
    })
  ].join('');

  const ctaRows = Array.isArray(data.cta_clicks) ? data.cta_clicks : [];
  const ctaHtml = ctaRows.map((row) => {
    return `<div class="audit-item"><strong>${row.label}</strong> ? ${row.count}</div>`;
  }).join('') || '<div>No CTA clicks recorded.</div>';

  elements.analyticsTotals.innerHTML = totalsHtml || '<div>No events recorded.</div>';
  elements.analyticsCta.innerHTML = ctaHtml;
}

async function loadAnalytics() {
  const days = elements.analyticsRange ? elements.analyticsRange.value : '14';
  const response = await apiFetch(`/api/admin/analytics?days=${encodeURIComponent(days)}`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  renderAnalytics(data);
}

async function handleTemplateSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    template_key: form.template_key.value.trim(),
    name: form.name.value.trim(),
    channel: form.channel.value,
    subject: form.subject.value.trim(),
    body: form.body.value.trim(),
    active: form.active.checked
  };

  const response = await apiFetch('/api/admin/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    form.reset();
    await loadTemplates();
  }
}

function initTabs() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  });
}

function initIdentity() {
  if (!window.netlifyIdentity) {
    return;
  }

  netlifyIdentity.init({ allowSignup: false });

  netlifyIdentity.on('login', async (user) => {
    state.token = user.token.access_token;
    state.user = user;
    await loadWhoami();
    await loadLeads();
    await loadAnalytics();
    await loadTemplates();
    await loadAudit();
    netlifyIdentity.close();
  });

  netlifyIdentity.on('logout', () => {
    state.token = null;
    state.user = null;
    showAuth();
  });

  const currentUser = netlifyIdentity.currentUser();
  if (currentUser) {
    state.token = currentUser.token.access_token;
    state.user = currentUser;
    loadWhoami().then(async (data) => {
      if (data) {
        await loadLeads();
        await loadAnalytics();
        await loadTemplates();
        await loadAudit();
      }
    });
  } else {
    showAuth();
  }
}

function bindEvents() {
  elements.login.addEventListener('click', () => netlifyIdentity.open());
  elements.logout.addEventListener('click', () => netlifyIdentity.logout());
  elements.refreshLeads.addEventListener('click', loadLeads);
  elements.refreshTemplates.addEventListener('click', loadTemplates);
  elements.refreshAudit.addEventListener('click', loadAudit);
  if (elements.refreshAnalytics) {
    elements.refreshAnalytics.addEventListener('click', loadAnalytics);
  }
  if (elements.analyticsRange) {
    elements.analyticsRange.addEventListener('change', loadAnalytics);
  }
  elements.templateForm.addEventListener('submit', handleTemplateSubmit);
}

function init() {
  initTabs();
  bindEvents();
  initIdentity();
}

init();
