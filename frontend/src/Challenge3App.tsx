import { useEffect, useState } from "react";
import LiveMetrics from "./LiveMetrics";
import type { ExperimentMeasurement, ExperimentSettings, ExperimentSnapshot } from "./types";

const steps = ["MEASURE", "HYPOTHESIS", "EXPERIMENT", "OBSERVE", "IMPROVE"] as const;
const indicators = [
  ["averageLatency", "Average latency"], ["p95Latency", "P95 latency"],
  ["successRate", "Success rate"], ["errorRate", "Error rate"],
  ["fallbackCount", "Fallback count"]
] as const;

type Action = "/traffic/start" | "/traffic/stop" | "/baseline/capture" | "/hypothesis"
  | "/experiment/start" | "/experiment/capture" | "/observation"
  | "/mitigation/apply" | "/validation/start" | "/validation/capture"
  | "/reflection" | "/reset";

async function read(response: Response): Promise<ExperimentSnapshot> {
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(detail.message ?? `Request failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<ExperimentSnapshot>;
}

function percent(value: number): string { return `${Math.round(value * 100)}%`; }
function latency(value: number): string { return `${value.toLocaleString()} ms`; }

function Comparison({ baseline, failure, validation }: {
  baseline: ExperimentMeasurement | null;
  failure: ExperimentMeasurement | null;
  validation: ExperimentMeasurement | null;
}) {
  if (!baseline) return null;
  const columns = [baseline, failure, validation];
  return <div className="table-wrap"><table className="summary-table">
    <caption>Saved measurement windows · separate from the rolling live chart</caption>
    <thead><tr><th scope="col">Measurement</th><th scope="col">Baseline</th><th scope="col">Failure</th><th scope="col">Failure with mitigation</th></tr></thead>
    <tbody>
      <tr><th scope="row">Average latency</th>{columns.map((m, i) => <td key={i}>{m ? latency(m.averageLatencyMs) : "—"}</td>)}</tr>
      <tr><th scope="row">P95 latency</th>{columns.map((m, i) => <td key={i}>{m ? latency(m.p95LatencyMs) : "—"}</td>)}</tr>
      <tr><th scope="row">Success rate</th>{columns.map((m, i) => <td key={i}>{m ? percent(m.successRate) : "—"}</td>)}</tr>
      <tr><th scope="row">Error rate</th>{columns.map((m, i) => <td key={i}>{m ? percent(m.errorRate) : "—"}</td>)}</tr>
      <tr><th scope="row">Request count</th>{columns.map((m, i) => <td key={i}>{m?.requestCount ?? "—"}</td>)}</tr>
      <tr><th scope="row">Fallback count</th>{columns.map((m, i) => <td key={i}>{m?.fallbackCount ?? "—"}</td>)}</tr>
      <tr><th scope="row">Stock connection</th>{columns.map((m, i) => <td key={i}>{m?.dependencyStatus.replace(/_/g, " ").toLowerCase() ?? "—"}</td>)}</tr>
    </tbody>
  </table></div>;
}

export default function Challenge3App({ onBack }: { onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<ExperimentSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenIndicators, setChosenIndicators] = useState<string[]>(["p95Latency", "successRate"]);
  const [hypothesis, setHypothesis] = useState("");
  const [faultId, setFaultId] = useState("latency-1000");
  const [whatChanged, setWhatChanged] = useState("");
  const [strongestEvidence, setStrongestEvidence] = useState("");
  const [hypothesisConfirmed, setHypothesisConfirmed] = useState("");
  const [explanation, setExplanation] = useState("");
  const [settings, setSettings] = useState<ExperimentSettings>({ timeoutMs: 4000, fallbackEnabled: false, retries: 0, circuitBreakerEnabled: false });
  const [reason, setReason] = useState("");
  const [failureRevealed, setFailureRevealed] = useState("");
  const [mitigationAddressed, setMitigationAddressed] = useState("");
  const [whyMoreResilient, setWhyMoreResilient] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/challenge-3").then(read)
      .then((initial) => { if (active) setSnapshot(initial); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Workshop unavailable"); });
    const stream = new EventSource("/api/challenge-3/stream");
    stream.addEventListener("snapshot", (event) => {
      if (active) {
        setSnapshot(JSON.parse((event as MessageEvent).data) as ExperimentSnapshot);
        setConnected(true);
        setError(null);
      }
    });
    stream.onerror = () => { if (active) setConnected(false); };
    return () => { active = false; stream.close(); };
  }, []);

  const savedHypothesis = snapshot?.challenge.hypothesis;
  const savedFault = snapshot?.challenge.selectedFaultId;
  const savedSettings = snapshot?.challenge.settings;
  const savedReason = snapshot?.challenge.mitigationReason;
  useEffect(() => { if (savedHypothesis) setHypothesis(savedHypothesis); }, [savedHypothesis]);
  useEffect(() => { if (savedFault) setFaultId(savedFault); }, [savedFault]);
  useEffect(() => {
    if (savedSettings) setSettings(savedSettings);
  }, [savedSettings?.timeoutMs, savedSettings?.fallbackEnabled,
    savedSettings?.retries, savedSettings?.circuitBreakerEnabled]);
  useEffect(() => { if (savedReason) setReason(savedReason); }, [savedReason]);

  async function act(path: Action, body?: object): Promise<void> {
    setBusy(true); setError(null);
    try {
      const next = await read(await fetch(`/api/challenge-3${path}`, {
        method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      }));
      setSnapshot(next);
      if (path === "/reset") {
        setChosenIndicators(["p95Latency", "successRate"]); setHypothesis(""); setFaultId("latency-1000");
        setWhatChanged(""); setStrongestEvidence(""); setHypothesisConfirmed(""); setExplanation("");
        setSettings({ timeoutMs: 4000, fallbackEnabled: false, retries: 0, circuitBreakerEnabled: false });
        setReason(""); setFailureRevealed(""); setMitigationAddressed(""); setWhyMoreResilient("");
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The action failed");
    } finally { setBusy(false); }
  }

  const c = snapshot?.challenge;
  const step = c?.step ?? "MEASURE";
  const current = step === "REFLECT" || step === "COMPLETED" ? 5 : steps.indexOf(step);
  const enough = !!c && c.currentWindowSamples >= c.minimumSamples;
  const fault = c?.faults.find((item) => item.id === c.selectedFaultId);
  const status = !snapshot?.dependency ? "unavailable" : !snapshot.dependency.enabled ? "stock service disconnected"
    : snapshot.dependency.latencyMs ? `stock response delayed ${snapshot.dependency.latencyMs} ms` : "normal";

  return <main className="shell">
    <header className="hero">
      <div className="topline"><p className="eyebrow">CHAOS ENGINEERING WORKSHOP · CHALLENGE 3</p><div className="header-actions">
        <button className="text-button" disabled={busy} onClick={() => {
          if (snapshot?.trafficRunning) void act("/traffic/stop").then(onBack); else onBack();
        }}>All Challenges</button>
        <button className="text-button" disabled={busy || !snapshot} onClick={() => {
          if (window.confirm("Reset Challenge 3? This stops traffic, restores the stock connection and default settings, and clears all answers and results.")) void act("/reset");
        }}>Reset Challenge</button>
      </div></div>
      <h1>{c?.title ?? "Independent Experiment"}</h1>
      <p className="intro">{c?.scenario ?? "Connecting to the workshop…"}</p>
      <p className="objective">Objective: determine whether the product page stays usable when stock information is slow or unavailable.</p>
      <div className="status-row" aria-live="polite"><span className={`pill ${snapshot?.trafficRunning ? "pill-live" : ""}`}>Traffic: {snapshot?.trafficRunning ? "running" : "stopped"}</span><span className={`pill ${status !== "normal" ? "pill-fault" : ""}`}>Stock connection: {status}</span><span className={`pill ${connected ? "pill-live" : ""}`}>Live feed: {connected ? "connected" : "connecting"}</span></div>
    </header>
    <ol className="progress" aria-label="Challenge progress">{steps.map((item, index) => <li key={item} className={index < current ? "done" : index === current ? "active" : "locked"} aria-current={index === current ? "step" : undefined}><span className="step-number">{index < current ? "✓" : index + 1}</span><span className="step-copy"><strong>{item.charAt(0) + item.slice(1).toLowerCase()}</strong><small>{index < current ? "Completed" : index === current ? "Current step" : "Locked"}</small></span></li>)}</ol>
    <div className="toolbar"><span>Requests to the product page create real measurements.</span><button disabled={busy || !snapshot || snapshot.trafficRunning || c?.completed} onClick={() => void act("/traffic/start")}>Start Traffic</button><button className="secondary" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/traffic/stop")}>Stop Traffic</button></div>
    {error && <p className="error" role="alert">{error}</p>}

    {c && step === "MEASURE" && <section className="work-card step-content"><p className="eyebrow">STEP 1 · MEASURE</p><h2>Define normal behavior</h2><p>Select the indicators you want to use as steady-state evidence. Start traffic, then capture at least {c.minimumSamples} completed requests.</p><fieldset className="indicator-options"><legend>Steady-state indicators</legend>{indicators.map(([id, label]) => <label key={id}><input type="checkbox" checked={chosenIndicators.includes(id)} onChange={(event) => setChosenIndicators(event.target.checked ? [...chosenIndicators, id] : chosenIndicators.filter((value) => value !== id))} /> {label}</label>)}</fieldset><p>Measured requests: {c.currentWindowSamples} / {c.minimumSamples}</p><button disabled={busy || !snapshot?.trafficRunning || !enough || chosenIndicators.length === 0} onClick={() => void act("/baseline/capture", { indicators: chosenIndicators })}>Capture Baseline</button></section>}

    {c && step === "HYPOTHESIS" && <form className="work-card step-content" onSubmit={(event) => { event.preventDefault(); void act("/hypothesis", { text: hypothesis, faultId }); }}><p className="eyebrow">STEP 2 · HYPOTHESIS</p><h2>Design your experiment</h2><p>Choose a fault and predict how it will change the indicators you selected. Your choice is saved for the later validation run.</p><label>Fault to test<select value={faultId} onChange={(event) => setFaultId(event.target.value)}>{c.faults.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Your testable hypothesis<textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} placeholder="Describe a measurable prediction and why you expect it." required /></label><button disabled={busy || hypothesis.trim().length < 10}>Save Hypothesis and Fault</button></form>}

    {c && step === "EXPERIMENT" && <section className="work-card step-content"><p className="eyebrow">STEP 3 · EXPERIMENT</p><h2>Introduce the chosen fault</h2><p>Selected fault: {fault?.label}. Compare the real request results with your captured baseline.</p>{!c.experimentActive ? <button className="fault-button" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/experiment/start")}>Inject Fault</button> : <><p className="callout">Fault active. Measured requests: {c.currentWindowSamples} / {c.minimumSamples}</p><button disabled={busy || !enough} onClick={() => void act("/experiment/capture")}>Capture Failure Results</button></>}</section>}

    {c && step === "OBSERVE" && <form className="work-card step-content" onSubmit={(event) => { event.preventDefault(); void act("/observation", { whatChanged, strongestEvidence, hypothesisConfirmed, explanation }); }}><p className="eyebrow">STEP 4 · OBSERVE</p><h2>Interpret the evidence</h2><Comparison baseline={c.baseline} failure={c.failure} validation={null} /><label>What changed?<textarea value={whatChanged} onChange={(event) => setWhatChanged(event.target.value)} required /></label><label>Which measured indicator is your strongest evidence?<textarea value={strongestEvidence} onChange={(event) => setStrongestEvidence(event.target.value)} required /></label><label>Was your hypothesis confirmed?<select value={hypothesisConfirmed} onChange={(event) => setHypothesisConfirmed(event.target.value)} required><option value="">Choose an answer</option><option value="YES">Yes</option><option value="PARTIALLY">Partially</option><option value="NO">No</option></select></label><label>Explain your interpretation<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} required /></label><button disabled={busy || !whatChanged.trim() || !strongestEvidence.trim() || !hypothesisConfirmed || !explanation.trim()}>Save Observation</button></form>}

    {c && step === "IMPROVE" && <section className="work-card step-content"><p className="eyebrow">STEP 5 · IMPROVE</p><h2>Choose and test resilience settings</h2><p>Set your own combination. The original {fault?.label.toLowerCase()} will be applied again for validation.</p><div className="setting-grid"><label>Stock request timeout<select disabled={busy || c.validationActive} value={settings.timeoutMs} onChange={(event) => setSettings({ ...settings, timeoutMs: Number(event.target.value) })}>{c.controls.timeoutMs.map((value) => <option key={value} value={value}>{value === 4000 ? "Default (4000 ms)" : `${value} ms`}</option>)}</select></label><label>Retries<select disabled={busy || c.validationActive} value={settings.retries} onChange={(event) => setSettings({ ...settings, retries: Number(event.target.value) })}>{c.controls.retries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><input type="checkbox" disabled={busy || c.validationActive} checked={settings.fallbackEnabled} onChange={(event) => setSettings({ ...settings, fallbackEnabled: event.target.checked })} /> Keep the product page usable without stock information</label><label><input type="checkbox" disabled={busy || c.validationActive} checked={settings.circuitBreakerEnabled} onChange={(event) => setSettings({ ...settings, circuitBreakerEnabled: event.target.checked })} /> Temporarily skip repeated failing stock requests</label></div><label>Why did you choose these settings?<textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={c.validationActive} required /></label><button disabled={busy || c.validationActive || reason.trim().length < 10} onClick={() => void act("/mitigation/apply", { settings, reason })}>Apply Settings</button>{c.mitigationReason && !c.validationActive && <button className="fault-button" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/validation/start")}>Rerun the Same Fault</button>}{c.validationActive && <><p className="callout">Same fault active. Measured requests: {c.currentWindowSamples} / {c.minimumSamples}</p><button disabled={busy || !enough} onClick={() => void act("/validation/capture")}>Capture Validation</button></>}{c.validation && <Comparison baseline={c.baseline} failure={c.failure} validation={c.validation} />}{c.validationFeedback.length > 0 && <div className="feedback" role="status"><strong>Not improved enough yet</strong><ul>{c.validationFeedback.map((item) => <li key={item}>{item}</li>)}</ul><p>Change settings and rerun the original fault.</p></div>}</section>}

    {c && step === "REFLECT" && <form className="work-card step-content" onSubmit={(event) => { event.preventDefault(); void act("/reflection", { failureRevealed, mitigationAddressed, whyMoreResilient }); }}><p className="eyebrow">VALIDATION PASSED · FINAL REFLECTION</p><h2>Explain what you learned</h2><Comparison baseline={c.baseline} failure={c.failure} validation={c.validation} /><label>What did the experiment reveal about the system?<textarea value={failureRevealed} onChange={(event) => setFailureRevealed(event.target.value)} required /></label><label>Did your mitigation address the tested failure? How?<textarea value={mitigationAddressed} onChange={(event) => setMitigationAddressed(event.target.value)} required /></label><label>Would you consider the system resilient against this failure? Why?<textarea value={whyMoreResilient} onChange={(event) => setWhyMoreResilient(event.target.value)} required /></label><button disabled={busy || [failureRevealed, mitigationAddressed, whyMoreResilient].some((answer) => answer.trim().length < 10)}>Complete Challenge</button></form>}

    {c?.completed && <section className="work-card completion"><p className="eyebrow">CHALLENGE COMPLETED · RESILIENCE CRITERIA SATISFIED</p><h2>Your independent experiment</h2><p>You selected {fault?.label.toLowerCase()}, compared normal and faulty behavior, then reran the same fault after your resilience change.</p><Comparison baseline={c.baseline} failure={c.failure} validation={c.validation} /><p><strong>Hypothesis:</strong> {c.hypothesis}</p><p><strong>Interpretation:</strong> {c.observation?.explanation}</p><p><strong>Selected configuration:</strong> {c.settings.timeoutMs} ms timeout; fallback {c.settings.fallbackEnabled ? "on" : "off"}; {c.settings.retries} retries; circuit breaker {c.settings.circuitBreakerEnabled ? "on" : "off"}.</p><p><strong>Mitigation rationale:</strong> {c.mitigationReason}</p><p><strong>What the failure revealed:</strong> {c.reflection?.failureRevealed}</p><p><strong>What changed:</strong> {c.reflection?.mitigationAddressed}</p><p><strong>Why it is more resilient:</strong> {c.reflection?.whyMoreResilient}</p></section>}

    {c?.baseline && step !== "OBSERVE" && step !== "REFLECT" && step !== "COMPLETED" && <section className="evidence-card"><h2>Saved evidence</h2><Comparison baseline={c.baseline} failure={c.failure} validation={c.validation} /></section>}
    <LiveMetrics snapshot={snapshot} />
    <details className="technical-details"><summary>How does this work?</summary><p>The workshop sends real product requests. The Storefront calls Inventory through a dedicated network proxy. The selected fault affects that connection, while separate measurement windows capture baseline, failure, and validation results.</p></details>
  </main>;
}
