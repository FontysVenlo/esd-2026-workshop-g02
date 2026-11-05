import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { copy as text } from '/copy.mjs';

async function request(path, body) {
  const response = await fetch(path, { cache:'no-store', method:body ? 'POST' : 'GET', headers:body ? {'Content-Type':'application/json'} : undefined, body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? text('faultConsole','request_failed',{status:response.status}));
  return data;
}
function FaultState({state}) {
  if (!state) return <p>{text('faultConsole','current_state_is_unavailable')}</p>;
  return <div id="state" className="status-grid">{['inventory','shipping'].map(name => <article className="status-card" key={name}>
    <h3>{text('faultConsole',name)}</h3><span className={`badge${state[name].enabled?'':' off'}`}>{text('faultConsole',state[name].enabled?'connected':'disconnected')}</span>
    {!state[name].toxics.length?<p>{text('faultConsole','no_active_faults')}</p>:<ul className="faults">{state[name].toxics.map(toxic => <li key={toxic.name}>{toxic.name}: {toxic.type}{toxic.type==='latency'?` (${toxic.attributes?.latency ?? '?'} ms)`:''} · {toxic.stream}</li>)}</ul>}
  </article>)}</div>;
}
function Console() {
  const hashTab = () => ['mitigations','info'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'controls';
  const [tab,setTab] = useState(hashTab);
  const tabs=useRef({});
  const [faults,setFaults]=useState(null), [proxy,setProxy]=useState('inventory'), [latency,setLatency]=useState('1500');
  const [busy,setBusy]=useState(false), [mitigationBusy,setMitigationBusy]=useState(false);
  const faultLock=useRef(false), mitigationLock=useRef(false);
  const [active,setActive]=useState(null);
  const [draft,setDraft]=useState({inventory:{timeoutMs:3000,fallback:false},shipping:{timeoutMs:3000,fallback:false}});
  const [message,setMessage]=useState({text:''}), [mitigationMessage,setMitigationMessage]=useState({text:''});
  const [lastRequest,setLastRequest]=useState(null), [command,setCommand]=useState(''), [platform,setPlatform]=useState('windows');
  function selectTab(value) { setTab(value);history.replaceState(null,'',`${location.pathname}${location.search}#${value}`); }
  function moveTab(event,current) {
    const names=['controls','mitigations','info'],index=names.indexOf(current);
    const next=event.key==='ArrowRight'?names[(index+1)%3]:event.key==='ArrowLeft'?names[(index+2)%3]:event.key==='Home'?names[0]:event.key==='End'?names[2]:null;
    if(next) {event.preventDefault();selectTab(next);tabs.current[next]?.focus();}
  }
  useEffect(()=>{const change=()=>setTab(hashTab());window.addEventListener('hashchange',change);refresh();return()=>window.removeEventListener('hashchange',change);},[]);
  useEffect(()=>{if(tab==='mitigations')refreshMitigations();},[tab]);
  async function refresh() {
    if(faultLock.current)return;
    faultLock.current=true;setBusy(true);
    try {setFaults(await request('/api/state'));setMessage({text:text('faultConsole','showing_current_toxiproxy_state')});}
    catch(error) {setMessage({text:error.message,error:true});}
    finally {faultLock.current=false;setBusy(false);}
  }
  async function perform(action) {
    if(faultLock.current)return;
    const latencyMs=Number(latency);
    if(action==='set-latency'&&(!Number.isInteger(latencyMs)||latencyMs<50||latencyMs>5000)) {setMessage({text:text('faultConsole','choose_a_whole_number_delay_from_50_to_5000'),error:true});return;}
    if(action==='reset'&&!window.confirm(text('faultConsole','restore_both_proxy_paths_and_remove_every_active_toxiproxy')))return;
    faultLock.current=true;setBusy(true);setMessage({text:text('faultConsole','sending_change_to_toxiproxy')});
    try {
      const body={action,proxy,latencyMs},result=await request('/api/action',body);
      setFaults(result.state);setLastRequest({path:'/api/action',body});
      setCommand(`${result.command.method} ${result.command.path}${result.command.body?`\nContent-Type: application/json\n\n${JSON.stringify(result.command.body,null,2)}`:''}`);
      setMessage({text:text('faultConsole','change_applied_open_info_commands_to_inspect_it',{method:result.command.method,path:result.command.path})});
    } catch(error) {setMessage({text:text('faultConsole','refresh_the_state_before_trying_again',{error:error.message}),error:true});}
    finally {faultLock.current=false;setBusy(false);}
  }
  function edit(name,key,value) {setDraft(previous=>({...previous,[name]:{...previous[name],[key]:value}}));}
  async function refreshMitigations() {
    if(mitigationLock.current)return;
    mitigationLock.current=true;setMitigationBusy(true);setMitigationMessage({text:text('faultConsole','reading_active_storefront_settings')});
    try {const settings=await request('/api/mitigations');setActive(settings);setDraft(settings);setMitigationMessage({text:text('faultConsole','showing_active_settings_edit_and_apply_a_dependency_or')});}
    catch(error) {setMitigationMessage({text:text('faultConsole','refresh_settings_to_try_again',{error:error.message}),error:true});}
    finally {mitigationLock.current=false;setMitigationBusy(false);}
  }
  async function applyMitigation(input) {
    if(mitigationLock.current)return;
    if(input.action==='configure'&&(!Number.isInteger(input.timeoutMs)||input.timeoutMs<50||input.timeoutMs>5000)){setMitigationMessage({text:text('faultConsole','choose_a_whole_number_timeout_from_50_to_5000'),error:true});return;}
    mitigationLock.current=true;setMitigationBusy(true);setMitigationMessage({text:text('faultConsole','applying_settings_to_storefront')});
    try {
      const settings=await request('/api/mitigations',input);setActive(settings);setDraft(settings);setLastRequest({path:'/api/mitigations',body:input});
      setCommand(text('faultConsole','post_api_mitigations_content_type_application_json',{body:JSON.stringify(input,null,2)}));
      setMitigationMessage({text:input.action==='reset'?text('faultConsole','defaults_restored_both_timeouts_are_3000_ms_and_both'):text('faultConsole','settings_applied',{dependency:text('faultConsole',input.dependency)})});
    }catch(error){setMitigationMessage({text:text('faultConsole','refresh_settings_to_check_the_active_state_before_trying',{error:error.message}),error:true});}
    finally{mitigationLock.current=false;setMitigationBusy(false);}
  }
  const platformCommand=!lastRequest?text('faultConsolePage','apply_a_fault_or_mitigation_to_see_the_equivalent'):platform==='windows'
    ?text('faultConsole','invoke_restmethod_method_post_uri_contenttype_application_json_body',{url:`${location.origin}${lastRequest.path}`,body:JSON.stringify(lastRequest.body)})
    :`curl -f -sS -X POST '${location.origin}${lastRequest.path}' \\\n  -H 'Content-Type: application/json' \\\n  --data '${JSON.stringify(lastRequest.body)}'`;
  return <>
  <header><div className="header-inner"><a className="brand" href="http://localhost:8088/">{text('faultConsolePage','northstar_supply_network_faults')}</a><nav className="links"><a href="http://localhost:8088/">{text('faultConsolePage','workshop_overview')}</a><a href="http://localhost:3008/d/field-workshop/field-workshop" target="_blank" rel="noopener">{text('faultConsolePage','grafana')}</a></nav></div></header>
  <main>
    <div className="intro"><div className="eyebrow">{text('faultConsolePage','operator_tool')}</div><h1>{text('faultConsolePage','network_faults_fallbacks')}</h1><p>{text('faultConsolePage','create_a_dependency_problem_in_the_first_tab_then')}</p></div>
    <div className="tabs" role="tablist" aria-label={text('faultConsolePage','network_fault_console_views')}>
      <button id="controls-tab" ref={node => { tabs.current['controls'] = node; }} className="tab" role="tab" aria-selected={tab === 'controls'} aria-controls="controls-panel" tabIndex={tab === 'controls' ? 0 : -1} type="button" onClick={() => selectTab('controls')} onKeyDown={event => moveTab(event, 'controls')}>{text('faultConsolePage','fault_injection')}</button>
      <button id="mitigations-tab" ref={node => { tabs.current['mitigations'] = node; }} className="tab" role="tab" aria-selected={tab === 'mitigations'} aria-controls="mitigations-panel" tabIndex={tab === 'mitigations' ? 0 : -1} type="button" onClick={() => selectTab('mitigations')} onKeyDown={event => moveTab(event, 'mitigations')}>{text('faultConsolePage','fallbacks_timeouts')}</button>
      <button id="info-tab" ref={node => { tabs.current['info'] = node; }} className="tab" role="tab" aria-selected={tab === 'info'} aria-controls="info-panel" tabIndex={tab === 'info' ? 0 : -1} type="button" onClick={() => selectTab('info')} onKeyDown={event => moveTab(event, 'info')}>{text('faultConsolePage','info_commands')}</button>
    </div>
    <section id="controls-panel" className="panel" role="tabpanel" aria-labelledby="controls-tab" hidden={tab !== 'controls'}>
      <h2>{text('faultConsolePage','current_state')}</h2>
      <button onClick={refresh} disabled={busy} id="refresh" className="secondary" type="button">{text('faultConsolePage','refresh')}</button>
      <FaultState state={faults} />
      <h2>{text('faultConsolePage','apply_a_fault')}</h2>
      <div className="controls">
        <label>{text('faultConsolePage','dependency')}<select id="proxy" value={proxy} onChange={event => setProxy(event.target.value)}><option value="inventory">{text('faultConsolePage','inventory')}</option><option value="shipping">{text('faultConsolePage','shipping')}</option></select></label>
        <label>{text('faultConsolePage','response_delay_ms')}<input id="latency" type="number" min="50" max="5000" step="1" value={latency} onChange={event => setLatency(event.target.value)} /></label>
      </div>
      <div className="actions">
        <button className="action" type="button" data-action="set-latency" disabled={busy} onClick={() => perform('set-latency')}>{text('faultConsolePage','apply_delay')}</button>
        <button className="action secondary" type="button" data-action="remove-latency" disabled={busy} onClick={() => perform('remove-latency')}>{text('faultConsolePage','remove_delay')}</button>
        <button className="action danger" type="button" data-action="disconnect" disabled={busy} onClick={() => perform('disconnect')}>{text('faultConsolePage','disconnect')}</button>
        <button className="action secondary" type="button" data-action="reconnect" disabled={busy} onClick={() => perform('reconnect')}>{text('faultConsolePage','reconnect')}</button>
      </div>
      <button disabled={busy} onClick={() => perform('reset')} id="reset-faults" className="secondary" type="button">{text('faultConsolePage','clear_all_faults')}</button>
      <p className="meta">{text('faultConsolePage','clears_toxiproxy_faults_only_notes_metrics_and_mitigation_settings')}</p>
      <p id="message" className={`message ${message.error ? "error" : ""}`} role="status">{message.text}</p>
    </section>
    <section id="mitigations-panel" className="panel" role="tabpanel" aria-labelledby="mitigations-tab" hidden={tab !== 'mitigations'}>
      <h2>{text('faultConsolePage','change_the_shop_s_response')}</h2>
      <p>{text('faultConsolePage','a')} <strong>{text('faultConsolePage','timeout')}</strong> {text('faultConsolePage','is_how_long_storefront_waits_for_a_dependency_a')} <strong>{text('faultConsolePage','fallback')}</strong> {text('faultConsolePage','provides_a_useful_honest_response_when_that_dependency_fails')}</p>
      <p>{text('faultConsolePage','changes_apply_to_new_customer_requests_immediately_you_do')}</p>
      <button disabled={mitigationBusy} onClick={refreshMitigations} id="refresh-mitigations" className="secondary" type="button">{text('faultConsolePage','refresh_settings')}</button>
      <div className="mitigation-controls">
        <form onSubmit={event => { event.preventDefault(); applyMitigation({action:'configure', dependency:'inventory', timeoutMs:Number(draft.inventory.timeoutMs), fallback:draft.inventory.fallback}); }} id="inventory-settings" className="status-card">
          <h3>{text('faultConsolePage','inventory_stock_checks')}</h3>
          <p>{text('faultConsolePage','with_fallback_enabled_an_unavailable_stock_check_returns')} <strong>{text('faultConsolePage','stock_unconfirmed')}</strong>{text('faultConsolePage','it_never_guesses_the_stock_quantity')}</p>
          <p id="inventory-current" className="meta" role="status">{active ? text('faultConsole','active_ms_timeout_fallback',{timeout:active.inventory.timeoutMs,fallback:text('faultConsole',active.inventory.fallback?'on':'off')}) : text('faultConsole','active_settings_unavailable')}</p>
          <label htmlFor="inventory-timeout">{text('faultConsolePage','inventory_timeout_ms')}</label>
          <input id="inventory-timeout" value={draft.inventory.timeoutMs} onChange={event => edit('inventory', 'timeoutMs', event.target.value)} type="number" min="50" max="5000" step="1" required disabled={mitigationBusy || !active} />
          <label className="checkbox-label"><input id="inventory-fallback" checked={draft.inventory.fallback} onChange={event => edit('inventory', 'fallback', event.target.checked)} type="checkbox" disabled={mitigationBusy || !active} /> {text('faultConsolePage','enable_inventory_fallback')}</label>
          <div className="actions">
            <button className="primary" type="submit" disabled={mitigationBusy || !active}>{text('faultConsolePage','apply_inventory_settings')}</button>
            <button onClick={() => applyMitigation({action:'configure',dependency:'inventory',timeoutMs:400,fallback:true})} id="inventory-preset" className="secondary" type="button" disabled={mitigationBusy || !active}>{text('faultConsolePage','use_challenge_1_settings')}</button>
          </div>
          <p className="meta">{text('faultConsolePage','challenge_1_uses_a_400_ms_timeout_with_fallback')}</p>
        </form>
        <form onSubmit={event => { event.preventDefault(); applyMitigation({action:'configure', dependency:'shipping', timeoutMs:Number(draft.shipping.timeoutMs), fallback:draft.shipping.fallback}); }} id="shipping-settings" className="status-card">
          <h3>{text('faultConsolePage','shipping_delivery_quotes')}</h3>
          <p>{text('faultConsolePage','with_fallback_enabled_the_preview_returns_available_stock_and')} <strong>{text('faultConsolePage','shipping_quote_unavailable')}</strong>{text('faultConsolePage','it_never_invents_a_price_or_delivery_date')}</p>
          <p id="shipping-current" className="meta" role="status">{active ? text('faultConsole','active_ms_timeout_fallback',{timeout:active.shipping.timeoutMs,fallback:text('faultConsole',active.shipping.fallback?'on':'off')}) : text('faultConsole','active_settings_unavailable')}</p>
          <label htmlFor="shipping-timeout">{text('faultConsolePage','shipping_timeout_ms')}</label>
          <input id="shipping-timeout" value={draft.shipping.timeoutMs} onChange={event => edit('shipping', 'timeoutMs', event.target.value)} type="number" min="50" max="5000" step="1" required disabled={mitigationBusy || !active} />
          <label className="checkbox-label"><input id="shipping-fallback" checked={draft.shipping.fallback} onChange={event => edit('shipping', 'fallback', event.target.checked)} type="checkbox" disabled={mitigationBusy || !active} /> {text('faultConsolePage','enable_shipping_fallback')}</label>
          <div className="actions">
            <button className="primary" type="submit" disabled={mitigationBusy || !active}>{text('faultConsolePage','apply_shipping_settings')}</button>
            <button onClick={() => applyMitigation({action:'configure',dependency:'shipping',timeoutMs:3000,fallback:true})} id="shipping-preset" className="secondary" type="button" disabled={mitigationBusy || !active}>{text('faultConsolePage','use_challenge_2_settings')}</button>
          </div>
          <p className="meta">{text('faultConsolePage','challenge_2_enables_fallback_with_the_default_3000_ms')}</p>
        </form>
      </div>
      <button onClick={() => applyMitigation({action:'reset'})} id="reset-mitigations" className="secondary" type="button" disabled={mitigationBusy || !active}>{text('faultConsolePage','restore_default_settings')}</button>
      <p className="meta">{text('faultConsolePage','restores_both_timeouts_to_3000_ms_and_turns_both')}</p>
      <p id="mitigation-message" className={`message ${mitigationMessage.error ? "error" : ""}`} role="status">{mitigationMessage.text}</p>
    </section>
    <section id="info-panel" className="panel" role="tabpanel" aria-labelledby="info-tab" hidden={tab !== 'info'}>
      <h2>{text('faultConsolePage','underlying_api_commands')}</h2>
      <p>{text('faultConsolePage','these_controls_send_http_requests_to_toxiproxy_the_storefront')}</p>
      <ul>
        <li><strong>{text('faultConsolePage','apply_delay_2')}</strong> <code>{text('faultConsolePage','post_proxies_toxics')}</code> {text('faultConsolePage','with_a_downstream_latency_toxic_an_existing_console_delay')} <code>{text('faultConsolePage','post_proxies_toxics_workshop_latency')}</code>{text('faultConsolePage','text')}</li>
        <li><strong>{text('faultConsolePage','remove_delay_2')}</strong> <code>{text('faultConsolePage','delete_proxies_toxics_workshop_latency')}</code>{text('faultConsolePage','text')}</li>
        <li><strong>{text('faultConsolePage','disconnect_reconnect')}</strong> <code>{text('faultConsolePage','post_proxies')}</code> {text('faultConsolePage','with')} <code>{text('faultConsolePage','text_2')}</code> {text('faultConsolePage','or')} <code>{text('faultConsolePage','text_3')}</code>{text('faultConsolePage','text')}</li>
        <li><strong>{text('faultConsolePage','clear_all_faults_2')}</strong> <code>{text('faultConsolePage','post_reset')}</code>{text('faultConsolePage','reconnects_both_paths_and_removes_all_toxics')}</li>
        <li><strong>{text('faultConsolePage','refresh_2')}</strong> <code>{text('faultConsolePage','get_proxies')}</code>{text('faultConsolePage','reads_state_without_changing_it')}</li>
      </ul>
      <h3>{text('faultConsolePage','example_1500_ms_inventory_delay')}</h3>
      <pre>{text('faultConsolePage','post_proxies_inventory_toxics_content_type_application_json')}</pre>
      <h3>{text('faultConsolePage','last_command_sent')}</h3>
      <pre id="last-command">{command || text('faultConsolePage','no_command_sent_yet')}</pre>
      <h3>{text('faultConsolePage','optional_command_for_your_computer')}</h3>
      <p>{text('faultConsolePage','the_browser_controls_above_work_the_same_on_both')}</p>
      <label htmlFor="command-platform">{text('faultConsolePage','command_platform')}</label>
      <select id="command-platform" value={platform} onChange={event => setPlatform(event.target.value)}><option value="windows">{text('faultConsolePage','windows_powershell')}</option><option value="mac">{text('faultConsolePage','mac_terminal')}</option></select>
      <pre id="platform-command">{platformCommand}</pre>
      <h3>{text('faultConsolePage','fallback_settings_api')}</h3>
      <p><code>{text('faultConsolePage','get_api_mitigations')}</code> {text('faultConsolePage','reads_current_settings')} <code>{text('faultConsolePage','post_api_mitigations')}</code> {text('faultConsolePage','applies_a_dependency_s_timeout_and_fallback_or_restores')}</p>
      <p className="meta">{text('faultConsolePage','the_raw_api_is_at')} <code>{text('faultConsolePage','http_localhost_8478')}</code>{text('faultConsolePage','text')} <a href="http://localhost:8088/tools" target="_blank" rel="noopener">{text('faultConsolePage','windows_and_mac_commands')}</a></p>
    </section>
  </main>
  
</>;
}
createRoot(document.getElementById('fault-console-root')).render(<Console />);
