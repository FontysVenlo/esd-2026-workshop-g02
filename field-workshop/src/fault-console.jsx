import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { format } from '/copy.mjs';

async function request(path, body) {
  const response = await fetch(path, { cache:'no-store', method:body ? 'POST' : 'GET', headers:body ? {'Content-Type':'application/json'} : undefined, body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? format("Request failed: {status}",{status:response.status}));
  return data;
}
function FaultState({state}) {
  if (!state) return <p>{"Current state is unavailable."}</p>;
  return <div id="state" className="status-grid">{['inventory','shipping'].map(name => <article className="status-card" key={name}>
    <h3>{(name === "inventory" ? "Lighting inventory" : "Shipping (Desk Lamp)")}</h3><span className={`badge${state[name].enabled?'':' off'}`}>{(state[name].enabled?"Connected":"Disconnected")}</span>
    {!state[name].toxics.length?<p>{"No active faults"}</p>:<ul className="faults">{state[name].toxics.map(toxic => <li key={toxic.name}>{toxic.name}: {toxic.type}{toxic.type==='latency'?` (${toxic.attributes?.latency ?? '?'} ms)`:''} · {toxic.stream}</li>)}</ul>}
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
  // Other tabs change this state too (the workshop resets it when a new
  // challenge opens), so re-read it whenever this tab is visible.
  const view=useRef({});
  view.current={active,draft};
  useEffect(()=>{
    async function sync() {
      if(document.hidden)return;
      if(!faultLock.current) {try {setFaults(await request('/api/state'));} catch {}}
      if(mitigationLock.current)return;
      try {
        const settings=await request('/api/mitigations'),{active:previous,draft:edits}=view.current;
        setActive(settings);
        if(!previous||JSON.stringify(edits)===JSON.stringify(previous))setDraft(settings);
      } catch {}
    }
    const timer=setInterval(sync,3000);
    document.addEventListener('visibilitychange',sync);window.addEventListener('focus',sync);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',sync);window.removeEventListener('focus',sync);};
  },[]);
  async function refresh() {
    if(faultLock.current)return;
    faultLock.current=true;setBusy(true);
    try {setFaults(await request('/api/state'));setMessage({text:"Showing current Toxiproxy state."});}
    catch(error) {setMessage({text:error.message,error:true});}
    finally {faultLock.current=false;setBusy(false);}
  }
  async function perform(action) {
    if(faultLock.current)return;
    const latencyMs=Number(latency);
    if(action==='set-latency'&&(!Number.isInteger(latencyMs)||latencyMs<50||latencyMs>5000)) {setMessage({text:"Choose a whole-number delay from 50 to 5000 ms.",error:true});return;}
    if(action==='reset'&&!window.confirm("Restore both proxy paths and remove every active Toxiproxy fault in this local workshop?"))return;
    faultLock.current=true;setBusy(true);setMessage({text:"Sending change to Toxiproxy…"});
    try {
      const body={action,proxy,latencyMs},result=await request('/api/action',body);
      setFaults(result.state);setLastRequest({path:'/api/action',body});
      setCommand(`${result.command.method} ${result.command.path}${result.command.body?`\nContent-Type: application/json\n\n${JSON.stringify(result.command.body,null,2)}`:''}`);
      setMessage({text:format("Change applied. {method} {path}. Open “Info & commands” to inspect it.",{method:result.command.method,path:result.command.path})});
    } catch(error) {setMessage({text:format("{error} Refresh the state before trying again.",{error:error.message}),error:true});}
    finally {faultLock.current=false;setBusy(false);}
  }
  function edit(name,key,value) {setDraft(previous=>({...previous,[name]:{...previous[name],[key]:value}}));}
  async function refreshMitigations() {
    if(mitigationLock.current)return;
    mitigationLock.current=true;setMitigationBusy(true);setMitigationMessage({text:"Reading active Storefront settings…"});
    try {const settings=await request('/api/mitigations');setActive(settings);setDraft(settings);setMitigationMessage({text:"Showing active settings. Edit and apply a dependency, or use its challenge preset."});}
    catch(error) {setMitigationMessage({text:format("{error} Refresh settings to try again.",{error:error.message}),error:true});}
    finally {mitigationLock.current=false;setMitigationBusy(false);}
  }
  async function applyMitigation(input) {
    if(mitigationLock.current)return;
    if(input.action==='configure'&&(!Number.isInteger(input.timeoutMs)||input.timeoutMs<50||input.timeoutMs>5000)){setMitigationMessage({text:"Choose a whole-number timeout from 50 to 5000 ms.",error:true});return;}
    mitigationLock.current=true;setMitigationBusy(true);setMitigationMessage({text:"Applying settings to Storefront…"});
    try {
      const settings=await request('/api/mitigations',input);setActive(settings);setDraft(settings);setLastRequest({path:'/api/mitigations',body:input});
      setCommand(format("POST /api/mitigations\nContent-Type: application/json\n\n{body}",{body:JSON.stringify(input,null,2)}));
      setMitigationMessage({text:input.action==='reset'?"Defaults restored: both timeouts are 3000 ms and both fallbacks are off. Network faults remain unchanged.":format("{dependency} settings applied. Repeat the same customer action in Storefront; no restart is needed.",{dependency:(input.dependency === "inventory" ? "Inventory" : "Shipping")})});
    }catch(error){setMitigationMessage({text:format("{error} Refresh settings to check the active state before trying again.",{error:error.message}),error:true});}
    finally{mitigationLock.current=false;setMitigationBusy(false);}
  }
  const platformCommand=!lastRequest?"Apply a fault or mitigation to see the equivalent command here.":platform==='windows'
    ?format("Invoke-RestMethod -Method Post -Uri '{url}' -ContentType 'application/json' -Body '{body}'",{url:`${location.origin}${lastRequest.path}`,body:JSON.stringify(lastRequest.body)})
    :`curl -f -sS -X POST '${location.origin}${lastRequest.path}' \\\n  -H 'Content-Type: application/json' \\\n  --data '${JSON.stringify(lastRequest.body)}'`;
  return <>
  <header><div className="header-inner"><a className="brand" href="http://localhost:8088/">{"Northstar Supply / Network faults"}</a><nav className="links"><a href="http://localhost:8088/">{"Workshop overview"}</a><a href="http://localhost:3008/d/field-workshop/field-workshop" target="_blank" rel="noopener">{"Grafana"}</a></nav></div></header>
  <main>
    <div className="intro"><div className="eyebrow">{"Operator tool"}</div><h1>{"Network faults & fallbacks"}</h1><p>{"Lighting, Seating and Desks have separate inventory services. Fault Lighting inventory or the lamp’s path to shared Shipping. Compare customer results in Storefront and worker, queue and circuit metrics in Grafana before and after mitigation."}</p></div>
    <div className="tabs" role="tablist" aria-label={"Network fault console views"}>
      <button id="controls-tab" ref={node => { tabs.current['controls'] = node; }} className="tab" role="tab" aria-selected={tab === 'controls'} aria-controls="controls-panel" tabIndex={tab === 'controls' ? 0 : -1} type="button" onClick={() => selectTab('controls')} onKeyDown={event => moveTab(event, 'controls')}>{"Fault injection"}</button>
      <button id="mitigations-tab" ref={node => { tabs.current['mitigations'] = node; }} className="tab" role="tab" aria-selected={tab === 'mitigations'} aria-controls="mitigations-panel" tabIndex={tab === 'mitigations' ? 0 : -1} type="button" onClick={() => selectTab('mitigations')} onKeyDown={event => moveTab(event, 'mitigations')}>{"Fallbacks & timeouts"}</button>
      <button id="info-tab" ref={node => { tabs.current['info'] = node; }} className="tab" role="tab" aria-selected={tab === 'info'} aria-controls="info-panel" tabIndex={tab === 'info' ? 0 : -1} type="button" onClick={() => selectTab('info')} onKeyDown={event => moveTab(event, 'info')}>{"Info & commands"}</button>
    </div>
    <section id="controls-panel" className="panel" role="tabpanel" aria-labelledby="controls-tab" hidden={tab !== 'controls'}>
      <h2>{"Current state"}</h2>
      <button onClick={refresh} disabled={busy} id="refresh" className="secondary" type="button">{"Refresh"}</button>
      <FaultState state={faults} />
      <h2>{"Apply a fault"}</h2>
      <div className="controls">
        <label>{"Dependency"}<select id="proxy" value={proxy} onChange={event => setProxy(event.target.value)}><option value="inventory">{"Lighting inventory"}</option><option value="shipping">{"Shipping (Desk Lamp)"}</option></select></label>
        <label>{"Response delay (ms)"}<input id="latency" type="number" min="50" max="5000" step="1" value={latency} onChange={event => setLatency(event.target.value)} /></label>
      </div>
      <div className="actions">
        <button className="action" type="button" data-action="set-latency" disabled={busy} onClick={() => perform('set-latency')}>{"Apply delay"}</button>
        <button className="action secondary" type="button" data-action="remove-latency" disabled={busy} onClick={() => perform('remove-latency')}>{"Remove delay"}</button>
        <button className="action danger" type="button" data-action="disconnect" disabled={busy} onClick={() => perform('disconnect')}>{"Disconnect"}</button>
        <button className="action secondary" type="button" data-action="reconnect" disabled={busy} onClick={() => perform('reconnect')}>{"Reconnect"}</button>
      </div>
      <button disabled={busy} onClick={() => perform('reset')} id="reset-faults" className="secondary" type="button">{"Clear all faults"}</button>
      <p className="meta">{"Clears all four proxy branches. Notes, metrics, and mitigation settings remain. Allow one 5-second breaker cooldown for recovery, or restore default settings."}</p>
      <p id="message" className={`message ${message.error ? "error" : ""}`} role="status">{message.text}</p>
    </section>
    <section id="mitigations-panel" className="panel" role="tabpanel" aria-labelledby="mitigations-tab" hidden={tab !== 'mitigations'}>
      <h2>{"Change the shop's response"}</h2>
      <p>{"A"} <strong>{"timeout"}</strong> {"is how long Storefront waits for a dependency. A"} <strong>{"fallback"}</strong> {"provides an honest replacement when that dependency fails or takes too long. Enabling it also enables a product/dependency circuit breaker: after failure, pause that path for 5 seconds, then allow one probe. A short timeout frees a worker; the breaker reduces repeated waiting; the fallback prevents one missing result from failing the catalog."}</p>
      <p>{"Changes apply to new customer requests immediately. You do not need to restart Docker. Keep or reapply the same fault to compare the customer experience before and after mitigation."}</p>
      <button disabled={mitigationBusy} onClick={refreshMitigations} id="refresh-mitigations" className="secondary" type="button">{"Refresh settings"}</button>
      <div className="mitigation-controls">
        <form onSubmit={event => { event.preventDefault(); applyMitigation({action:'configure', dependency:'inventory', timeoutMs:Number(draft.inventory.timeoutMs), fallback:draft.inventory.fallback}); }} id="inventory-settings" className="status-card">
          <h3>{"Inventory · all three categories"}</h3>
          <p>{"With fallback enabled, an unavailable stock check returns"} <strong>{"Stock unconfirmed"}</strong>{". It never guesses the stock quantity."}</p>
          <p id="inventory-current" className="meta" role="status">{active ? format("Active: {timeout} ms timeout · fallback + breaker {fallback}",{timeout:active.inventory.timeoutMs,fallback:(active.inventory.fallback?"on":"off")}) : "Active settings unavailable."}</p>
          <label htmlFor="inventory-timeout">{"Inventory timeout (ms)"}</label>
          <input id="inventory-timeout" value={draft.inventory.timeoutMs} onChange={event => edit('inventory', 'timeoutMs', event.target.value)} type="number" min="50" max="5000" step="1" required disabled={mitigationBusy || !active} />
          <label className="checkbox-label"><input id="inventory-fallback" checked={draft.inventory.fallback} onChange={event => edit('inventory', 'fallback', event.target.checked)} type="checkbox" disabled={mitigationBusy || !active} /> {" Enable Inventory fallback + circuit breaker"}</label>
          <div className="actions">
            <button className="primary" type="submit" disabled={mitigationBusy || !active}>{"Apply Inventory settings"}</button>
            <button onClick={() => applyMitigation({action:'configure',dependency:'inventory',timeoutMs:400,fallback:true})} id="inventory-preset" className="secondary" type="button" disabled={mitigationBusy || !active}>{"Use Challenge 1 settings"}</button>
          </div>
          <p className="meta">{"Challenge 1 uses a 400 ms timeout, honest fallback, and a 5-second circuit breaker for failed product paths."}</p>
        </form>
        <form onSubmit={event => { event.preventDefault(); applyMitigation({action:'configure', dependency:'shipping', timeoutMs:Number(draft.shipping.timeoutMs), fallback:draft.shipping.fallback}); }} id="shipping-settings" className="status-card">
          <h3>{"Shipping · delivery quotes"}</h3>
          <p>{"With fallback enabled, the preview returns available stock and"} <strong>{"Shipping quote unavailable"}</strong>{". It never invents a price or delivery date."}</p>
          <p id="shipping-current" className="meta" role="status">{active ? format("Active: {timeout} ms timeout · fallback + breaker {fallback}",{timeout:active.shipping.timeoutMs,fallback:(active.shipping.fallback?"on":"off")}) : "Active settings unavailable."}</p>
          <label htmlFor="shipping-timeout">{"Shipping timeout (ms)"}</label>
          <input id="shipping-timeout" value={draft.shipping.timeoutMs} onChange={event => edit('shipping', 'timeoutMs', event.target.value)} type="number" min="50" max="5000" step="1" required disabled={mitigationBusy || !active} />
          <label className="checkbox-label"><input id="shipping-fallback" checked={draft.shipping.fallback} onChange={event => edit('shipping', 'fallback', event.target.checked)} type="checkbox" disabled={mitigationBusy || !active} /> {" Enable Shipping fallback + circuit breaker"}</label>
          <div className="actions">
            <button className="primary" type="submit" disabled={mitigationBusy || !active}>{"Apply Shipping settings"}</button>
            <button onClick={() => applyMitigation({action:'configure',dependency:'shipping',timeoutMs:3000,fallback:true})} id="shipping-preset" className="secondary" type="button" disabled={mitigationBusy || !active}>{"Use Challenge 2 settings"}</button>
          </div>
          <p className="meta">{"Challenge 2 enables fallback and a 5-second circuit breaker. Its disconnected Shipping path fails immediately; the timeout remains 3000 ms."}</p>
        </form>
      </div>
      <button onClick={() => applyMitigation({action:'reset'})} id="reset-mitigations" className="secondary" type="button" disabled={mitigationBusy || !active}>{"Restore default settings"}</button>
      <p className="meta">{"Restores both timeouts to 3000 ms and turns both fallbacks off. Network faults and your answers remain. Settings last until Storefront restarts; restarting reloads its startup configuration."}</p>
      <p id="mitigation-message" className={`message ${mitigationMessage.error ? "error" : ""}`} role="status">{mitigationMessage.text}</p>
    </section>
    <section id="info-panel" className="panel" role="tabpanel" aria-labelledby="info-tab" hidden={tab !== 'info'}>
      <h2>{"Underlying API commands"}</h2>
      <p>{"These controls send HTTP requests to Toxiproxy. The Storefront uses the affected paths."}</p>
      <ul>
        <li><strong>{"Apply delay:"}</strong> <code>{"POST /proxies/{dependency}/toxics"}</code> {"with a downstream latency toxic. An existing console delay is updated at"} <code>{"POST /proxies/{dependency}/toxics/workshop-latency"}</code>{"."}</li>
        <li><strong>{"Remove delay:"}</strong> <code>{"DELETE /proxies/{dependency}/toxics/workshop-latency"}</code>{"."}</li>
        <li><strong>{"Disconnect / reconnect:"}</strong> <code>{"POST /proxies/{dependency}"}</code> {"with"} <code>{"{\"enabled\":false}"}</code> {"or"} <code>{"{\"enabled\":true}"}</code>{"."}</li>
        <li><strong>{"Clear all faults:"}</strong> <code>{"POST /reset"}</code>{". Reconnects both paths and removes all toxics."}</li>
        <li><strong>{"Refresh:"}</strong> <code>{"GET /proxies"}</code>{". Reads state without changing it."}</li>
      </ul>
      <h3>{"Example: 1500 ms Lighting inventory delay"}</h3>
      <pre>{"POST /proxies/inventory/toxics\nContent-Type: application/json\n\n{\"name\":\"workshop-latency\",\"type\":\"latency\",\"stream\":\"downstream\",\"attributes\":{\"latency\":1500,\"jitter\":0}}"}</pre>
      <h3>{"Last command sent"}</h3>
      <pre id="last-command">{command || "No command sent yet."}</pre>
      <h3>{"Optional command for your computer"}</h3>
      <p>{"The browser controls above work the same on both platforms. This selector changes only the optional command example, not how faults or fallbacks work."}</p>
      <label htmlFor="command-platform">{"Command platform"}</label>
      <select id="command-platform" value={platform} onChange={event => setPlatform(event.target.value)}><option value="windows">{"Windows · PowerShell"}</option><option value="mac">{"Mac · Terminal"}</option></select>
      <pre id="platform-command">{platformCommand}</pre>
      <h3>{"Fallback settings API"}</h3>
      <p><code>{"GET /api/mitigations"}</code> {"reads current settings."} <code>{"POST /api/mitigations"}</code> {"applies a dependency's timeout and fallback, or restores defaults. The console forwards these requests to Storefront's internal settings listener."}</p>
      <p className="meta">{"The raw API is at"} <code>{"http://localhost:8478"}</code>{"."} <a href="http://localhost:8088/tools" target="_blank" rel="noopener">{"Windows and Mac commands"}</a></p>
    </section>
  </main>
  
</>;
}
createRoot(document.getElementById('fault-console-root')).render(<Console />);
