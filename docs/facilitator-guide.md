# Facilitator guide: Challenges 1, 2, and 3

## Start and framing

From the repository root, run `docker compose up --build`, then open **http://localhost:8080**. The exercise is local and single-participant. Guide participants through **Measure → Hypothesis → Experiment → Observe → Improve**; let them predict before they inject the fault. The [participant guide](participant-guide.md) can be shared directly.

## Expected behavior

| Saved measurement | Expected observation | Why |
| --- | --- | --- |
| Baseline | Low latency, usually a few to tens of milliseconds; requests succeed; fallback count 0 | Inventory replies normally. |
| Failure | Roughly baseline + 1500 ms, often about 1500–1600 ms; requests usually still succeed | Storefront waits for delayed Inventory. The default timeout is 4000 ms. |
| Failure with mitigation | Roughly 400 ms, successful product responses, nonzero fallback count | A 400 ms timeout ends the wait and returns product details with stock marked temporarily unavailable. |

Actual timings depend on the host. The important comparison is the *captured* p95 and average across the three windows. The live rolling average mixes recent phases for up to 90 seconds, so it should not be used to judge the experiment. At least 15 completed requests are required in each captured window. Give the delayed run several seconds for those requests to finish.

The intended mitigation concept is a **short timeout plus graceful fallback**, not a long wait or extra retries. The fallback keeps the product response useful but does not invent stock availability. The configured technical completion checks require the failure p95 to exceed baseline by at least 1000 ms, post-mitigation p95 no more than 700 ms, at least 98% successful post-mitigation requests, at least 50% p95 improvement over the failure run, and at least one fallback response. Free-text hypothesis and observation fields are required but are not semantically graded.

## Reset and repeat

Click **Reset Challenge** and confirm. Verify Step 1 is current; traffic is stopped; the latency fault is off; saved baseline, failure, and post-mitigation values show no results; answers and completion are cleared; and live metrics/chart are empty. Start Traffic again and confirm low latency, successful requests, and no fallback responses before capturing another baseline. Reset also restores the default Storefront timeout (4000 ms), with fallback disabled and no retries. It does not require restarting Docker.

## Troubleshooting

- **Page unavailable:** Check `docker compose ps`; wait for the initial build/start to finish, then refresh `http://localhost:8080`. Port 8080 must be free.
- **Traffic runs but no successful samples:** Check `docker compose logs workshop-controller storefront-service inventory-service toxiproxy`. The Storefront-to-Inventory proxy is configured automatically when the controller starts; a failed controller startup or unhealthy dependency can prevent requests.
- **Capture button disabled:** Keep traffic running and wait for 15 *completed* requests in the current step. A delayed request is counted only when it finishes. Confirm the fault state shown at the top matches the step.
- **Numbers do not match exactly:** Compare saved measurement columns, not the 90-second rolling average. Host load can move timings; expect an approximately 1500 ms increase and approximately 400 ms fallback rather than exact values.
- **Mitigation does not pass:** Check that the short-timeout/fallback option was applied before rerunning the failure, then inspect the feedback and fallback count. Reapply another option and rerun if needed.
- **Unexpected old progress or fault state:** Use **Reset Challenge** and verify the initial state above. If reset reports a service error, inspect the Compose logs, restore the unhealthy service, and retry reset; do not assume a failed reset completed.

## Challenge 2: Service Unavailable

Challenge 2 takes about 15 minutes and gives only a scenario, goal, two optional hints, and the familiar five-step progress strip. Do not reveal the mitigation before participants capture and interpret the first failure. The user-facing order-summary request calls Shipping through its own Toxiproxy connection; the controller disables that connection rather than stopping the Shipping container.

| Saved measurement | Expected observation |
| --- | --- |
| Baseline | Shipping available; low latency, near-100% success, near-0% errors, no fallback. |
| Shipping unavailable | Shipping status unavailable; the default order summary returns errors (typically HTTP 502), often quickly. Success should fall near 0%, even if latency does not rise. |
| Unavailable with mitigation | Shipping still unavailable; near-100% user-facing success, nonzero fallback count, and low response latency. The order summary explicitly says the delivery estimate is unavailable. |

An acceptable mitigation lets the order summary continue without an estimate. The configured **fallback** and **retry-then-fallback** options can meet that goal. Waiting longer or retrying without fallback does not make an unavailable service reachable. Retries are capped at one additional attempt in the offered options; no circuit breaker is included because the primary lesson is graceful degradation. A quick failure is expected when the proxy is disabled, so error rate and usability matter more than a latency increase.

The technical completion checks in `challenges/challenge-2.json` require at least 15 requests per saved window, a successful normal baseline, a clearly failing first outage, at least 98% success with mitigation, post-mitigation p95 at most 700 ms, and at least one fallback response. The controller checks that Shipping is still unavailable both when validation starts and when its results are captured. The same fault is rerun in a new window. Offline synonym groups assess the participant's explanation and produce reflection prompts; a genuinely usable technical result is still required for completion.

To reset, click **Reset Challenge**. Confirm traffic stopped, Shipping **AVAILABLE**, saved windows and answers cleared, Step 1 current, and completion cleared. Start traffic again and verify normal order-summary success with no fallback. Reset re-enables Shipping, removes any Shipping toxics, and restores the default Shipping settings. It does not reset Challenge 1.

If baseline fails, inspect `docker compose logs workshop-controller storefront-service shipping-service toxiproxy` and verify Shipping is available. If the outage does not lower success, ensure the default no-fallback setting was restored with Reset and repeat. If validation is blocked, Shipping may have been reconnected; Reset and rerun the experiment. If fallback count is zero, check the selected approach and that the outage is still active. Compare saved windows, not the live rolling average.

Challenge state and measurements are in memory. Restarting the controller discards progress.

## Challenge 3: Independent experiment

Do not suggest a control combination before participants have captured and interpreted their fault run. The participant chooses steady-state indicators, one stock-service fault, and a resilience configuration. The workshop uses a dedicated Storefront → Inventory connection for Challenge 3, so its fault and settings do not overwrite accepted Challenges 1 and 2. The fault choice is immutable during the run and is reapplied for validation.

| Fault | Expected first failure | A useful post-mitigation outcome |
| --- | --- | --- |
| 500/1000/1500 ms latency | P95 increases roughly by the selected delay; requests usually still succeed under the 4000 ms default timeout. | A shorter timeout with fallback can restore responsiveness; compare saved P95 with the failure window. |
| Stock service unavailable | Product requests fail (usually quickly); success falls near 0%. | Fallback keeps the product page usable without claiming to know current stock; success and fallback count rise. |

The configurable rules in `challenges/challenge-3.json` require at least 12 samples per captured window, at least 95% baseline success, a measurable delay or outage, and at least 95% validation success. For latency, validation P95 must improve by at least 25% versus the fault run. For unavailability, validation P95 must be at most 750 ms and fallback count nonzero. These are outcome checks, not exact-choice checks. A 500 ms fault may call for the 250 ms timeout to meet the improvement target; retrying a delayed call may hurt P95. Host timing varies.

After validation succeeds, the participant must answer three reflection prompts before completion. Reset Challenge 3 to verify traffic stopped, normal stock connection restored, default 4000 ms timeout, fallback off, zero retries, circuit breaker off, all saved/live metrics and answers cleared, and Step 1 current. Start traffic and verify low baseline latency and successful product requests. If the first baseline fails, inspect `docker compose logs workshop-controller storefront-service inventory-service toxiproxy`. If a capture is blocked, allow 12 *completed* requests in that specific window. If validation fails, read its outcome feedback and compare saved windows rather than the rolling chart. Restarting the controller loses in-memory progress.
