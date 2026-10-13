# Phase 6 facilitator notes

Read the [core facilitator guide](facilitator-guide.md) for Challenges 1–3 baseline expectations, reset instructions, and troubleshooting.

## Framing and practical duration

Plan about 8–10 minutes for Challenge 1, 10–12 for Challenge 2, 12–15 for Challenge 3, and 15–18 for Mini GameDay: about 45–55 minutes in total. These are planning estimates, not minimum times or timers. Let participants choose indicators, inspect saved measurements, and justify interventions. Avoid supplying a mitigation before they have examined the first failure.

Each challenge begins with a visible assignment card. Ask participants to explain their selected health metric in Challenge 1, outage blast radius in Challenge 2, and fault magnitude plus abort condition in Challenge 3. In Challenge 4, ask for a Grafana reading (metric, dependency, approximate value/time) before accepting a diagnosis. Short structured answers are required; prose is not semantically graded.

## Mini GameDay preparation

Start with `scripts/start-workshop.bat` on Windows, or `docker compose up -d --build --wait`. Verify [workshop](http://localhost:8080), [Grafana](http://localhost:3000/d/workshop-observability/workshop-observability), and [Prometheus](http://localhost:9090) before participants arrive. Grafana's dashboard and Prometheus data source are provisioned from `observability/`; no login or setup is required. Prometheus scrapes controller and Storefront every five seconds. The dashboard shows real request rate, p95, success/error rate, dependency call p95/failures, and fallback activity. One-minute rate queries need a little traffic history before lines appear.

Select the hidden scenario with `GAMEDAY_SCENARIO=inventory-latency` (default) or `GAMEDAY_SCENARIO=shipping-unavailable` before starting Compose. Do not change this setting mid-run. The scenario is deterministic. The initial incident is revealed only by its monitoring impact; the challenge API does not return its ID. The controller injects and later removes it through dedicated local Toxiproxy connections. The participant can reproduce a bounded fault from the safe list. No external target can be entered.

For the default scenario, normal GameDay requests should succeed with low latency and no fallback. The hidden Stock incident adds about 1000 ms to the relevant dependency and user-facing response; success may remain high. For the Shipping-outage scenario, dependency failures and user-facing errors rise while the default no-fallback summary fails, often quickly. A short timeout plus fallback on the affected dependency should keep summaries successful; the same selected fault must be rerun for validation. Exact values depend on host load. Do not highlight the correct Grafana panel when introducing the incident.

The GameDay task board is **Investigate → Plan → Experiment → Analyze → Improve → Validate → Conclude**. Participants must open Grafana, select healthy signals, save normal and incident evidence, identify a supported dependency, cite monitoring evidence, define hypothesis/blast radius/abort condition, reproduce a safe fault, analyze it, justify settings, rerun the identical fault, and conclude. A wrong diagnosis is rejected with a prompt to inspect dependency-specific graphs again. Technical completion requires a successful normal window, measurable initial impact and reproduction, and measurable validation improvement. Settings are not pre-scored as a single right answer.

## Reset, offline operation, troubleshooting

At handover, click **Reset Entire Workshop** on the overview. Confirm no traffic is running; all challenge steps returned to their initial state; saved records cleared; all network connections enabled without faults; and resilience settings defaulted. Start normal requests to confirm they succeed. If reset fails, restore the unhealthy container and retry. Individual challenge resets affect only that challenge.

Prepare Docker images and build assets while Internet is available. For an offline rehearsal, stop the stack and restart with `docker compose up -d --no-build --pull never --wait`; this prevents image pulls. Runtime services, provisioning, JS/CSS, and monitoring links are local. A first-time offline `--build` requires cached Maven/npm dependencies and may not succeed.

- **Blank Grafana panels:** Confirm requests are running and wait for the five-second scrapes and one-minute rate window. Check [Prometheus targets](http://localhost:9090/targets) and `docker compose logs prometheus grafana workshop-controller storefront-service`.
- **Grafana unavailable:** Check port 3000 and `docker compose ps`. GameDay baseline is gated on opening monitoring.
- **Unknown incident cannot be captured:** Wait for 12 *completed* requests. Latency delays completions. Check controller, Storefront, and Toxiproxy health.
- **Diagnosis rejected:** Inspect dependency-specific p95 and failure-rate panels. The configured hidden scenario may not be the default.
- **Validation fails:** Compare the saved reproduction and validation columns under the identical fault. Outages need a usable fallback; slow calls need a timeout that actually bounds the wait. Retries can worsen latency.
- **Reset reports an error:** Inspect `docker compose logs workshop-controller toxiproxy storefront-service`. Restore health and retry; do not assume a partial reset succeeded.
