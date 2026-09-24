import { useEffect, useState } from "react";
import LiveMetrics from "./LiveMetrics";
import Challenge2App from "./Challenge2App";
import Challenge3App from "./Challenge3App";
import SummaryTable from "./SummaryTable";
import type { ChallengeStep, ExperimentSnapshot, ShippingSnapshot, SliceSnapshot } from "./types";

type WorkshopView = "overview" | "challenge-1" | "challenge-2" | "challenge-3";

function viewFromHash(): WorkshopView {
  if (window.location.hash === "#challenge-1") return "challenge-1";
  if (window.location.hash === "#challenge-2") return "challenge-2";
  if (window.location.hash === "#challenge-3") return "challenge-3";
  return "overview";
}

const progressSteps: { id: ChallengeStep; label: string }[] = [
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

async function readSnapshot(response: Response): Promise<SliceSnapshot> {
  if (!response.ok) {
    const details = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(details.message ?? `Request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<SliceSnapshot>;
}

function formatConfirmation(value: string | undefined): string {
  if (value === "YES") return "Yes";
  if (value === "PARTIALLY") return "Partially";
  if (value === "NO") return "No";
  return "—";
}

export default function App() {
  const [view, setView] = useState<WorkshopView>(viewFromHash);
  const [snapshot, setSnapshot] = useState<SliceSnapshot | null>(null);
  const [shippingOverview, setShippingOverview] = useState<ShippingSnapshot | null>(null);
  const [experimentOverview, setExperimentOverview] = useState<ExperimentSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [reason, setReason] = useState("");
  const [whatChanged, setWhatChanged] = useState("");
  const [metricChangedMost, setMetricChangedMost] = useState("");
  const [hypothesisConfirmed, setHypothesisConfirmed] = useState("");
  const [why, setWhy] = useState("");
  const [selectedMitigation, setSelectedMitigation] = useState("");

  useEffect(() => {
    const syncView = () => setView(viewFromHash());
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  useEffect(() => {
    if (view !== "overview") return;
    fetch("/api/challenge-2").then(async (response) => {
      if (response.ok) setShippingOverview(await response.json() as ShippingSnapshot);
    }).catch(() => setShippingOverview(null));
    fetch("/api/challenge-3").then(async (response) => {
      if (response.ok) setExperimentOverview(await response.json() as ExperimentSnapshot);
    }).catch(() => setExperimentOverview(null));
  }, [view]);

  function navigate(next: WorkshopView): void {
    window.location.hash = next === "overview" ? "" : next;
    setView(next);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/challenge-1")
      .then(readSnapshot)
      .then((initial) => { if (active) setSnapshot(initial); })
      .catch((reason: unknown) => {
        if (active) setConnectionError(reason instanceof Error ? reason.message : "Controller unavailable");
      });

    const stream = new EventSource("/api/slice/stream");
    stream.addEventListener("snapshot", (event) => {
      if (active) {
        setSnapshot(JSON.parse((event as MessageEvent).data) as SliceSnapshot);
        setConnected(true);
        setConnectionError(null);
      }
    });
    stream.onerror = () => { if (active) setConnected(false); };
    return () => { active = false; stream.close(); };
  }, []);

  const savedHypothesis = snapshot?.challenge.hypothesis;
  const savedObservation = snapshot?.challenge.observation;
  useEffect(() => {
    if (savedHypothesis) {
      setExpectedBehavior(savedHypothesis.expectedBehavior);
      setReason(savedHypothesis.reason);
    }
  }, [savedHypothesis?.expectedBehavior, savedHypothesis?.reason]);
  useEffect(() => {
    if (savedObservation) {
      setWhatChanged(savedObservation.whatChanged);
      setMetricChangedMost(savedObservation.metricChangedMost);
      setHypothesisConfirmed(savedObservation.hypothesisConfirmed);
      setWhy(savedObservation.why);
    }
  }, [savedObservation?.whatChanged, savedObservation?.metricChangedMost,
      savedObservation?.hypothesisConfirmed, savedObservation?.why]);
  useEffect(() => {
    if (snapshot?.challenge.mitigationId) {
      setSelectedMitigation(snapshot.challenge.mitigationId);
    }
  }, [snapshot?.challenge.mitigationId]);

  async function act(path: ActionPath, body?: object): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/challenge-1${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const next = await readSnapshot(response);
      setSnapshot(next);
      if (path === "/reset") {
        setExpectedBehavior(""); setReason(""); setWhatChanged("");
        setMetricChangedMost(""); setHypothesisConfirmed(""); setWhy("");
        setSelectedMitigation("");
      }
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : "The action failed");
    } finally {
      setBusy(false);
    }
  }

  const challenge = snapshot?.challenge;
  const step = challenge?.step ?? "MEASURE";
  const currentIndex = step === "COMPLETED" ? progressSteps.length
    : progressSteps.findIndex((item) => item.id === step);
  const enough = !!challenge && challenge.currentWindowSamples >= challenge.minimumSamples;
  const selectedLabel = challenge?.mitigationOptions.find(
    (option) => option.id === challenge.mitigationId)?.label;
  const instructionStep = step === "HYPOTHESIS" ? "HYPOTHESIZE" : step;
  const instruction = challenge?.instructions.find((item) => item.step === instructionStep);

  if (view === "overview") {
    return <main className="shell">
      <header className="hero"><p className="eyebrow">CHAOS ENGINEERING WORKSHOP</p><h1>Choose a challenge</h1><p className="intro">Measure a normal system, test a controlled failure, and improve what breaks. Each challenge is local and can be opened directly.</p></header>
      <div className="overview-grid">
        <section className="challenge-card"><p className="eyebrow">CHALLENGE 1 · GUIDED</p><h2>Network Latency</h2><p>Investigate a slow Inventory Service.</p><span className="challenge-state">{snapshot?.challenge.completed ? "Completed" : "Available"}</span><button onClick={() => navigate("challenge-1")}>Open Challenge 1</button></section>
        <section className="challenge-card"><p className="eyebrow">CHALLENGE 2 · INTERMEDIATE</p><h2>Service Unavailable</h2><p>Investigate an unavailable Shipping Service.</p><span className="challenge-state">{shippingOverview?.challenge.completed ? "Completed" : "Available"}</span><button onClick={() => navigate("challenge-2")}>Open Challenge 2</button></section>
        <section className="challenge-card"><p className="eyebrow">CHALLENGE 3 · ADVANCED</p><h2>Independent Experiment</h2><p>Choose a stock-service fault and test your own resilience settings.</p><span className="challenge-state">{experimentOverview?.challenge.completed ? "Completed" : "Available"}</span><button onClick={() => navigate("challenge-3")}>Open Challenge 3</button></section>
      </div>
    </main>;
  }

  if (view === "challenge-2") {
    return <Challenge2App onBack={() => navigate("overview")} />;
  }
  if (view === "challenge-3") {
    return <Challenge3App onBack={() => navigate("overview")} />;
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="topline">
          <p className="eyebrow">CHAOS ENGINEERING WORKSHOP · CHALLENGE 1</p>
          <div className="header-actions"><button className="text-button" disabled={busy} onClick={() => {
            if (snapshot?.trafficRunning) void act("/traffic/stop").then(() => navigate("overview"));
            else navigate("overview");
          }}>All Challenges</button><button className="text-button" disabled={busy || !snapshot} onClick={() => {
            if (window.confirm("Reset Challenge 1? This stops traffic, removes the fault, restores normal behavior, and clears all answers and results.")) void act("/reset");
          }}>Reset Challenge</button></div>
        </div>
        <h1>{challenge?.title ?? "Slow Inventory Service"}</h1>
        <p className="intro">{challenge?.scenario ?? "Connecting to the local workshop…"}</p>
        <div className="status-row" aria-live="polite">
          <span className={`pill ${snapshot?.trafficRunning ? "pill-live" : ""}`}>Traffic: {snapshot?.trafficRunning ? "running" : "stopped"}</span>
          <span className={`pill ${snapshot?.latencyFaultActive ? "pill-fault" : ""}`}>Latency fault: {snapshot?.proxyAvailable === false ? "experiment unavailable" : snapshot?.latencyFaultActive ? "active · 1500 ms" : "off"}</span>
          <span className={`pill ${connected ? "pill-live" : ""}`}>Live feed: {connected ? "connected" : "connecting"}</span>
        </div>
      </header>

      <ol className="progress" aria-label="Challenge progress">
        {progressSteps.map((item, index) => (
          <li key={item.id} className={index < currentIndex ? "done" : index === currentIndex ? "active" : "locked"} aria-current={index === currentIndex ? "step" : undefined}>
            <span className="step-number">{index < currentIndex ? "✓" : index + 1}</span>
            <span className="step-copy"><strong>{item.label}</strong><small>{index < currentIndex ? "Completed" : index === currentIndex ? "Current step" : "Locked"}</small></span>
          </li>
        ))}
      </ol>

      <div className="toolbar" aria-label="Traffic controls">
        <span>Traffic makes the system measurable.</span>
        <button disabled={busy || !snapshot || snapshot.trafficRunning || challenge?.completed} onClick={() => void act("/traffic/start")}>Start Traffic</button>
        <button className="secondary" disabled={busy || !snapshot?.trafficRunning} onClick={() => void act("/traffic/stop")}>Stop Traffic</button>
      </div>

      {(connectionError || actionError) && <p className="error" role="alert">{actionError ?? connectionError}</p>}

      {challenge && !challenge.completed && (
        <section className="work-card" aria-labelledby="step-title">
          <p className="eyebrow">STEP {currentIndex + 1} OF 5 · CURRENT STEP</p>
          <h2 id="step-title">{instruction?.title ?? progressSteps[currentIndex]?.label}</h2>
          <p className="guidance">{instruction?.body}</p>

          {step === "MEASURE" && (
            <div className="step-content">
              <p>Start traffic, watch normal latency and successful responses, then capture at least {challenge.minimumSamples} completed requests. This saved snapshot is your steady state for comparison.</p>
              <SampleProgress count={challenge.currentWindowSamples} minimum={challenge.minimumSamples} />
              <button disabled={busy || !snapshot?.trafficRunning || !enough || !snapshot.proxyAvailable} onClick={() => void act("/baseline/capture")}>Capture Baseline</button>
            </div>
          )}

          {step === "HYPOTHESIS" && (
            <form className="step-content" onSubmit={(event) => {
              event.preventDefault();
              void act("/hypothesis", { expectedBehavior, reason });
            }}>
              <p>A useful hypothesis predicts a measurable change and names the dependency that causes it. You must save it before the failure can be injected.</p>
              <p className="sentence-template">If the Inventory Service becomes 1500 ms slower, I expect…</p>
              <label>Expected behavior or metric<textarea value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} placeholder="For example: the product response time will increase" required /></label>
              <label>Because<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: Storefront waits for Inventory before replying" required /></label>
              <button disabled={busy || !expectedBehavior.trim() || !reason.trim()}>Save Hypothesis</button>
            </form>
          )}

          {step === "EXPERIMENT" && (
            <div className="step-content">
              <p>The workshop will delay replies from Inventory by {challenge.latencyMs} ms. Compare the measured results with your saved baseline; watch for the fault marker in the live chart.</p>
              {!challenge.experimentActive ? (
                <button className="fault-button" disabled={busy || !snapshot?.trafficRunning || !snapshot.proxyAvailable} onClick={() => void act("/experiment/start")}>Inject {challenge.latencyMs} ms Latency</button>
              ) : (
                <>
                  <p className="callout">Experiment active. Keep traffic running until enough delayed requests complete.</p>
                  <SampleProgress count={challenge.currentWindowSamples} minimum={challenge.minimumSamples} />
                  <button disabled={busy || !enough} onClick={() => void act("/experiment/capture")}>Capture Experiment Results</button>
                  <p className="hint">Capturing removes the fault so the same failure can be rerun after mitigation.</p>
                </>
              )}
            </div>
          )}

          {step === "OBSERVE" && (
            <form className="step-content" onSubmit={(event) => {
              event.preventDefault();
              void act("/observation", { whatChanged, metricChangedMost, hypothesisConfirmed, why });
            }}>
              <p>Compare the saved baseline with the saved failure window. The rolling chart still shows recent activity, but these captured values are the evidence for this step.</p>
              <SummaryTable baseline={challenge.baseline} experiment={challenge.experiment} validation={null} />
              <label>What changed?<textarea value={whatChanged} onChange={(event) => setWhatChanged(event.target.value)} placeholder="Describe the change you observed" required /></label>
              <label>Which metric changed most?<select value={metricChangedMost} onChange={(event) => setMetricChangedMost(event.target.value)} required><option value="">Choose a metric</option><option value="AVERAGE_LATENCY">Average latency</option><option value="P95_LATENCY">p95 latency</option><option value="SUCCESS_RATE">Success rate</option></select></label>
              <label>Was your hypothesis confirmed?<select value={hypothesisConfirmed} onChange={(event) => setHypothesisConfirmed(event.target.value)} required><option value="">Choose an answer</option><option value="YES">Yes</option><option value="PARTIALLY">Partially</option><option value="NO">No</option></select></label>
              <label>Why?<textarea value={why} onChange={(event) => setWhy(event.target.value)} placeholder="Explain what the measurements tell you" required /></label>
              <button disabled={busy || !whatChanged.trim() || !metricChangedMost || !hypothesisConfirmed || !why.trim()}>Save Observation</button>
            </form>
          )}

          {step === "IMPROVE" && (
            <div className="step-content">
              <p>Choose a response to a slow Inventory Service. Apply it to the real Storefront, then rerun the same {challenge.latencyMs} ms fault. A useful product response can say that stock information is temporarily unavailable.</p>
              <fieldset className="mitigation-options" disabled={busy || challenge.validationActive}>
                <legend>Choose a mitigation</legend>
                {challenge.mitigationOptions.map((option) => (
                  <label key={option.id} className={`option-card ${selectedMitigation === option.id ? "selected" : ""}`}>
                    <input type="radio" name="mitigation" value={option.id} checked={selectedMitigation === option.id} onChange={() => setSelectedMitigation(option.id)} />
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  </label>
                ))}
              </fieldset>
              <button disabled={busy || !selectedMitigation || challenge.validationActive} onClick={() => void act("/mitigation/apply", { optionId: selectedMitigation })}>Apply Mitigation</button>
              {challenge.mitigationId && <p className="callout">Applied in Storefront: {selectedLabel}. The next run uses the same Inventory latency fault.</p>}
              {challenge.mitigationId && !challenge.validationActive && <button className="fault-button" disabled={busy || !snapshot?.trafficRunning || !snapshot.proxyAvailable} onClick={() => void act("/validation/start")}>Rerun the 1500 ms Experiment</button>}
              {challenge.validationActive && <><p className="callout">Validation experiment active. Watch whether Storefront remains responsive.</p><SampleProgress count={challenge.currentWindowSamples} minimum={challenge.minimumSamples} /><button disabled={busy || !enough} onClick={() => void act("/validation/capture")}>Capture Post-Mitigation Results</button></>}
              {challenge.validation && <><h3>Saved post-mitigation result</h3><SummaryTable baseline={challenge.baseline} experiment={challenge.experiment} validation={challenge.validation} /></>}
              {challenge.validationFeedback.length > 0 && <div className="feedback" role="status"><strong>Not improved enough yet</strong><ul>{challenge.validationFeedback.map((item) => <li key={item}>{item}</li>)}</ul><p>Choose another mitigation, apply it, and rerun the same experiment.</p></div>}
            </div>
          )}
        </section>
      )}

      {challenge?.completed && (
        <section className="work-card completion" aria-labelledby="completion-title">
          <p className="eyebrow">CHALLENGE COMPLETED</p>
          <h2 id="completion-title">You measured, tested, improved, and validated the system.</h2>
          <p>The same 1500 ms Inventory delay was applied before and after your mitigation. Compare the three saved measurements below to see the failure and the improvement.</p>
          <SummaryTable baseline={challenge.baseline} experiment={challenge.experiment} validation={challenge.validation} />
          <div className="completion-notes"><p><strong>Hypothesis confirmed:</strong> {formatConfirmation(challenge.observation?.hypothesisConfirmed)}</p><p><strong>Mitigation applied:</strong> {selectedLabel ?? "—"}</p></div>
        </section>
      )}

      {challenge?.baseline && step !== "OBSERVE" && step !== "COMPLETED" && (
        <section className="evidence-card"><div className="section-heading"><h2>Saved evidence</h2><span className="subtle">Captured windows are separate from the live chart</span></div><SummaryTable baseline={challenge.baseline} experiment={challenge.experiment} validation={challenge.validation} /></section>
      )}

      <LiveMetrics snapshot={snapshot} />
      <details className="technical-details"><summary>How does this work?</summary><p>The workshop sends real requests to Storefront, which asks Inventory for stock information. A network proxy called Toxiproxy adds the delay between those services. The workshop measures completed requests and saves separate result sets for each experiment.</p></details>
    </main>
  );
}

function SampleProgress({ count, minimum }: { count: number; minimum: number }) {
  return <div className="sample-progress"><label htmlFor="sample-count">Measured requests: {count} / {minimum} minimum</label><progress id="sample-count" value={Math.min(count, minimum)} max={minimum} /></div>;
}
