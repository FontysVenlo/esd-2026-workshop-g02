# API contracts (Phase 6)

The browser uses same-origin `/api` endpoints. Participants should use the UI; these contracts are for development and troubleshooting.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/workshop/status` | Connectivity and phase status |
| `GET` | `/api/challenge-1` | Current challenge, fault, traffic, and metrics snapshot |
| `POST` | `/api/challenge-1/traffic/start` | Start about three requests per second |
| `POST` | `/api/challenge-1/traffic/stop` | Stop scheduling requests |
| `POST` | `/api/challenge-1/baseline/capture` | Save the normal measurement window |
| `POST` | `/api/challenge-1/hypothesis` | Save a prediction |
| `POST` | `/api/challenge-1/experiment/start` | Apply the 1500 ms fault |
| `POST` | `/api/challenge-1/experiment/capture` | Save failure results and remove the fault |
| `POST` | `/api/challenge-1/observation` | Save a comparison and explanation |
| `POST` | `/api/challenge-1/mitigation/apply` | Apply a configured Storefront behavior |
| `POST` | `/api/challenge-1/validation/start` | Reapply the same fault |
| `POST` | `/api/challenge-1/validation/capture` | Save post-mitigation results, evaluate, and remove the fault |
| `POST` | `/api/challenge-1/conclusion` | Save evidence-based conclusion and complete the record |
| `POST` | `/api/challenge-1/reset` | Restore the complete initial state |
| `GET` | `/api/slice/state` | Same live snapshot, for diagnostics |
| `GET` | `/api/slice/stream` | One `snapshot` event per second |

All challenge mutations return the current snapshot. Its top level has `trafficRunning`, `proxyAvailable`, `latencyFaultActive`, `metrics` (live 90-second data), and `challenge` (step, captured results, participant inputs, mitigation, feedback, completion). Invalid transitions return HTTP 409 with a `message`; unavailable dependencies return HTTP 502.

JSON bodies for the actions that require them:

```json
{"metrics":["responseLatency","successRate"],"dependency":"inventory"}
```

```json
{"expectedBehavior":"Product requests will get slower","reason":"Storefront waits for Inventory"}
```

```json
{"whatChanged":"Latency increased","metricChangedMost":"P95_LATENCY","hypothesisConfirmed":"YES","why":"The delayed stock reply slowed the product response"}
```

```json
{"optionId":"short-timeout-fallback","reason":"The stock wait blocks the page.","expectedEvidence":"P95 falls while success stays high."}
```

The internal Storefront product endpoint is `GET /api/products/demo-product`; its Inventory request goes through `http://toxiproxy:8666`. The internal `PUT /internal/resilience/inventory` applies timeout, fallback, and retry settings. Neither internal endpoint is published to the host.

After successful validation, `POST /api/challenge-1/conclusion` with `{"text":"P95 fell and fallback kept product requests successful."}` completes Challenge 1.

## Challenge 2

Challenge 2 uses the same action names under `/api/challenge-2`: `GET /api/challenge-2`, `GET /api/challenge-2/stream`, and `POST` to `/traffic/start`, `/traffic/stop`, `/baseline/capture`, `/hypothesis`, `/experiment/start`, `/experiment/capture`, `/observation`, `/mitigation/apply`, `/validation/start`, `/validation/capture`, `/reflection`, and `/reset`.

The response has `trafficRunning`, `shippingAvailable` (`true`, `false`, or `null` when state cannot be read), `metrics`, and `challenge`. Each saved `baseline`, `experiment`, and `validation` includes average and p95 latency, success and error rates, request count, fallback count, and `shippingAvailable`. The first failure capture leaves Shipping disconnected. Validation requires it to remain disconnected at both start and capture. Reset reconnects it.

Example request bodies:

```json
{"indicators":["success","errors"]}
```

```json
{"text":"The order summary will fail if Shipping is unavailable."}
```

```json
{"whatChanged":"Shipping was unreachable and the summary failed.","metricsAffected":"The success rate dropped and errors rose.","completeRequestFailed":true,"hypothesisConfirmed":"YES","why":"Shipping was a required dependency.","blastRadius":"Entire order summary"}
```

```json
{"optionId":"fallback","reason":"Keep the order summary usable with a fallback."}
```

The internal Storefront order endpoint is `GET /api/order-summary/demo-order`; it calls `GET /api/shipping/demo-order` through `http://toxiproxy:8667`. The internal `PUT /internal/resilience/shipping` applies its bounded timeout, fallback, and retry settings. Those endpoints are not published to the host.

Once Challenge 2's technical validation passes, `POST /api/challenge-2/reflection` with `{"answer":"Yes"}` records the participant's blast-radius conclusion (`Yes`, `Partly`, or `No`) and completes the record.

## Challenge 3

Challenge 3 uses `/api/challenge-3` with `GET` for a snapshot, `GET /stream` for live `snapshot` events, and `POST` for `/traffic/start`, `/traffic/stop`, `/baseline/capture`, `/hypothesis`, `/experiment/start`, `/experiment/capture`, `/observation`, `/mitigation/apply`, `/validation/start`, `/validation/capture`, `/reflection`, and `/reset`. Every mutation returns the new snapshot; invalid transitions return HTTP 409. The snapshot includes dedicated live metrics, current proxy state, selected fault, saved baseline/failure/validation windows, settings, feedback, reflection, and completion.

Bodies for the actions that require them:

```json
{"indicators":["p95Latency","successRate"]}
```

```json
{"text":"A stock outage will cause product requests to fail.","faultId":"unavailable","blastRadius":"Entire product page","abortCondition":"Error rate above 50%"}
```

```json
{"whatChanged":"The page failed during the outage.","strongestEvidence":"Success rate fell to zero.","hypothesisConfirmed":"YES","explanation":"The page waited for stock without a fallback."}
```

```json
{"settings":{"timeoutMs":400,"fallbackEnabled":true,"retries":0,"circuitBreakerEnabled":false},"reason":"Bound the wait and keep the page useful without stock information.","expectedEvidence":"Success stays high and p95 falls under the same fault."}
```

```json
{"failureRevealed":"The stock dependency blocked the page.","mitigationAddressed":"Fallback kept product information available.","whyMoreResilient":"The page succeeds during the same stock outage."}
```

The internal Storefront endpoint is `GET /api/experiment/demo-product`; it calls Inventory through `http://toxiproxy:8668`. `PUT /internal/resilience/experiment` applies the independent settings. These internal endpoints are not published to the host.

## Mini GameDay and observability

`GET /api/challenge-4` returns a GameDay snapshot without the hidden scenario ID. `GET /api/challenge-4/stream` emits live snapshots. Every `POST` action returns a new snapshot: `/traffic/start`, `/traffic/stop`, `/grafana/opened`, `/baseline/capture`, `/incident/start`, `/incident/capture`, `/plan`, `/experiment/start`, `/experiment/capture`, `/analysis`, `/mitigation/apply`, `/validation/start`, `/validation/capture`, `/conclusion`, and `/reset`. Invalid transitions return HTTP 409 with a participant-facing `message`.

Example bodies:

```json
{"signals":["latency","dependencyCalls","errorRate"],"note":"Normal requests succeed with low latency."}
```

```json
{"diagnosisTarget":"inventory","metricEvidence":"Inventory p95 rose to around one second.","hypothesis":"A stock delay will raise the summary p95.","faultId":"inventory-latency-1000","blastRadius":"Entire page or summary","abortCondition":"LATENCY_3000"}
```

```json
{"settings":{"inventoryTimeoutMs":400,"inventoryFallbackEnabled":true,"shippingTimeoutMs":4000,"shippingFallbackEnabled":false,"retries":0},"reason":"Bound the stock wait.","expectedEvidence":"P95 falls and fallback responses succeed."}
```

`POST /api/workshop/reset` stops all generators, restores all five local proxy connections and default Storefront settings, and clears all challenge windows and answers. It returns `{"message":"The entire workshop is back at its starting state."}` on success.

The controller and Storefront expose real Micrometer metrics at `/actuator/prometheus` inside the Compose network. Prometheus scrapes both endpoints every five seconds; Grafana's provisioned data source reads from Prometheus. Controller metrics are tagged `challenge` and `outcome`; Storefront GameDay dependency metrics are tagged `dependency` and `outcome`. Workshop resets do not erase cumulative Prometheus counters.
