import { copy as text } from './copy.mjs';
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
    ? text('faultConsole', 'invoke_restmethod_method_post_uri_contenttype_application_json_body', { url: url, body: json })
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
  for (const [name, title] of [['inventory', text('faultConsole', 'inventory')], ['shipping', text('faultConsole', 'shipping')]]) {
    const proxy = state[name];
    const card = element('article');
    card.className = 'status-card';
    card.append(element('h3', title));
    const status = element('span', proxy.enabled ? text('faultConsole', 'connected') : text('faultConsole', 'disconnected'));
    status.className = `badge${proxy.enabled ? '' : ' off'}`;
    card.append(status);
    if (!proxy.toxics.length) card.append(element('p', text('faultConsole', 'no_active_faults')));
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
  if (!response.ok) throw new Error(body.error ?? text('faultConsole', 'request_failed', { status: response.status }));
  return body;
}

async function refresh() {
  try {
    const state = await readResponse(await fetch('/api/state', { cache: 'no-store' }));
    renderState(state);
    message.className = 'message';
    message.textContent = text('faultConsole', 'showing_current_toxiproxy_state');
  } catch (error) {
    stateNode.textContent = text('faultConsole', 'current_state_is_unavailable');
    message.className = 'message error';
    message.textContent = error.message;
  }
}

async function perform(action) {
  const proxy = document.querySelector('#proxy').value;
  const latencyMs = Number(document.querySelector('#latency').value);
  if (action === 'set-latency' && (!Number.isInteger(latencyMs) || latencyMs < 50 || latencyMs > 5000)) {
    message.className = 'message error';
    message.textContent = text('faultConsole', 'choose_a_whole_number_delay_from_50_to_5000');
    return;
  }
  if (action === 'reset' && !window.confirm(text('faultConsole', 'restore_both_proxy_paths_and_remove_every_active_toxiproxy'))) return;
  actionButtons.forEach(button => { button.disabled = true; });
  message.className = 'message';
  message.textContent = text('faultConsole', 'sending_change_to_toxiproxy');
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
    message.textContent = text('faultConsole', 'change_applied_open_info_commands_to_inspect_it', { method: method, path: path });
  } catch (error) {
    message.className = 'message error';
    message.textContent = error.message;
    await refresh();
    message.className = 'message error';
    message.textContent = text('faultConsole', 'refresh_the_state_before_trying_again', { error: error.message });
  } finally {
    actionButtons.forEach(button => { button.disabled = false; });
  }
}

function renderMitigations(settings) {
  for (const name of ['inventory', 'shipping']) {
    const policy = settings[name];
    document.querySelector(`#${name}-timeout`).value = policy.timeoutMs;
    document.querySelector(`#${name}-fallback`).checked = policy.fallback;
    document.querySelector(`#${name}-current`).textContent = text('faultConsole', 'active_ms_timeout_fallback', { timeout: policy.timeoutMs, fallback: policy.fallback ? text('faultConsole', 'on') : text('faultConsole', 'off') });
  }
}

async function refreshMitigations() {
  mitigationBusy = true;
  mitigationInputs.forEach(input => { input.disabled = true; });
  mitigationMessage.className = 'message';
  mitigationMessage.textContent = text('faultConsole', 'reading_active_storefront_settings');
  try {
    renderMitigations(await readResponse(await fetch('/api/mitigations', { cache: 'no-store' })));
    mitigationInputs.forEach(input => { input.disabled = false; });
    mitigationMessage.textContent = text('faultConsole', 'showing_active_settings_edit_and_apply_a_dependency_or');
  } catch (error) {
    for (const name of ['inventory', 'shipping']) document.querySelector(`#${name}-current`).textContent = text('faultConsole', 'active_settings_unavailable');
    document.querySelector('#refresh-mitigations').disabled = false;
    mitigationMessage.className = 'message error';
    mitigationMessage.textContent = text('faultConsole', 'refresh_settings_to_try_again', { error: error.message });
  } finally { mitigationBusy = false; }
}

async function applyMitigation(input) {
  if (mitigationBusy) return;
  if (input.action === 'configure' && (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 50 || input.timeoutMs > 5000)) {
    mitigationMessage.className = 'message error';
    mitigationMessage.textContent = text('faultConsole', 'choose_a_whole_number_timeout_from_50_to_5000');
    return;
  }
  mitigationBusy = true;
  mitigationInputs.forEach(control => { control.disabled = true; });
  mitigationMessage.className = 'message';
  mitigationMessage.textContent = text('faultConsole', 'applying_settings_to_storefront');
  try {
    const settings = await readResponse(await fetch('/api/mitigations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    }));
    renderMitigations(settings);
    mitigationInputs.forEach(control => { control.disabled = false; });
    lastRequest = { path: '/api/mitigations', body: input };
    commandNode.textContent = text('faultConsole', 'post_api_mitigations_content_type_application_json', { body: JSON.stringify(input, null, 2) });
    renderPlatformCommand();
    mitigationMessage.textContent = input.action === 'reset'
      ? text('faultConsole', 'defaults_restored_both_timeouts_are_3000_ms_and_both')
      : text('faultConsole', 'settings_applied', { dependency: input.dependency === 'inventory' ? text('faultConsole', 'inventory') : text('faultConsole', 'shipping') });
  } catch (error) {
    document.querySelector('#refresh-mitigations').disabled = false;
    mitigationMessage.className = 'message error';
    mitigationMessage.textContent = text('faultConsole', 'refresh_settings_to_check_the_active_state_before_trying', { error: error.message });
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
