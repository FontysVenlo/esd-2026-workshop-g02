import { InlineText } from './shared/inline-text.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import page from '../content/network-faults.json' with { type: 'json' };
import { format } from '/copy.mjs';

const { faultConsole, faultConsolePage } = page;

async function request(path, body) {
  const response = await fetch(path, {
    cache: 'no-store',
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? format(faultConsole.request_failed, { status: response.status }));
  return data;
}
function FaultState({ state }) {
  if (!state) return <p>{faultConsole.current_state_is_unavailable}</p>;
  return (
    <div id="state" className="status-grid">
      {['inventory', 'shipping'].map((name) => (
        <article className="status-card" key={name}>
          <h3>{name === 'inventory' ? faultConsolePage.inventory : faultConsolePage.shipping}</h3>
          <span className={`badge${state[name].enabled ? '' : ' off'}`}>
            {state[name].enabled ? faultConsole.connected : faultConsole.disconnected}
          </span>
          {!state[name].toxics.length ? (
            <p>{faultConsole.no_active_faults}</p>
          ) : (
            <ul className="faults">
              {state[name].toxics.map((toxic) => (
                <li key={toxic.name}>
                  {format(faultConsole.toxic_detail, {
                    name: toxic.name,
                    type: toxic.type,
                    stream: toxic.stream,
                    delay:
                      toxic.type === 'latency'
                        ? format(faultConsole.latency_detail, {
                            milliseconds: toxic.attributes?.latency ?? faultConsole.unknown_value,
                          })
                        : '',
                  })}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
function Console() {
  const hashTab = () =>
    ['mitigations', 'info'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'controls';
  const [tab, setTab] = useState(hashTab);
  const tabs = useRef({});
  const [faults, setFaults] = useState(null),
    [proxy, setProxy] = useState('inventory'),
    [latency, setLatency] = useState('1500');
  const [busy, setBusy] = useState(false),
    [mitigationBusy, setMitigationBusy] = useState(false);
  const faultLock = useRef(false),
    mitigationLock = useRef(false);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState({
    inventory: { timeoutMs: 3000, fallback: false },
    shipping: { timeoutMs: 3000, fallback: false },
  });
  const [message, setMessage] = useState({ text: '' }),
    [mitigationMessage, setMitigationMessage] = useState({ text: '' });
  const [lastRequest, setLastRequest] = useState(null),
    [command, setCommand] = useState(''),
    [platform, setPlatform] = useState('windows');
  function selectTab(value) {
    setTab(value);
    history.replaceState(null, '', `${location.pathname}${location.search}#${value}`);
  }
  function moveTab(event, current) {
    const names = ['controls', 'mitigations', 'info'],
      index = names.indexOf(current);
    const next =
      event.key === 'ArrowRight'
        ? names[(index + 1) % 3]
        : event.key === 'ArrowLeft'
          ? names[(index + 2) % 3]
          : event.key === 'Home'
            ? names[0]
            : event.key === 'End'
              ? names[2]
              : null;
    if (next) {
      event.preventDefault();
      selectTab(next);
      tabs.current[next]?.focus();
    }
  }
  useEffect(() => {
    const change = () => setTab(hashTab());
    window.addEventListener('hashchange', change);
    refresh();
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (tab === 'mitigations') refreshMitigations();
  }, [tab]);
  // Other tabs change this state too (the workshop resets it when a new
  // challenge opens), so re-read it whenever this tab is visible.
  const view = useRef({});
  view.current = { active, draft };
  useEffect(() => {
    async function sync() {
      if (document.hidden) return;
      if (!faultLock.current) {
        try {
          setFaults(await request('/api/state'));
        } catch {}
      }
      if (mitigationLock.current) return;
      try {
        const settings = await request('/api/mitigations'),
          { active: previous, draft: edits } = view.current;
        setActive(settings);
        if (!previous || JSON.stringify(edits) === JSON.stringify(previous)) setDraft(settings);
      } catch {}
    }
    const timer = setInterval(sync, 3000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  async function refresh() {
    if (faultLock.current) return;
    faultLock.current = true;
    setBusy(true);
    try {
      setFaults(await request('/api/state'));
      setMessage({ text: faultConsole.showing_current_toxiproxy_state });
    } catch (error) {
      setMessage({ text: error.message, error: true });
    } finally {
      faultLock.current = false;
      setBusy(false);
    }
  }
  async function perform(action) {
    if (faultLock.current) return;
    const latencyMs = Number(latency);
    if (
      action === 'set-latency' &&
      (!Number.isInteger(latencyMs) || latencyMs < 50 || latencyMs > 5000)
    ) {
      setMessage({ text: faultConsole.choose_a_whole_number_delay_from_50_to_5000, error: true });
      return;
    }
    if (
      action === 'reset' &&
      !window.confirm(faultConsole.restore_both_proxy_paths_and_remove_every_active_toxiproxy)
    )
      return;
    faultLock.current = true;
    setBusy(true);
    setMessage({ text: faultConsole.sending_change_to_toxiproxy });
    try {
      const body = { action, proxy, latencyMs },
        result = await request('/api/action', body);
      setFaults(result.state);
      setLastRequest({ path: '/api/action', body });
      setCommand(
        format(result.command.body ? faultConsole.request_with_body : faultConsole.request_line, {
          method: result.command.method,
          path: result.command.path,
          body: JSON.stringify(result.command.body, null, 2),
        }),
      );
      setMessage({
        text: format(faultConsole.change_applied_open_info_commands_to_inspect_it, {
          method: result.command.method,
          tab: faultConsolePage.info_commands,
          path: result.command.path,
        }),
      });
    } catch (error) {
      setMessage({
        text: format(faultConsole.refresh_the_state_before_trying_again, { error: error.message }),
        error: true,
      });
    } finally {
      faultLock.current = false;
      setBusy(false);
    }
  }
  function edit(name, key, value) {
    setDraft((previous) => ({ ...previous, [name]: { ...previous[name], [key]: value } }));
  }
  async function refreshMitigations() {
    if (mitigationLock.current) return;
    mitigationLock.current = true;
    setMitigationBusy(true);
    setMitigationMessage({ text: faultConsole.reading_active_storefront_settings });
    try {
      const settings = await request('/api/mitigations');
      setActive(settings);
      setDraft(settings);
      setMitigationMessage({
        text: faultConsole.showing_active_settings_edit_and_apply_a_dependency_or,
      });
    } catch (error) {
      setMitigationMessage({
        text: format(faultConsole.refresh_settings_to_try_again, { error: error.message }),
        error: true,
      });
    } finally {
      mitigationLock.current = false;
      setMitigationBusy(false);
    }
  }
  async function applyMitigation(input) {
    if (mitigationLock.current) return;
    if (
      input.action === 'configure' &&
      (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 50 || input.timeoutMs > 5000)
    ) {
      setMitigationMessage({
        text: faultConsole.choose_a_whole_number_timeout_from_50_to_5000,
        error: true,
      });
      return;
    }
    mitigationLock.current = true;
    setMitigationBusy(true);
    setMitigationMessage({ text: faultConsole.applying_settings_to_storefront });
    try {
      const settings = await request('/api/mitigations', input);
      setActive(settings);
      setDraft(settings);
      setLastRequest({ path: '/api/mitigations', body: input });
      setCommand(
        format(faultConsole.post_api_mitigations_content_type_application_json, {
          body: JSON.stringify(input, null, 2),
        }),
      );
      setMitigationMessage({
        text:
          input.action === 'reset'
            ? faultConsole.defaults_restored_both_timeouts_are_3000_ms_and_both
            : format(faultConsole.settings_applied, {
                dependency:
                  input.dependency === 'inventory' ? faultConsole.inventory : faultConsole.shipping,
              }),
      });
    } catch (error) {
      setMitigationMessage({
        text: format(faultConsole.refresh_settings_to_check_the_active_state_before_trying, {
          error: error.message,
        }),
        error: true,
      });
    } finally {
      mitigationLock.current = false;
      setMitigationBusy(false);
    }
  }
  const platformCommand = !lastRequest
    ? faultConsolePage.apply_a_fault_or_mitigation_to_see_the_equivalent
    : platform === 'windows'
      ? format(faultConsole.invoke_restmethod_method_post_uri_contenttype_application_json_body, {
          url: `${location.origin}${lastRequest.path}`,
          body: JSON.stringify(lastRequest.body),
        })
      : format(faultConsole.curl_command, {
          url: location.origin + lastRequest.path,
          body: JSON.stringify(lastRequest.body),
        });
  return (
    <>
      <header>
        <div className="header-inner">
          <a className="brand" href="http://localhost:8088/">
            {faultConsolePage.northstar_supply_network_faults}
          </a>
          <nav className="links">
            <a href="http://localhost:8088/">{faultConsolePage.workshop_overview}</a>
            <a
              href="http://localhost:3008/d/field-workshop/field-workshop"
              target="_blank"
              rel="noopener"
            >
              {faultConsolePage.grafana}
            </a>
          </nav>
        </div>
      </header>
      <main>
        <div className="intro">
          <div className="eyebrow">{faultConsolePage.operator_tool}</div>
          <h1>{faultConsolePage.network_faults_fallbacks}</h1>
          <p>{faultConsolePage.create_a_dependency_problem_in_the_first_tab_then}</p>
        </div>
        <div
          className="tabs"
          role="tablist"
          aria-label={faultConsolePage.network_fault_console_views}
        >
          <button
            id="controls-tab"
            ref={(node) => {
              tabs.current['controls'] = node;
            }}
            className="tab"
            role="tab"
            aria-selected={tab === 'controls'}
            aria-controls="controls-panel"
            tabIndex={tab === 'controls' ? 0 : -1}
            type="button"
            onClick={() => selectTab('controls')}
            onKeyDown={(event) => moveTab(event, 'controls')}
          >
            {faultConsolePage.fault_injection}
          </button>
          <button
            id="mitigations-tab"
            ref={(node) => {
              tabs.current['mitigations'] = node;
            }}
            className="tab"
            role="tab"
            aria-selected={tab === 'mitigations'}
            aria-controls="mitigations-panel"
            tabIndex={tab === 'mitigations' ? 0 : -1}
            type="button"
            onClick={() => selectTab('mitigations')}
            onKeyDown={(event) => moveTab(event, 'mitigations')}
          >
            {faultConsolePage.fallbacks_timeouts}
          </button>
          <button
            id="info-tab"
            ref={(node) => {
              tabs.current['info'] = node;
            }}
            className="tab"
            role="tab"
            aria-selected={tab === 'info'}
            aria-controls="info-panel"
            tabIndex={tab === 'info' ? 0 : -1}
            type="button"
            onClick={() => selectTab('info')}
            onKeyDown={(event) => moveTab(event, 'info')}
          >
            {faultConsolePage.info_commands}
          </button>
        </div>
        <section
          id="controls-panel"
          className="panel"
          role="tabpanel"
          aria-labelledby="controls-tab"
          hidden={tab !== 'controls'}
        >
          <h2>{faultConsolePage.current_state}</h2>
          <button
            onClick={refresh}
            disabled={busy}
            id="refresh"
            className="secondary"
            type="button"
          >
            {faultConsolePage.refresh}
          </button>
          <FaultState state={faults} />
          <h2>{faultConsolePage.apply_a_fault}</h2>
          <div className="controls">
            <label>
              {faultConsolePage.dependency}
              <select id="proxy" value={proxy} onChange={(event) => setProxy(event.target.value)}>
                <option value="inventory">{faultConsolePage.inventory}</option>
                <option value="shipping">{faultConsolePage.shipping}</option>
              </select>
            </label>
            <label>
              {faultConsolePage.response_delay_ms}
              <input
                id="latency"
                type="number"
                min="50"
                max="5000"
                step="1"
                value={latency}
                onChange={(event) => setLatency(event.target.value)}
              />
            </label>
          </div>
          <div className="actions">
            <button
              className="action"
              type="button"
              data-action="set-latency"
              disabled={busy}
              onClick={() => perform('set-latency')}
            >
              {faultConsolePage.apply_delay}
            </button>
            <button
              className="action secondary"
              type="button"
              data-action="remove-latency"
              disabled={busy}
              onClick={() => perform('remove-latency')}
            >
              {faultConsolePage.remove_delay}
            </button>
            <button
              className="action danger"
              type="button"
              data-action="disconnect"
              disabled={busy}
              onClick={() => perform('disconnect')}
            >
              {faultConsolePage.disconnect}
            </button>
            <button
              className="action secondary"
              type="button"
              data-action="reconnect"
              disabled={busy}
              onClick={() => perform('reconnect')}
            >
              {faultConsolePage.reconnect}
            </button>
          </div>
          <button
            disabled={busy}
            onClick={() => perform('reset')}
            id="reset-faults"
            className="secondary"
            type="button"
          >
            {faultConsolePage.clear_all_faults}
          </button>
          <p className="meta">
            {faultConsolePage.clears_toxiproxy_faults_only_notes_metrics_and_mitigation_settings}
          </p>
          <p id="message" className={`message ${message.error ? 'error' : ''}`} role="status">
            {message.text}
          </p>
        </section>
        <section
          id="mitigations-panel"
          className="panel"
          role="tabpanel"
          aria-labelledby="mitigations-tab"
          hidden={tab !== 'mitigations'}
        >
          <h2>{faultConsolePage.change_the_shop_s_response}</h2>
          <p>
            <InlineText text={faultConsolePage.mitigation_overview} />
          </p>
          <p>{faultConsolePage.changes_apply_to_new_customer_requests_immediately_you_do}</p>
          <button
            disabled={mitigationBusy}
            onClick={refreshMitigations}
            id="refresh-mitigations"
            className="secondary"
            type="button"
          >
            {faultConsolePage.refresh_settings}
          </button>
          <div className="mitigation-controls">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyMitigation({
                  action: 'configure',
                  dependency: 'inventory',
                  timeoutMs: Number(draft.inventory.timeoutMs),
                  fallback: draft.inventory.fallback,
                });
              }}
              id="inventory-settings"
              className="status-card"
            >
              <h3>{faultConsolePage.inventory_stock_checks}</h3>
              <p>
                <InlineText text={faultConsolePage.inventory_fallback_behavior} />
              </p>
              <p id="inventory-current" className="meta" role="status">
                {active
                  ? format(faultConsole.active_ms_timeout_fallback, {
                      timeout: active.inventory.timeoutMs,
                      fallback: active.inventory.fallback ? faultConsole.on : faultConsole.off,
                    })
                  : faultConsole.active_settings_unavailable}
              </p>
              <label htmlFor="inventory-timeout">{faultConsolePage.inventory_timeout_ms}</label>
              <input
                id="inventory-timeout"
                value={draft.inventory.timeoutMs}
                onChange={(event) => edit('inventory', 'timeoutMs', event.target.value)}
                type="number"
                min="50"
                max="5000"
                step="1"
                required
                disabled={mitigationBusy || !active}
              />
              <label className="checkbox-label">
                <input
                  id="inventory-fallback"
                  checked={draft.inventory.fallback}
                  onChange={(event) => edit('inventory', 'fallback', event.target.checked)}
                  type="checkbox"
                  disabled={mitigationBusy || !active}
                />{' '}
                {faultConsolePage.enable_inventory_fallback}
              </label>
              <div className="actions">
                <button className="primary" type="submit" disabled={mitigationBusy || !active}>
                  {faultConsolePage.apply_inventory_settings}
                </button>
                <button
                  onClick={() =>
                    applyMitigation({
                      action: 'configure',
                      dependency: 'inventory',
                      timeoutMs: 400,
                      fallback: true,
                    })
                  }
                  id="inventory-preset"
                  className="secondary"
                  type="button"
                  disabled={mitigationBusy || !active}
                >
                  {faultConsolePage.use_challenge_1_settings}
                </button>
              </div>
              <p className="meta">
                {faultConsolePage.challenge_1_uses_a_400_ms_timeout_with_fallback}
              </p>
            </form>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyMitigation({
                  action: 'configure',
                  dependency: 'shipping',
                  timeoutMs: Number(draft.shipping.timeoutMs),
                  fallback: draft.shipping.fallback,
                });
              }}
              id="shipping-settings"
              className="status-card"
            >
              <h3>{faultConsolePage.shipping_delivery_quotes}</h3>
              <p>
                <InlineText text={faultConsolePage.shipping_fallback_behavior} />
              </p>
              <p id="shipping-current" className="meta" role="status">
                {active
                  ? format(faultConsole.active_ms_timeout_fallback, {
                      timeout: active.shipping.timeoutMs,
                      fallback: active.shipping.fallback ? faultConsole.on : faultConsole.off,
                    })
                  : faultConsole.active_settings_unavailable}
              </p>
              <label htmlFor="shipping-timeout">{faultConsolePage.shipping_timeout_ms}</label>
              <input
                id="shipping-timeout"
                value={draft.shipping.timeoutMs}
                onChange={(event) => edit('shipping', 'timeoutMs', event.target.value)}
                type="number"
                min="50"
                max="5000"
                step="1"
                required
                disabled={mitigationBusy || !active}
              />
              <label className="checkbox-label">
                <input
                  id="shipping-fallback"
                  checked={draft.shipping.fallback}
                  onChange={(event) => edit('shipping', 'fallback', event.target.checked)}
                  type="checkbox"
                  disabled={mitigationBusy || !active}
                />{' '}
                {faultConsolePage.enable_shipping_fallback}
              </label>
              <div className="actions">
                <button className="primary" type="submit" disabled={mitigationBusy || !active}>
                  {faultConsolePage.apply_shipping_settings}
                </button>
              </div>
            </form>
          </div>
          <button
            onClick={() => applyMitigation({ action: 'reset' })}
            id="reset-mitigations"
            className="secondary"
            type="button"
            disabled={mitigationBusy || !active}
          >
            {faultConsolePage.restore_default_settings}
          </button>
          <p className="meta">
            {faultConsolePage.restores_both_timeouts_to_3000_ms_and_turns_both}
          </p>
          <p
            id="mitigation-message"
            className={`message ${mitigationMessage.error ? 'error' : ''}`}
            role="status"
          >
            {mitigationMessage.text}
          </p>
        </section>
        <section
          id="info-panel"
          className="panel"
          role="tabpanel"
          aria-labelledby="info-tab"
          hidden={tab !== 'info'}
        >
          <h2>{faultConsolePage.underlying_api_commands}</h2>
          <p>{faultConsolePage.info_tab_for_your_info}</p>
          <p>{faultConsolePage.these_controls_send_http_requests_to_toxiproxy_the_storefront}</p>
          <ul>
            <li>
              <InlineText text={faultConsolePage.apply_delay_help} />
            </li>
            <li>
              <InlineText text={faultConsolePage.remove_delay_help} />
            </li>
            <li>
              <InlineText text={faultConsolePage.disconnect_reconnect_help} />
            </li>
            <li>
              <InlineText text={faultConsolePage.clear_faults_help} />
            </li>
            <li>
              <InlineText text={faultConsolePage.refresh_help} />
            </li>
          </ul>
          <h3>{faultConsolePage.example_1500_ms_inventory_delay}</h3>
          <pre>{faultConsolePage.post_proxies_inventory_toxics_content_type_application_json}</pre>
          <h3>{faultConsolePage.last_command_sent}</h3>
          <pre id="last-command">{command || faultConsolePage.no_command_sent_yet}</pre>
          <h3>{faultConsolePage.optional_command_for_your_computer}</h3>
          <p>{faultConsolePage.the_browser_controls_above_work_the_same_on_both}</p>
          <label htmlFor="command-platform">{faultConsolePage.command_platform}</label>
          <select
            id="command-platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="windows">{faultConsolePage.windows_powershell}</option>
            <option value="mac">{faultConsolePage.mac_terminal}</option>
          </select>
          <pre id="platform-command">{platformCommand}</pre>
          <h3>{faultConsolePage.fallback_settings_api}</h3>
          <p>
            <InlineText text={faultConsolePage.mitigation_api_help} />
          </p>
          <p className="meta">
            <InlineText text={faultConsolePage.the_raw_api_is_at_paragraph} />
          </p>
        </section>
      </main>
    </>
  );
}
createRoot(document.getElementById('fault-console-root')).render(<Console />);
