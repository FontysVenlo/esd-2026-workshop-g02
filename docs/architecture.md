# Architecture (Phase 6)

This is a local, single-participant system. The React UI is served at `http://localhost:8080` and forwards `/api/*` to the Workshop Controller. No business-service or Toxiproxy port is published to the host.

```text
Browser → Workshop UI → Workshop Controller → Storefront → Toxiproxy → Inventory
                           traffic + metrics      |           inventory proxy
                                                  ├────────→ Toxiproxy → Shipping
                                                  │          shipping proxy
                                                  └────────→ Toxiproxy → Inventory
                                                             experiment proxy
```

Challenge 1 generates about three real product requests per second. Storefront calls Inventory only through `inventory-proxy`, which listens on port 8666 inside the Compose network and forwards to Inventory on port 8080. Its fault adds 1500 ms of response latency. Challenge 2 independently generates about three order-summary requests per second. That Storefront endpoint calls Shipping only through `shipping-proxy`, listening on port 8667 and forwarding to Shipping on port 8080. Its fault disables the proxy, making the dependency genuinely unreachable. Challenge 3 uses an independent product endpoint and `experiment-inventory-proxy` on port 8668, also forwarding to Inventory. The controller creates all three proxies on startup. Storefront owns separate resilience settings for each path.

Each challenge has a separate traffic generator and metrics store, so its live chart and saved evidence cannot mix with another challenge. Starting Challenge 3 traffic stops Challenges 1 and 2 traffic. Each completed controller-to-Storefront request records elapsed time, success/failure, fallback use, and a measurement-window ID. The UI receives a rolling 90-second live view and chart through a one-second event stream. Capture actions freeze separate baseline, failure, and post-mitigation summaries (average, p95, success/error rate, count, fallback count). Challenges 2 and 3 also store dependency status with each summary. The rolling average is never substituted for a captured result. At most eight requests per generator may be in flight.

Challenge 1 state lives in memory and follows Measure → Hypothesis → Experiment → Observe → Improve → Completed. Baseline and hypothesis are required before fault injection. The first failure is removed after its results are captured. Validation reapplies the same fault after a mitigation is chosen. Technical completion checks use the thresholds in `challenges/challenge-1.json`; free-text answers are recorded but not semantically graded. Reset stops traffic, removes latency, restores default Storefront settings, clears all metrics and evidence, and returns to Measure. In-flight pre-reset responses are discarded from metrics by a reset generation marker.

Challenge 2 has its own state machine with the same five conceptual steps but less guidance. Its Shipping proxy remains disabled after the first failure is captured. Validation starts a new measurement window under the *same* outage, and the controller verifies the proxy is still disabled at both start and capture. Technical thresholds come from `challenges/challenge-2.json`; deterministic offline synonym matching provides reflection feedback for the written explanation. Reset stops only Shipping traffic, re-enables its proxy, removes Shipping toxics, restores default Shipping settings, and clears Challenge 2 evidence. In-flight pre-reset samples are discarded.

Challenge 3 captures baseline, fault, and validation windows using the participant's selected indicators and fault. It stores the original fault choice and verifies the real proxy state at the beginning and end of each run. Failure capture restores the connection; validation reapplies the exact same fault. Participants may combine bounded timeout, one retry, fallback, and a simple circuit breaker (opens for five seconds after three failures). Outcome thresholds come from `challenges/challenge-3.json`. Reset restores only Challenge 3's dedicated proxy and settings so it does not disrupt another challenge.

Restarting the controller loses in-memory progress. The UI is a local single-participant exercise, not a multi-user or persistent platform.

## GameDay and observability

Challenge 4 uses a separate Storefront summary path calling **both** Inventory and Shipping through dedicated Toxiproxy connections on internal ports 8669 and 8670. Neither connection is bypassed. The controller creates both connections automatically on startup. The hidden incident scenario is selected deterministically by `GAMEDAY_SCENARIO` and remains stable until configuration changes. Only the controller knows the initial fault; participants use dependency-level monitoring to diagnose it. A predefined selected fault is saved in the experiment plan and verified against actual proxy state before capture and again for validation. Reset restores both GameDay connections and settings, then clears the in-memory record.

```text
Browser → Workshop UI → Workshop Controller → Storefront
                                            ↙            ↘
                                Toxiproxy 8669        Toxiproxy 8670
                                      ↓                      ↓
                                  Inventory               Shipping

Controller and Storefront metrics → Prometheus → Grafana
```

Micrometer records completed user-facing request count, duration histogram, outcome, and fallback count for each challenge in the controller. Storefront records GameDay dependency call count, duration histogram, and outcome by dependency. Both expose `/actuator/prometheus` only inside the Compose network. Prometheus scrapes them every five seconds. Grafana is provisioned from repository files with a local Prometheus data source and a seven-panel dashboard. The workshop's own saved windows are separate from the 90-second live chart and from Prometheus's time-series views. Prometheus and Grafana are published to the host on ports 9090 and 3000, respectively; no cloud endpoint is configured.

All four challenge workflows and answers remain in controller memory. Micrometer/Prometheus counters accumulate for the lifetime of their containers even when challenge measurement windows are reset; reset clears workshop evidence but does not erase historical monitoring time series. This is expected and should be explained when reusing a laptop.
