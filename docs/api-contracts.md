# API contracts (Phase 5)

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
| `POST` | `/api/challenge-1/reset` | Restore the complete initial state |
| `GET` | `/api/slice/state` | Same live snapshot, for diagnostics |
| `GET` | `/api/slice/stream` | One `snapshot` event per second |

All challenge mutations return the current snapshot. Its top level has `trafficRunning`, `proxyAvailable`, `latencyFaultActive`, `metrics` (live 90-second data), and `challenge` (step, captured results, participant inputs, mitigation, feedback, completion). Invalid transitions return HTTP 409 with a `message`; unavailable dependencies return HTTP 502.

JSON bodies for the actions that require them:

```json
{"expectedBehavior":"Product requests will get slower","reason":"Storefront waits for Inventory"}
```

```json
{"whatChanged":"Latency increased","metricChangedMost":"P95_LATENCY","hypothesisConfirmed":"YES","why":"The delayed stock reply slowed the product response"}
```

```json
{"optionId":"short-timeout-fallback"}
```

The internal Storefront product endpoint is `GET /api/products/demo-product`; its Inventory request goes through `http://toxiproxy:8666`. The internal `PUT /internal/resilience/inventory` applies timeout, fallback, and retry settings. Neither internal endpoint is published to the host.

## Challenge 2

Challenge 2 uses the same action names under `/api/challenge-2`: `GET /api/challenge-2`, `GET /api/challenge-2/stream`, and `POST` to `/traffic/start`, `/traffic/stop`, `/baseline/capture`, `/hypothesis`, `/experiment/start`, `/experiment/capture`, `/observation`, `/mitigation/apply`, `/validation/start`, `/validation/capture`, and `/reset`.

The response has `trafficRunning`, `shippingAvailable` (`true`, `false`, or `null` when state cannot be read), `metrics`, and `challenge`. Each saved `baseline`, `experiment`, and `validation` includes average and p95 latency, success and error rates, request count, fallback count, and `shippingAvailable`. The first failure capture leaves Shipping disconnected. Validation requires it to remain disconnected at both start and capture. Reset reconnects it.

Example request bodies:

```json
{"text":"The order summary will fail if Shipping is unavailable."}
```

```json
{"whatChanged":"Shipping was unreachable and the summary failed.","metricsAffected":"The success rate dropped and errors rose.","completeRequestFailed":true,"hypothesisConfirmed":"YES","why":"Shipping was a required dependency."}
```

```json
{"optionId":"fallback","reason":"Keep the order summary usable with a fallback."}
```

The internal Storefront order endpoint is `GET /api/order-summary/demo-order`; it calls `GET /api/shipping/demo-order` through `http://toxiproxy:8667`. The internal `PUT /internal/resilience/shipping` applies its bounded timeout, fallback, and retry settings. Those endpoints are not published to the host.

## Challenge 3

Challenge 3 uses `/api/challenge-3` with `GET` for a snapshot, `GET /stream` for live `snapshot` events, and `POST` for `/traffic/start`, `/traffic/stop`, `/baseline/capture`, `/hypothesis`, `/experiment/start`, `/experiment/capture`, `/observation`, `/mitigation/apply`, `/validation/start`, `/validation/capture`, `/reflection`, and `/reset`. Every mutation returns the new snapshot; invalid transitions return HTTP 409. The snapshot includes dedicated live metrics, current proxy state, selected fault, saved baseline/failure/validation windows, settings, feedback, reflection, and completion.

Bodies for the actions that require them:

```json
{"indicators":["p95Latency","successRate"]}
```

```json
{"text":"A stock outage will cause product requests to fail.","faultId":"unavailable"}
```

```json
{"whatChanged":"The page failed during the outage.","strongestEvidence":"Success rate fell to zero.","hypothesisConfirmed":"YES","explanation":"The page waited for stock without a fallback."}
```

```json
{"settings":{"timeoutMs":400,"fallbackEnabled":true,"retries":0,"circuitBreakerEnabled":false},"reason":"Bound the wait and keep the page useful without stock information."}
```

```json
{"failureRevealed":"The stock dependency blocked the page.","mitigationAddressed":"Fallback kept product information available.","whyMoreResilient":"The page succeeds during the same stock outage."}
```

The internal Storefront endpoint is `GET /api/experiment/demo-product`; it calls Inventory through `http://toxiproxy:8668`. `PUT /internal/resilience/experiment` applies the independent settings. These internal endpoints are not published to the host.
