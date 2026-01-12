(() => {
  const STORAGE_KEY = 'markter_chat_state';
  const OPEN_KEY = 'markter_chat_open';

  const steps = [
    {
      id: 'intro',
      type: 'quick',
      message: "Hey - I'm Sam with Markter. If you're looking for more calls or orders, I can get you set up. Mind if I ask 3 quick questions to see what fits?",
      options: [
        { label: 'Yes', value: 'yes', next: 'business_type' },
        { label: 'Not now', value: 'no', next: 'exit' }
      ]
    },
    {
      id: 'business_type',
      type: 'text',
      field: 'business_type',
      message: 'Great. What kind of business is it?'
    },
    {
      id: 'goal',
      type: 'quick',
      field: 'goal',
      message: 'Do you want more delivery orders, more pickup orders, or more phone calls?'
    },
    {
      id: 'platforms',
      type: 'quick',
      field: 'platforms',
      message: 'Which platforms matter most right now - Uber Eats, DoorDash, or both?'
    },
    {
      id: 'locations_count',
      type: 'number',
      field: 'locations_count',
      message: 'How many locations are we talking about?'
    },
    {
      id: 'weekly_volume',
      type: 'number',
      field: 'weekly_volume',
      message: 'And roughly how many weekly orders or calls are you doing right now?'
    },
    {
      id: 'urgency',
      type: 'quick',
      field: 'urgency',
      message: 'Are you looking to move quickly, or just exploring?'
    },
    {
      id: 'name',
      type: 'text',
      field: 'name',
      message: "Perfect. What's the best name to use?"
    },
    {
      id: 'phone',
      type: 'phone',
      field: 'phone',
      message: 'What is the best number to reach you?'
    },
    {
      id: 'email',
      type: 'email',
      field: 'email',
      message: 'And the best email for confirmations?'
    },
    {
      id: 'service_area',
      type: 'text',
      field: 'service_area',
      message: 'Which city or service area should we focus on?'
    },
    {
      id: 'callback_window',
      type: 'quick',
      field: 'callback_window',
      message: 'Do mornings or afternoons work better for a quick call?'
    },
    {
      id: 'consent',
      type: 'quick',
      field: 'consent_flag',
      message: 'We will confirm by text and email. Is it okay to text you about scheduling?'
    },
    {
      id: 'assurance',
      type: 'info',
      message: 'We will start you on our 10-Day Results Assurance - first month of management is free, you only cover ad spend, and there are no lock-ins during the assurance window.'
    },
    {
      id: 'confirm',
      type: 'info',
      message: 'All set. We will reach out within one business hour. If you prefer a specific time window, reply to the confirmation text.'
    }
  ];

  const quickOptions = {
    goal: [
      { label: 'Delivery orders', value: 'delivery' },
      { label: 'Pickup orders', value: 'pickup' },
      { label: 'Phone calls', value: 'calls' }
    ],
    platforms: [
      { label: 'Uber Eats', value: 'Uber Eats' },
      { label: 'DoorDash', value: 'DoorDash' },
      { label: 'Both', value: 'Both' }
    ],
    urgency: [
      { label: 'Move quickly', value: 'move quickly' },
      { label: 'Steady timeline', value: 'steady' },
      { label: 'Exploring', value: 'exploring' }
    ],
    callback_window: [
      { label: 'Morning', value: 'morning' },
      { label: 'Afternoon', value: 'afternoon' },
      { label: 'Evening', value: 'evening' }
    ],
    consent_flag: [
      { label: 'Yes, text me', value: 'yes' },
      { label: 'Email only', value: 'no' }
    ]
  };

  const state = {
    open: false,
    stepIndex: 0,
    lead: {
      name: '',
      phone: '',
      email: '',
      business_type: '',
      service_area: '',
      goal: '',
      platforms: [],
      locations_count: null,
      weekly_volume: null,
      urgency: '',
      callback_window: '',
      consent_flag: false
    },
    transcript: []
  };

  const ui = {};

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      stepIndex: state.stepIndex,
      lead: state.lead,
      transcript: state.transcript
    }));
    localStorage.setItem(OPEN_KEY, state.open ? '1' : '0');
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state.stepIndex = parsed.stepIndex ?? state.stepIndex;
        state.lead = { ...state.lead, ...(parsed.lead || {}) };
        state.transcript = parsed.transcript || [];
      } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    state.open = localStorage.getItem(OPEN_KEY) === '1';
  }

  function addMessage(role, text) {
    const message = { role, text, ts: new Date().toISOString() };
    state.transcript.push(message);

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'agent' ? 'agent' : 'visitor'}`;
    bubble.textContent = text;
    ui.messages.appendChild(bubble);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function setQuickReplies(options = []) {
    ui.quickReplies.innerHTML = '';
    if (!options.length) {
      ui.quickReplies.classList.add('is-hidden');
      return;
    }
    ui.quickReplies.classList.remove('is-hidden');
    options.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-reply';
      btn.textContent = option.label;
      btn.addEventListener('click', () => handleAnswer(option.value));
      ui.quickReplies.appendChild(btn);
    });
  }

  function setInputMode(enabled) {
    ui.input.disabled = !enabled;
    ui.send.disabled = !enabled;
    ui.inputWrapper.classList.toggle('is-hidden', !enabled);
  }

  function currentStep() {
    return steps[state.stepIndex];
  }

  function moveToNextStep() {
    state.stepIndex += 1;
    runStep();
  }

  function handleAnswer(value) {
    const step = currentStep();
    if (!step) {
      return;
    }

    let answerText = value;
    if (step.type === 'quick' && quickOptions[step.field]) {
      const found = quickOptions[step.field].find((opt) => opt.value === value);
      answerText = found ? found.label : value;
    }

    addMessage('visitor', String(answerText));

    if (step.field) {
      if (step.field === 'platforms') {
        state.lead.platforms = value === 'Both' ? ['Uber Eats', 'DoorDash'] : [value];
      } else if (step.field === 'consent_flag') {
        state.lead.consent_flag = value === 'yes';
      } else if (step.type === 'number') {
        const numeric = Number(value);
        state.lead[step.field] = Number.isNaN(numeric) ? null : numeric;
      } else {
        state.lead[step.field] = String(value).trim();
      }
    }

    saveState();

    if (step.id === 'intro' && value === 'no') {
      addMessage('agent', 'All good. If timing shifts later, we can pick this back up without pressure.');
      setQuickReplies([]);
      setInputMode(false);
      return;
    }

    moveToNextStep();
  }

  function validateInput(step, value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Please enter a response.' };
    }

    if (step.type === 'email') {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      return ok ? { valid: true } : { valid: false, error: 'Please enter a valid email.' };
    }

    if (step.type === 'phone') {
      const digits = trimmed.replace(/\D/g, '');
      return digits.length >= 10 ? { valid: true } : { valid: false, error: 'Please enter a valid phone number.' };
    }

    if (step.type === 'number') {
      const num = Number(trimmed);
      return Number.isNaN(num) ? { valid: false, error: 'Please enter a number.' } : { valid: true };
    }

    return { valid: true };
  }

  function runStep() {
    const step = currentStep();
    if (!step) {
      return;
    }

    const lastMessage = state.transcript[state.transcript.length - 1];
    const shouldPrompt = !lastMessage || lastMessage.role !== 'agent' || lastMessage.text !== step.message;
    if (shouldPrompt) {
      addMessage('agent', step.message);
    }

    if (step.id === 'goal') {
      setQuickReplies(quickOptions.goal);
      setInputMode(false);
      return;
    }

    if (step.id === 'platforms') {
      if (state.lead.goal === 'calls') {
        moveToNextStep();
        return;
      }
      setQuickReplies(quickOptions.platforms);
      setInputMode(false);
      return;
    }

    if (step.id === 'urgency') {
      setQuickReplies(quickOptions.urgency);
      setInputMode(false);
      return;
    }

    if (step.id === 'callback_window') {
      setQuickReplies(quickOptions.callback_window);
      setInputMode(false);
      return;
    }

    if (step.id === 'consent') {
      setQuickReplies(quickOptions.consent_flag);
      setInputMode(false);
      return;
    }

    if (step.type === 'info') {
      if (step.id === 'confirm') {
        submitLead();
        setQuickReplies([]);
        setInputMode(false);
      } else {
        moveToNextStep();
      }
      return;
    }

    setQuickReplies([]);
    setInputMode(true);
  }

  async function submitLead() {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      ...state.lead,
      source_page: window.location.pathname,
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_term: params.get('utm_term'),
      utm_content: params.get('utm_content'),
      gclid: params.get('gclid'),
      transcript: state.transcript,
      hp: ''
    };

    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // ignore network errors in UI
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const step = currentStep();
    if (!step) {
      return;
    }
    const value = ui.input.value;
    const validation = validateInput(step, value);
    if (!validation.valid) {
      ui.error.textContent = validation.error;
      ui.error.classList.remove('is-hidden');
      return;
    }
    ui.error.classList.add('is-hidden');
    ui.input.value = '';
    handleAnswer(value);
  }

  function renderTranscript() {
    ui.messages.innerHTML = '';
    state.transcript.forEach((item) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${item.role === 'agent' ? 'agent' : 'visitor'}`;
      bubble.textContent = item.text;
      ui.messages.appendChild(bubble);
    });
  }

  function toggleOpen(forceOpen) {
    state.open = typeof forceOpen === 'boolean' ? forceOpen : !state.open;
    ui.panel.classList.toggle('is-open', state.open);
    ui.launch.textContent = state.open ? 'Close' : 'Chat with Markter';
    if (state.open && state.transcript.length === 0) {
      runStep();
    }
    saveState();
  }

  function init() {
    loadState();

    const container = document.createElement('div');
    container.className = 'chatbot-widget';
    container.innerHTML = `
      <button class="chatbot-launch" type="button">Chat with Markter</button>
      <div class="chatbot-panel">
        <div class="chatbot-header">
          <div>
            <strong>Markter Intake</strong>
            <span>Operator-to-operator, one step at a time.</span>
          </div>
          <button class="chatbot-close" type="button" aria-label="Close">?</button>
        </div>
        <div class="chatbot-messages"></div>
        <div class="chatbot-quick-replies is-hidden"></div>
        <form class="chatbot-input">
          <div class="chatbot-error is-hidden"></div>
          <div class="chatbot-input-row">
            <input type="text" placeholder="Type your answer" />
            <button type="submit">Send</button>
          </div>
          <div class="chatbot-footer">We never sell your data. Consent required for SMS.</div>
        </form>
      </div>
    `;

    document.body.appendChild(container);

    ui.launch = container.querySelector('.chatbot-launch');
    ui.panel = container.querySelector('.chatbot-panel');
    ui.close = container.querySelector('.chatbot-close');
    ui.messages = container.querySelector('.chatbot-messages');
    ui.quickReplies = container.querySelector('.chatbot-quick-replies');
    ui.form = container.querySelector('.chatbot-input');
    ui.input = container.querySelector('input');
    ui.send = container.querySelector('button[type="submit"]');
    ui.error = container.querySelector('.chatbot-error');
    ui.inputWrapper = container.querySelector('.chatbot-input');

    ui.launch.addEventListener('click', () => toggleOpen());
    ui.close.addEventListener('click', () => toggleOpen(false));
    ui.form.addEventListener('submit', handleFormSubmit);

    renderTranscript();
    if (state.transcript.length) {
      ui.panel.classList.add('is-open');
      ui.launch.textContent = 'Close';
      runStep();
    }

    if (state.open) {
      ui.panel.classList.add('is-open');
      ui.launch.textContent = 'Close';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
