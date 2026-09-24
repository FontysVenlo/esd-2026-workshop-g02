import { useEffect, useState } from "react";
import LiveMetrics from "./LiveMetrics";
import ShippingSummaryTable from "./ShippingSummaryTable";
import type { ChallengeStep, ShippingSnapshot } from "./types";

const steps: { id: ChallengeStep; label: string }[] = [
  { id: "MEASURE", label: "Measure" },
  { id: "HYPOTHESIS", label: "Hypothesis" },
  { id: "EXPERIMENT", label: "Experiment" },
  { id: "OBSERVE", label: "Observe" },
  { id: "IMPROVE", label: "Improve" }
];

type ActionPath =
  | "/traffic/start" | "/traffic/stop" | "/baseline/capture"
  | "/hypothesis" | "/experiment/start" | "/experiment/capture"
  | "/observation" | "/mitigation/apply" | "/validation/start"
  | "/validation/capture" | "/reset";

async function readSnapshot(response: Response): Promise<ShippingSnapshot> {
  if (!response.ok) {
    const details = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(details.message ?? `Request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<ShippingSnapshot>;
}

export default function Challenge2App({ onBack }: { onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<ShippingSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hypothesis, setHypothesis] = useState("");
  const [whatChanged, setWhatChanged] = useState("");
  const [metricsAffected, setMetricsAffected] = useState("");
  const [completeRequestFailed, setCompleteRequestFailed] = useState("");
  const [hypothesisConfirmed, setHypothesisConfirmed] = useState("");
  const [why, setWhy] = useState("");
  const [selectedMitigation, setSelectedMitigation] = useState("");
  const [mitigationReason, setMitigationReason] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/challenge-2").then(readSnapshot)
      .then((initial) => { if (active) setSnapshot(initial); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Workshop unavailable");
      });
    const stream = new EventSource("/api/challenge-2/stream");
    stream.addEventListener("snapshot", (event) => {
      if (active) {
        setSnapshot(JSON.parse((event as MessageEvent).data) as ShippingSnapshot);
        setConnected(true);
        setError(null);
      }
    });
    stream.onerror = () => { if (active) setConnected(false); };
    return () => { active = false; stream.close(); };
  }, []);

  const saved = snapshot?.challenge;
  useEffect(() => { if (saved?.hypothesis) setHypothesis(saved.hypothesis); }, [saved?.hypothesis]);
  useEffect(() => {
    if (saved?.observation) {
      setWhatChanged(saved.observation.whatChanged);
      setMetricsAffected(saved.observation.metricsAffected);
      setCompleteRequestFailed(saved.observation.completeRequestFailed ? "YES" : "NO");
      setHypothesisConfirmed(saved.observation.hypothesisConfirmed);
      setWhy(saved.observation.why);
    }
  }, [saved?.observation]);
  useEffect(() => {
    if (saved?.mitigationId) setSelectedMitigation(saved.mitigationId);
    if (saved?.mitigationReason) setMitigationReason(saved.mitigationReason);
  }, [saved?.mitigationId, saved?.mitigationReason]);

  async function act(path: ActionPath, body?: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/challenge-2${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const next = await readSnapshot(response);
      setSnapshot(next);
      if (path === "/reset") {
        setHypothesis(""); setWhatChanged(""); setMetricsAffected("");
        setCompleteRequestFailed(""); setHypothesisConfirmed(""); setWhy("");
        setSelectedMitigation(""); setMitigationReason("");
      }
      return true;
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "The action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const step = saved?.step ?? "MEASURE";
  const currentIndex = step === "COMPLETED" ? steps.length
    : steps.findIndex((item) => item.id === step);
  const enough = !!saved && saved.currentWindowSamples >= saved.minimumSamples;
  const selectedLabel = saved?.mitigationOptions.find(
    (option) => option.id === saved.mitigationId)?.label;

  return (
    <main className="shell">
      <header className="hero">
        <div className="topline">
          <p className="eyebrow">CHAOS ENGINEERING WORKSHOP · CHALLENGE 2 · INTERMEDIATE</p>
          <div className="header-actions">
            <button className="text-button" disabled={busy} onClick={() => {
              if (snapshot?.trafficRunning) void act("/traffic/stop").then(onBack);
              else onBack();
            }}>All Challenges</button>
            <button className="text-button" disabled={busy || !snapshot} onClick={() => {
              if (window.confirm("Reset Challenge 2? This stops traffic, reconnects Shipping, and clears all answers and results.")) void act("/reset");
            }}>Reset Challenge</button>
          </div>
        </div>
        <h1>{saved?.title ?? "Service Unavailable"}</h1>
        <p className="intro">{saved?.scenario ?? "Connecting to the local workshop…"}</p>
        {saved && <p className="objective"><strong>Goal:</strong> {saved.objective}</p>}
        <div className="status-row" aria-live="polite">
          <span className={`pill ${snapshot?.trafficRunning ? "pill-live" : ""}`}>Traffic: {snapshot?.trafficRunning ? "running" : "stopped"}</span>
          <span className={`pill ${snapshot?.shippingAvailable === false ? "pill-fault" : "pill-live"}`}>Shipping Service: {snapshot?.shippingAvailable === null ? "STATUS UNKNOWN" : snapshot?.shippingAvailable ? "AVAILABLE" : "UNAVAILABLE"}</span>
          <span className={`pill ${connected ? "pill-live" : ""}`}>Live feed: {connected ? "connected" : "connecting"}</span>
        </div>
      </header>

      <ol className="progress" aria-label="Challenge progress">
        {steps.map((item, index) => <li key={item.id}
          className={index < currentIndex ? "done" : index === currentIndex ? "active" : "locked"}
          aria-current={index === currentIndex ? "step" : undefined}>
          <span className="step-number">{index < currentIndex ? "✓" : index + 1}</span>
          <span className="step-copy"><strong>{item.label}</strong><small>{index < currentIndex ? "Completed" : index === currentIndex ? "Current step" : "Locked"}</small></span>
        </li>)}
      </ol>

      <div className="toolbar" aria-label="Traffic controls">
        <span>Normal and failure results are saved separately from the live chart.</span>
        <button disabled={busy || !snapshot || snapshot.trafficRunning || saved?.completed} onClick={() => void act("/traffic/start")}>Start Traffic</button>
        <button className="secondary" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/traffic/stop")}>Stop Traffic</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {saved && !saved.completed && <section className="work-card" aria-labelledby="challenge-2-step">
        <p className="eyebrow">STEP {currentIndex + 1} OF 5 · CURRENT STEP</p>
        <h2 id="challenge-2-step">{steps[currentIndex]?.label}</h2>
        <details className="hints"><summary>Need a hint?</summary><ul>{saved.hints.map((hint) => <li key={hint}>{hint}</li>)}</ul></details>

        {step === "MEASURE" && <div className="step-content">
          <p>Measure the normal order summary before changing the system.</p>
          <SampleProgress count={saved.currentWindowSamples} minimum={saved.minimumSamples} />
          <button disabled={busy || !snapshot?.trafficRunning || !snapshot.shippingAvailable || !enough} onClick={() => void act("/baseline/capture")}>Capture Baseline</button>
        </div>}

        {step === "HYPOTHESIS" && <form className="step-content" onSubmit={(event) => {
          event.preventDefault(); void act("/hypothesis", { text: hypothesis });
        }}>
          <label>What do you expect if Shipping becomes completely unavailable?<textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} minLength={10} required /></label>
          <button disabled={busy || hypothesis.trim().length < 10}>Save Hypothesis</button>
        </form>}

        {step === "EXPERIMENT" && <div className="step-content">
          {!saved.experimentActive ? <button className="fault-button" disabled={busy || !snapshot?.trafficRunning || snapshot.shippingAvailable !== true} onClick={() => void act("/experiment/start")}>Disconnect Shipping Service</button>
            : <><p className="callout">Shipping Service: UNAVAILABLE. Watch the real request outcomes.</p><SampleProgress count={saved.currentWindowSamples} minimum={saved.minimumSamples} /><button disabled={busy || !enough} onClick={() => void act("/experiment/capture")}>Capture Failure Results</button></>}
        </div>}

        {step === "OBSERVE" && <form className="step-content" onSubmit={(event) => {
          event.preventDefault(); void act("/observation", { whatChanged, metricsAffected,
            completeRequestFailed: completeRequestFailed === "YES", hypothesisConfirmed, why });
        }}>
          <p>Compare the two saved result sets. Shipping remains disconnected.</p>
          <ShippingSummaryTable baseline={saved.baseline} experiment={saved.experiment} validation={null} />
          <label>What changed?<textarea value={whatChanged} onChange={(event) => setWhatChanged(event.target.value)} minLength={10} required /></label>
          <label>Which metrics were affected?<textarea value={metricsAffected} onChange={(event) => setMetricsAffected(event.target.value)} minLength={10} required /></label>
          <label>Did the complete order-summary request fail?<select value={completeRequestFailed} onChange={(event) => setCompleteRequestFailed(event.target.value)} required><option value="">Choose an answer</option><option value="YES">Yes</option><option value="NO">No</option></select></label>
          <label>Was your hypothesis confirmed?<select value={hypothesisConfirmed} onChange={(event) => setHypothesisConfirmed(event.target.value)} required><option value="">Choose an answer</option><option value="YES">Yes</option><option value="PARTIALLY">Partially</option><option value="NO">No</option></select></label>
          <label>Why?<textarea value={why} onChange={(event) => setWhy(event.target.value)} minLength={10} required /></label>
          <button disabled={busy || whatChanged.trim().length < 10 || metricsAffected.trim().length < 10 || !completeRequestFailed || !hypothesisConfirmed || why.trim().length < 10}>Save Observation</button>
        </form>}

        {step === "IMPROVE" && <div className="step-content">
          <p>Choose an approach, then test it while Shipping is still unavailable.</p>
          <fieldset className="mitigation-options" disabled={busy || saved.validationActive}>
            <legend>Choose an approach</legend>
            {saved.mitigationOptions.map((option) => <label key={option.id} className={`option-card ${selectedMitigation === option.id ? "selected" : ""}`}>
              <input type="radio" name="shipping-mitigation" value={option.id} checked={selectedMitigation === option.id} onChange={() => setSelectedMitigation(option.id)} />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>)}
          </fieldset>
          <label>Why did you choose this approach?<textarea value={mitigationReason} onChange={(event) => setMitigationReason(event.target.value)} minLength={10} required /></label>
          <button disabled={busy || !selectedMitigation || mitigationReason.trim().length < 10 || saved.validationActive} onClick={() => void act("/mitigation/apply", { optionId: selectedMitigation, reason: mitigationReason })}>Apply Approach</button>
          {saved.mitigationId && <p className="callout">Applied: {selectedLabel}. Shipping is still {snapshot?.shippingAvailable ? "available — reconnect to the outage before validation" : "unavailable"}.</p>}
          {saved.mitigationId && !saved.validationActive && <button className="fault-button" disabled={busy || !snapshot?.trafficRunning || snapshot.shippingAvailable !== false} onClick={() => void act("/validation/start")}>Rerun the Same Outage</button>}
          {saved.validationActive && <><SampleProgress count={saved.currentWindowSamples} minimum={saved.minimumSamples} /><button disabled={busy || !enough || snapshot?.shippingAvailable !== false} onClick={() => void act("/validation/capture")}>Capture Post-Mitigation Results</button></>}
          {saved.validation && <><h3>Saved post-mitigation result</h3><ShippingSummaryTable baseline={saved.baseline} experiment={saved.experiment} validation={saved.validation} /></>}
          {saved.validationFeedback.length > 0 && <div className="feedback" role="status"><strong>Not improved enough yet</strong><ul>{saved.validationFeedback.map((item) => <li key={item}>{item}</li>)}</ul><p>Choose another approach and rerun the same outage.</p></div>}
          {saved.conceptFeedback.length > 0 && <div className="concept-feedback"><strong>Reflection prompts</strong><ul>{saved.conceptFeedback.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        </div>}
      </section>}

      {saved?.completed && <section className="work-card completion" aria-labelledby="challenge-2-completion">
        <p className="eyebrow">CHALLENGE COMPLETED</p>
        <h2 id="challenge-2-completion">The order summary stayed usable during the Shipping outage.</h2>
        <p>Shipping remained unavailable during both failure runs. Compare the saved results and note where the user-facing response continued without an estimate.</p>
        <ShippingSummaryTable baseline={saved.baseline} experiment={saved.experiment} validation={saved.validation} />
        <p><strong>Approach applied:</strong> {selectedLabel ?? "—"}</p>
        {saved.conceptFeedback.length > 0 && <div className="concept-feedback"><strong>Reflection prompts</strong><ul>{saved.conceptFeedback.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      </section>}

      {saved?.baseline && step !== "OBSERVE" && step !== "COMPLETED" && <section className="evidence-card"><div className="section-heading"><h2>Saved evidence</h2><span className="subtle">These windows do not change with live traffic</span></div><ShippingSummaryTable baseline={saved.baseline} experiment={saved.experiment} validation={saved.validation} /></section>}
      <LiveMetrics snapshot={snapshot} />
      <details className="technical-details"><summary>How does this work?</summary><p>The workshop sends real requests to Storefront. Storefront asks Shipping for a delivery estimate through a network proxy. Disconnecting the proxy makes that dependency unreachable without stopping the Shipping container. The saved measurements come from completed user-facing requests.</p></details>
    </main>
  );
}

function SampleProgress({ count, minimum }: { count: number; minimum: number }) {
  return <div className="sample-progress"><label htmlFor="shipping-sample-count">Measured requests: {count} / {minimum} minimum</label><progress id="shipping-sample-count" value={Math.min(count, minimum)} max={minimum} /></div>;
}
