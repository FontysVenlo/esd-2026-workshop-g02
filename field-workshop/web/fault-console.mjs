const controlsTab = document.querySelector('#controls-tab');
const infoTab = document.querySelector('#info-tab');
const mitigationsTab = document.querySelector('#mitigations-tab');
const controlsPanel = document.querySelector('#controls-panel');
const infoPanel = document.querySelector('#info-panel');
const mitigationsPanel = document.querySelector('#mitigations-panel');
const stateNode = document.querySelector('#state');
const message = document.querySelector('#message');
const commandNode = document.querySelector('#last-command');
const actionButtons = [...document.querySelectorAll('[data-action], #reset-faults')];
const mitigationMessage = document.querySelector('#mitigation-message');
const mitigationInputs = [...mitigationsPanel.querySelectorAll('input, button')];
const commandPlatform = document.querySelector('#command-platform');
let lastRequest;
let mitigationBusy = false;

const tabs = [[controlsTab, controlsPanel], [mitigationsTab, mitigationsPanel], [infoTab, infoPanel]];
function showTab(selected) {
  for (const [tab, panel] of tabs) {
    tab.setAttribute('aria-selected', String(tab === selected));
    tab.tabIndex = tab === selected ? 0 : -1;
    panel.hidden = tab !== selected;
  }
  history.replaceState(null, '', `${location.pathname}${location.search}#${selected === mitigationsTab ? 'mitigations' : selected === infoTab ? 'info' : 'controls'}`);
  if (selected === mitigationsTab && !mitigationBusy) refreshMitigations();
}
tabs.forEach(([tab], index) => {
  tab.addEventListener('click', () => showTab(tab));
  tab.addEventListener('keydown', event => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    showTab(tabs[next][0]);
    tabs[next][0].focus();
  });
});

function renderPlatformCommand() {
  if (!lastRequest) return;
  const url = `http://localhost:8089${lastRequest.path}`;
  const json = JSON.stringify(lastRequest.body);
  document.querySelector('#platform-command').textContent = commandPlatform.value === 'windows'
    ? `Invoke-RestMethod -Method Post -Uri '${url}' -ContentType 'application/json' -Body '${json}'`
    : `curl -f -sS -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  --data '${json}'`;
}
commandPlatform.addEventListener('change', renderPlatformCommand);

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
    lastRequest = { path: '/api/action', body: { action, proxy, latencyMs } };
    renderPlatformCommand();
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

function renderMitigations(settings) {
  for (const name of ['inventory', 'shipping']) {
    const policy = settings[name];
    document.querySelector(`#${name}-timeout`).value = policy.timeoutMs;
    document.querySelector(`#${name}-fallback`).checked = policy.fallback;
    document.querySelector(`#${name}-current`).textContent = `Active: ${policy.timeoutMs} ms timeout · fallback ${policy.fallback ? 'on' : 'off'}`;
  }
}

async function refreshMitigations() {
  mitigationBusy = true;
  mitigationInputs.forEach(input => { input.disabled = true; });
  mitigationMessage.className = 'message';
  mitigationMessage.textContent = 'Reading active Storefront settings…';
  try {
    renderMitigations(await readResponse(await fetch('/api/mitigations', { cache: 'no-store' })));
    mitigationInputs.forEach(input => { input.disabled = false; });
    mitigationMessage.textContent = 'Showing active settings. Edit and apply a dependency, or use its challenge preset.';
  } catch (error) {
    for (const name of ['inventory', 'shipping']) document.querySelector(`#${name}-current`).textContent = 'Active settings unavailable.';
    document.querySelector('#refresh-mitigations').disabled = false;
    mitigationMessage.className = 'message error';
    mitigationMessage.textContent = `${error.message} Refresh settings to try again.`;
  } finally { mitigationBusy = false; }
}

async function applyMitigation(input) {
  if (mitigationBusy) return;
  if (input.action === 'configure' && (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 50 || input.timeoutMs > 5000)) {
    mitigationMessage.className = 'message error';
    mitigationMessage.textContent = 'Choose a whole-number timeout from 50 to 5000 ms.';
    return;
  }
  mitigationBusy = true;
  mitigationInputs.forEach(control => { control.disabled = true; });
  mitigationMessage.className = 'message';
  mitigationMessage.textContent = 'Applying settings to Storefront…';
  try {
    const settings = await readResponse(await fetch('/api/mitigations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    }));
    renderMitigations(settings);
    mitigationInputs.forEach(control => { control.disabled = false; });
    lastRequest = { path: '/api/mitigations', body: input };
    commandNode.textContent = `POST /api/mitigations\nContent-Type: application/json\n\n${JSON.stringify(input, null, 2)}`;
    renderPlatformCommand();
    mitigationMessage.textContent = input.action === 'reset'
      ? 'Defaults restored: both timeouts are 3000 ms and both fallbacks are off. Network faults remain unchanged.'
      : `${input.dependency === 'inventory' ? 'Inventory' : 'Shipping'} settings applied. Repeat the same customer action in Storefront; no restart is needed.`;
  } catch (error) {
    document.querySelector('#refresh-mitigations').disabled = false;
    mitigationMessage.className = 'message error';
    mitigationMessage.textContent = `${error.message} Refresh settings to check the active state before trying again.`;
  } finally { mitigationBusy = false; }
}

for (const dependency of ['inventory', 'shipping']) {
  document.querySelector(`#${dependency}-settings`).addEventListener('submit', event => {
    event.preventDefault();
    applyMitigation({
      action: 'configure', dependency,
      timeoutMs: Number(document.querySelector(`#${dependency}-timeout`).value),
      fallback: document.querySelector(`#${dependency}-fallback`).checked
    });
  });
  document.querySelector(`#${dependency}-preset`).addEventListener('click', () => applyMitigation({
    action: 'configure', dependency, timeoutMs: dependency === 'inventory' ? 400 : 3000, fallback: true
  }));
}
document.querySelector('#refresh-mitigations').addEventListener('click', refreshMitigations);
document.querySelector('#reset-mitigations').addEventListener('click', () => applyMitigation({ action: 'reset' }));

document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => perform(button.dataset.action)));
document.querySelector('#reset-faults').addEventListener('click', () => perform('reset'));
if (location.hash === '#mitigations') showTab(mitigationsTab);
else if (location.hash === '#info') showTab(infoTab);
window.addEventListener('hashchange', () => showTab(location.hash === '#mitigations' ? mitigationsTab : location.hash === '#info' ? infoTab : controlsTab));
refresh();
