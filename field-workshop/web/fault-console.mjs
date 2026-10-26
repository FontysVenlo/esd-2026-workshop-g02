const controlsTab = document.querySelector('#controls-tab');
const infoTab = document.querySelector('#info-tab');
const controlsPanel = document.querySelector('#controls-panel');
const infoPanel = document.querySelector('#info-panel');
const stateNode = document.querySelector('#state');
const message = document.querySelector('#message');
const commandNode = document.querySelector('#last-command');
const actionButtons = [...document.querySelectorAll('[data-action], #reset-faults')];

function showTab(info) {
  controlsTab.setAttribute('aria-selected', String(!info));
  infoTab.setAttribute('aria-selected', String(info));
  controlsPanel.hidden = info;
  infoPanel.hidden = !info;
}
controlsTab.addEventListener('click', () => showTab(false));
infoTab.addEventListener('click', () => showTab(true));

function element(tag, value) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  return node;
}

function renderState(state) {
  stateNode.replaceChildren();
  for (const [name, title] of [['inventory', 'Inventory'], ['shipping', 'Shipping']]) {
    const proxy = state[name];
    const card = element('article');
    card.className = 'status-card';
    card.append(element('h3', title));
    const status = element('span', proxy.enabled ? 'Connected' : 'Disconnected');
    status.className = `badge${proxy.enabled ? '' : ' off'}`;
    card.append(status);
    if (!proxy.toxics.length) card.append(element('p', 'No active faults'));
    else {
      const list = element('ul');
      list.className = 'faults';
      for (const toxic of proxy.toxics) {
        const detail = toxic.type === 'latency' ? ` (${toxic.attributes?.latency ?? '?'} ms)` : '';
        list.append(element('li', `${toxic.name}: ${toxic.type}${detail} · ${toxic.stream}`));
      }
      card.append(list);
    }
    stateNode.append(card);
  }
}

async function readResponse(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

async function refresh() {
  try {
    const state = await readResponse(await fetch('/api/state', { cache: 'no-store' }));
    renderState(state);
    message.className = 'message';
    message.textContent = 'Showing current Toxiproxy state.';
  } catch (error) {
    stateNode.textContent = 'Current state is unavailable.';
    message.className = 'message error';
    message.textContent = error.message;
  }
}

async function perform(action) {
  const proxy = document.querySelector('#proxy').value;
  const latencyMs = Number(document.querySelector('#latency').value);
  if (action === 'set-latency' && (!Number.isInteger(latencyMs) || latencyMs < 50 || latencyMs > 5000)) {
    message.className = 'message error';
    message.textContent = 'Choose a whole-number delay from 50 to 5000 ms.';
    return;
  }
  if (action === 'reset' && !window.confirm('Restore both proxy paths and remove every active Toxiproxy fault in this local workshop?')) return;
  actionButtons.forEach(button => { button.disabled = true; });
  message.className = 'message';
  message.textContent = 'Sending change to Toxiproxy…';
  try {
    const result = await readResponse(await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, proxy, latencyMs })
    }));
    renderState(result.state);
    const { method, path, body } = result.command;
    commandNode.textContent = `${method} ${path}${body ? `\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}` : ''}`;
    message.textContent = `Change applied. ${method} ${path}. Open “Info & commands” to inspect it.`;
  } catch (error) {
    message.className = 'message error';
    message.textContent = error.message;
    await refresh();
    message.className = 'message error';
    message.textContent = `${error.message} Refresh the state before trying again.`;
  } finally {
    actionButtons.forEach(button => { button.disabled = false; });
  }
}

document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => perform(button.dataset.action)));
document.querySelector('#reset-faults').addEventListener('click', () => perform('reset'));
refresh();
