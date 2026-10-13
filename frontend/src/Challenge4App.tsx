import { useEffect, useState } from "react";
import type { GameDayMeasurement, GameDaySettings, GameDaySnapshot } from "./types";

const sections = ["INVESTIGATE", "PLAN", "EXPERIMENT", "ANALYZE", "IMPROVE", "VALIDATE", "CONCLUDE"] as const;
const signals = [["requestRate", "Request rate"], ["errorRate", "Error rate"],
  ["latency", "Response latency"], ["dependencyCalls", "Dependency calls"],
  ["fallbacks", "Fallback activity"]] as const;
const initialSettings: GameDaySettings = {
  inventoryTimeoutMs: 4000, inventoryFallbackEnabled: false,
  shippingTimeoutMs: 4000, shippingFallbackEnabled: false, retries: 0
};

async function read(response: Response): Promise<GameDaySnapshot> {
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message ?? `Request failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<GameDaySnapshot>;
}

function Comparison({ baseline, incident, experiment, validation }: {
  baseline: GameDayMeasurement | null; incident: GameDayMeasurement | null;
  experiment: GameDayMeasurement | null; validation: GameDayMeasurement | null;
}) {
  if (!baseline) return null;
  const columns = [baseline, incident, experiment, validation];
  const cells = (select: (m: GameDayMeasurement) => string | number) => columns.map((m, i) => <td key={i}>{m ? select(m) : "—"}</td>);
  return <div className="table-wrap"><table className="summary-table">
    <caption>Saved request windows · consult Grafana for dependency-level signals</caption>
    <thead><tr><th scope="col">Measurement</th><th scope="col">Normal</th><th scope="col">Incident</th><th scope="col">Your experiment</th><th scope="col">With mitigation</th></tr></thead>
    <tbody>
      <tr><th scope="row">Average latency</th>{cells(m => `${m.averageLatencyMs} ms`)}</tr>
      <tr><th scope="row">P95 latency</th>{cells(m => `${m.p95LatencyMs} ms`)}</tr>
      <tr><th scope="row">Success rate</th>{cells(m => `${Math.round(m.successRate * 100)}%`)}</tr>
      <tr><th scope="row">Error rate</th>{cells(m => `${Math.round(m.errorRate * 100)}%`)}</tr>
      <tr><th scope="row">Request count</th>{cells(m => m.requestCount)}</tr>
      <tr><th scope="row">Fallback count</th>{cells(m => m.fallbackCount)}</tr>
    </tbody>
  </table></div>;
}

export default function Challenge4App({ onBack }: { onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<GameDaySnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [baselineNote, setBaselineNote] = useState("");
  const [plan, setPlan] = useState({ diagnosisTarget: "", metricEvidence: "", hypothesis: "", faultId: "", blastRadius: "", abortCondition: "" });
  const [analysis, setAnalysis] = useState({ whatChanged: "", strongestMetric: "", blastRadiusObserved: "", interpretation: "" });
  const [settings, setSettings] = useState<GameDaySettings>(initialSettings);
  const [mitigationReason, setMitigationReason] = useState("");
  const [expectedEvidence, setExpectedEvidence] = useState("");
  const [conclusion, setConclusion] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/challenge-4").then(read).then(data => { if (active) setSnapshot(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Workshop unavailable"); });
    const stream = new EventSource("/api/challenge-4/stream");
    stream.addEventListener("snapshot", event => {
      if (active) { setSnapshot(JSON.parse((event as MessageEvent).data) as GameDaySnapshot); setConnected(true); setError(null); }
    });
    stream.onerror = () => { if (active) setConnected(false); };
    return () => { active = false; stream.close(); };
  }, []);

  const c = snapshot?.challenge;
  useEffect(() => {
    if (!c) return;
    if (c.steadyStateSignals.length) setSelectedSignals(c.steadyStateSignals);
    if (c.baselineNote) setBaselineNote(c.baselineNote);
    if (c.plan) setPlan(c.plan);
    if (c.analysis) setAnalysis(c.analysis);
    if (c.mitigationReason) { setSettings(c.settings); setMitigationReason(c.mitigationReason); }
    if (c.expectedEvidence) setExpectedEvidence(c.expectedEvidence);
    if (c.conclusion) setConclusion(c.conclusion);
  }, [c?.step]);

  async function act(path: string, body?: object): Promise<void> {
    setBusy(true); setError(null);
    try {
      const next = await read(await fetch(`/api/challenge-4${path}`, {
        method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      }));
      setSnapshot(next);
      if (path === "/reset") {
        setSelectedSignals([]); setBaselineNote("");
        setPlan({ diagnosisTarget: "", metricEvidence: "", hypothesis: "", faultId: "", blastRadius: "", abortCondition: "" });
        setAnalysis({ whatChanged: "", strongestMetric: "", blastRadiusObserved: "", interpretation: "" });
        setSettings(initialSettings); setMitigationReason(""); setExpectedEvidence(""); setConclusion("");
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    } finally { setBusy(false); }
  }

  const current = c?.step === "COMPLETED" ? sections.length : sections.indexOf(c?.step === "CONCLUDE" ? "CONCLUDE" : c?.step ?? "INVESTIGATE");
  const enough = !!c && c.currentWindowSamples >= c.minimumSamples;
  return <main className="shell">
    <header className="hero">
      <div className="topline"><p className="eyebrow">CHAOS ENGINEERING WORKSHOP · CHALLENGE 4 · CAPSTONE</p><div className="header-actions">
        <button className="text-button" disabled={busy} onClick={() => { if (snapshot?.trafficRunning) void act("/traffic/stop").then(onBack); else onBack(); }}>All Challenges</button>
        <button className="text-button" disabled={busy || !c} onClick={() => { if (window.confirm("Reset the Mini GameDay? This stops requests, restores connections and settings, and clears all recorded evidence.")) void act("/reset"); }}>Reset Challenge</button>
      </div></div>
      <h1>Mini GameDay</h1><p className="intro">{c?.scenario ?? "Connecting to the local workshop…"}</p>
      <p className="objective">A GameDay is a planned reliability exercise: a team monitors a system, introduces a controlled failure, responds, and checks whether the response helped.</p>
      <div className="status-row"><span className={`pill ${snapshot?.trafficRunning ? "pill-live" : ""}`}>Requests: {snapshot?.trafficRunning ? "running" : "stopped"}</span><span className={`pill ${c?.incidentActive || c?.experimentActive || c?.validationActive ? "pill-fault" : ""}`}>Controlled fault: {c?.incidentActive || c?.experimentActive || c?.validationActive ? "active" : "off"}</span><span className={`pill ${connected ? "pill-live" : ""}`}>Live feed: {connected ? "connected" : "connecting"}</span></div>
    </header>

    <section className="assignment-card"><p className="eyebrow">YOUR ASSIGNMENT</p><h2>Investigate an unknown Storefront incident</h2><p><strong>Scenario:</strong> Reports of slow or unreliable pages are coming in. You do not yet know which dependency is responsible.</p><p><strong>Prove:</strong> Use Grafana to identify the impact and likely dependency; design and reproduce a safe fault; apply a resilience improvement; rerun the same fault; decide from measurements whether it helped.</p><p><strong>Done when:</strong> You have saved normal, incident, experiment and validation evidence; a diagnosis, hypothesis, blast radius and abort condition; and an evidence-based conclusion.</p><p><strong>Available tools:</strong> This control panel, Grafana, Prometheus, the local architecture and toolbox pages.</p><p><strong>Deliverable:</strong> A completed GameDay experiment record.</p></section>

    <div className="toolbar"><span>Monitoring is the primary tool for this challenge.</span><button disabled={busy || !c || snapshot?.trafficRunning || c.completed} onClick={() => void act("/traffic/start")}>Start Requests</button><button className="secondary" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/traffic/stop")}>Stop Requests</button><a className="button-link" href="http://localhost:3000/d/workshop-observability/workshop-observability" target="_blank" rel="noreferrer" onClick={() => void act("/grafana/opened")}>Open Grafana ↗</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    <nav className="task-board" aria-label="GameDay task board">{sections.map((name, index) => <button type="button" key={name} onClick={() => document.getElementById(`task-${name.toLowerCase()}`)?.scrollIntoView({ behavior: "smooth" })} className={index < current ? "done" : index === current ? "active" : "locked"}><span>{index < current ? "✓" : index + 1}</span> {name.charAt(0) + name.slice(1).toLowerCase()} <small>{index < current ? "Recorded" : index === current ? "Current" : "Upcoming"}</small></button>)}</nav>

    <section id="task-investigate" className="work-card task-panel"><p className="eyebrow">TASK · INVESTIGATE</p><h2>What does healthy look like—and what changed?</h2><p>Open Grafana. Choose useful signals before you measure. Keep requests running so the charts have real data.</p>
      <fieldset className="indicator-options" disabled={c?.step !== "INVESTIGATE" || !!c.baseline}><legend>Signals that define healthy behavior</legend>{signals.map(([id, label]) => <label key={id}><input type="checkbox" checked={selectedSignals.includes(id)} onChange={event => setSelectedSignals(event.target.checked ? [...selectedSignals, id] : selectedSignals.filter(value => value !== id))} /> {label}</label>)}</fieldset>
      {!c?.baseline && <div className="step-content"><label>What do you see in Grafana under normal traffic?<textarea value={baselineNote} onChange={e => setBaselineNote(e.target.value)} placeholder="Record a concrete normal reading or trend." /></label><p>Completed requests: {c?.currentWindowSamples ?? 0} / {c?.minimumSamples ?? 12}</p><button disabled={busy || !snapshot?.trafficRunning || !c?.grafanaOpened || !enough || !selectedSignals.length || baselineNote.trim().length < 10} onClick={() => void act("/baseline/capture", { signals: selectedSignals, note: baselineNote })}>Save Normal Evidence</button></div>}
      {c?.baseline && !c.incident && <div className="step-content"><p className="callout">Normal behavior saved. The next controlled incident is intentionally hidden: use Grafana to discover where its effect appears.</p>{!c.incidentActive ? <button className="fault-button" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/incident/start")}>Begin Unknown Incident</button> : <><p>Observe dependency-specific metrics in Grafana. Completed incident requests: {c.currentWindowSamples} / {c.minimumSamples}</p><button disabled={busy || !enough} onClick={() => void act("/incident/capture")}>Save Incident Evidence</button></>}</div>}
      {c?.incident && <p className="callout">Normal and incident evidence saved. Record your diagnosis in Plan.</p>}
    </section>

    <section id="task-plan" className="work-card task-panel"><p className="eyebrow">TASK · PLAN</p><h2>Make an evidence-based diagnosis</h2><p>Blast radius is the scope of users or functionality affected. An abort condition is the limit at which an experiment should be stopped for safety.</p>{c?.step === "PLAN" ? <form className="step-content" onSubmit={e => { e.preventDefault(); void act("/plan", plan); }}><label>Which dependency appears unhealthy?<select value={plan.diagnosisTarget} onChange={e => setPlan({ ...plan, diagnosisTarget: e.target.value })} required><option value="">Choose based on Grafana</option><option value="inventory">Stock information</option><option value="shipping">Shipping estimate</option></select></label><label>Which Grafana reading supports that diagnosis?<textarea value={plan.metricEvidence} onChange={e => setPlan({ ...plan, metricEvidence: e.target.value })} required /></label><label>Your testable hypothesis<textarea value={plan.hypothesis} onChange={e => setPlan({ ...plan, hypothesis: e.target.value })} required /></label><label>Fault you will use to reproduce the problem<select value={plan.faultId} onChange={e => setPlan({ ...plan, faultId: e.target.value })} required><option value="">Choose a controlled action</option>{c.availableFaults.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label><label>Expected blast radius<select value={plan.blastRadius} onChange={e => setPlan({ ...plan, blastRadius: e.target.value })} required><option value="">Choose scope</option><option value="Only one dependency or feature">Only one dependency or feature</option><option value="Entire page or summary">Entire page or summary</option><option value="Entire Storefront">Entire Storefront</option><option value="Unclear from current evidence">Unclear from current evidence</option></select></label><label>Abort condition<select value={plan.abortCondition} onChange={e => setPlan({ ...plan, abortCondition: e.target.value })} required><option value="">Choose a safety limit</option><option value="ERROR_RATE_50">Error rate above 50%</option><option value="SUCCESS_RATE_50">Success rate below 50%</option><option value="LATENCY_3000">Latency above 3000 ms</option><option value="UNUSABLE">Service completely unusable</option></select></label><button disabled={busy || !plan.diagnosisTarget || !plan.faultId || !plan.blastRadius || !plan.abortCondition || plan.metricEvidence.trim().length < 10 || plan.hypothesis.trim().length < 10}>Save Experiment Plan</button></form> : <p className="subtle">{c?.plan ? `Plan recorded: ${c.plan.diagnosisTarget}, ${c.plan.faultId}.` : "Investigate and save incident evidence first."}</p>}</section>

    <section id="task-experiment" className="work-card task-panel"><p className="eyebrow">TASK · EXPERIMENT</p><h2>Reproduce a controlled fault</h2><p>Apply only the predefined action in your saved plan. Stop if your chosen abort condition makes the impact unacceptable.</p>{c?.step === "EXPERIMENT" && (!c.experimentActive ? <button className="fault-button" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/experiment/start")}>Run Planned Fault</button> : <div className="step-content"><p>Inspect Grafana, then save the measured result. Completed requests: {c.currentWindowSamples} / {c.minimumSamples}</p><button disabled={busy || !enough} onClick={() => void act("/experiment/capture")}>Save Experiment Evidence and Remove Fault</button></div>)}{!c?.plan && <p className="subtle">An evidence-based plan unlocks this experiment.</p>}</section>

    <section id="task-analyze" className="work-card task-panel"><p className="eyebrow">TASK · ANALYZE</p><h2>Interpret the impact yourself</h2><Comparison baseline={c?.baseline ?? null} incident={c?.incident ?? null} experiment={c?.reproduction ?? null} validation={c?.validation ?? null} />{c?.step === "ANALYZE" && <form className="step-content" onSubmit={e => { e.preventDefault(); void act("/analysis", analysis); }}><label>What changed?<textarea value={analysis.whatChanged} onChange={e => setAnalysis({ ...analysis, whatChanged: e.target.value })} required /></label><label>Which metric is strongest evidence?<textarea value={analysis.strongestMetric} onChange={e => setAnalysis({ ...analysis, strongestMetric: e.target.value })} required /></label><label>What blast radius did you observe?<textarea value={analysis.blastRadiusObserved} onChange={e => setAnalysis({ ...analysis, blastRadiusObserved: e.target.value })} required /></label><label>What conclusion do you draw?<textarea value={analysis.interpretation} onChange={e => setAnalysis({ ...analysis, interpretation: e.target.value })} required /></label><button disabled={busy || Object.values(analysis).some(value => value.trim().length < 10)}>Save Analysis</button></form>}</section>

    <section id="task-improve" className="work-card task-panel"><p className="eyebrow">TASK · IMPROVE</p><h2>Choose a resilience change</h2><p>Explain the problem this change addresses and state in advance what measurements would convince you that it worked.</p>{c?.step === "IMPROVE" && <div className="step-content"><div className="setting-grid">{(["inventory", "shipping"] as const).map(target => <div key={target}><label>{target === "inventory" ? "Stock" : "Shipping"} timeout<select value={settings[`${target}TimeoutMs`]} onChange={e => setSettings({ ...settings, [`${target}TimeoutMs`]: Number(e.target.value) })}>{[4000, 750, 400, 250].map(value => <option key={value} value={value}>{value} ms</option>)}</select></label><label><input type="checkbox" checked={settings[`${target}FallbackEnabled`]} onChange={e => setSettings({ ...settings, [`${target}FallbackEnabled`]: e.target.checked })} /> Keep the summary usable if {target === "inventory" ? "stock" : "shipping"} fails</label></div>)}</div><label>Retries<select value={settings.retries} onChange={e => setSettings({ ...settings, retries: Number(e.target.value) })}><option value={0}>0</option><option value={1}>1</option></select></label><label>Why this change?<textarea value={mitigationReason} onChange={e => setMitigationReason(e.target.value)} /></label><label>What evidence would show improvement?<textarea value={expectedEvidence} onChange={e => setExpectedEvidence(e.target.value)} /></label><button disabled={busy || mitigationReason.trim().length < 10 || expectedEvidence.trim().length < 10} onClick={() => void act("/mitigation/apply", { settings, reason: mitigationReason, expectedEvidence })}>Apply Resilience Change</button>{c.mitigationReason && <button className="fault-button" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/validation/start")}>Rerun the Same Fault</button>}{c.validationFeedback.length > 0 && <div className="feedback"><strong>Measured improvement is insufficient</strong><ul>{c.validationFeedback.map(item => <li key={item}>{item}</li>)}</ul></div>}</div>}</section>

    <section id="task-validate" className="work-card task-panel"><p className="eyebrow">TASK · VALIDATE</p><h2>Compare under the identical fault</h2>{c?.step === "VALIDATE" && <div className="step-content"><p>The same fault is active. Use Grafana to inspect impact and fallback activity. Completed requests: {c.currentWindowSamples} / {c.minimumSamples}.</p><button disabled={busy || !enough} onClick={() => void act("/validation/capture")}>Save Validation Evidence and Remove Fault</button></div>}{c?.validation && <Comparison baseline={c.baseline} incident={c.incident} experiment={c.reproduction} validation={c.validation} />}</section>

    <section id="task-conclude" className="work-card task-panel"><p className="eyebrow">TASK · CONCLUDE</p><h2>Document the decision</h2>{c?.step === "CONCLUDE" && <form className="step-content" onSubmit={e => { e.preventDefault(); void act("/conclusion", { text: conclusion }); }}><label>What did your measurements show, and would you keep this mitigation?<textarea value={conclusion} onChange={e => setConclusion(e.target.value)} required /></label><button disabled={busy || conclusion.trim().length < 10}>Complete GameDay Record</button></form>}</section>

    {c?.completed && <section className="work-card completion"><p className="eyebrow">YOU COMPLETED A CHAOS ENGINEERING GAMEDAY</p><h2>Your experiment record</h2><p><strong>Assignment:</strong> Investigate an unknown dependency incident and validate a resilience improvement.</p><p><strong>Steady-state signals:</strong> {c.steadyStateSignals.join(", ")}. <strong>Normal observation:</strong> {c.baselineNote}</p><p><strong>Hypothesis and fault:</strong> {c.plan?.hypothesis} · {c.availableFaults.find(f => f.id === c.plan?.faultId)?.label}</p><p><strong>Evidence:</strong> {c.plan?.metricEvidence}</p><Comparison baseline={c.baseline} incident={c.incident} experiment={c.reproduction} validation={c.validation} /><p><strong>Observation:</strong> {c.analysis?.interpretation}</p><p><strong>Mitigation:</strong> {c.mitigationReason} <strong>Expected evidence:</strong> {c.expectedEvidence}</p><p><strong>Conclusion:</strong> {c.conclusion}</p><p><strong>Process:</strong> Measure → Hypothesize → Inject → Observe → Improve → Validate</p><p><strong>Tools:</strong> Toxiproxy · Prometheus · Grafana. <strong>Concepts:</strong> Steady state · Blast radius · Magnitude · Abort condition · Fallback · Timeout · Retry · Circuit breaker.</p><p><strong>In the real world:</strong> Production GameDays combine observability, controlled failure injection, incident response, and communication across a team.</p></section>}
  </main>;
}
