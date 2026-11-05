# Chaos Engineering workshop: walkthrough and cheatsheet

This covers the active **Northstar Supply field workshop** in `field-workshop/`. Work through the four challenges at [the workshop overview](http://localhost:8088). The goal is to demonstrate, with measurements, how a dependency fault affects customers and whether your mitigation improves the experience.

Expected outcomes below are predictions from the implementation, **not measured results to submit**. Record your own numbers and time windows.

## Quick reference

| Open | Purpose |
| --- | --- |
| [Workshop overview](http://localhost:8088) | Read challenges, fill notes, submit, unlock the next challenge |
| [Storefront](http://localhost:8088/storefront) | Exercise the customer journey and see the last action's browser latency |
| [Network Faults](http://localhost:8089) | Delay or disconnect Inventory/Shipping; clear faults |
| [Grafana](http://localhost:3008/d/field-workshop/field-workshop) | Compare customer latency/success, dependency outcomes, and fallbacks |
| [Prometheus](http://localhost:9098) | Run the queries below; check [scrape targets](http://localhost:9098/targets) |
| [Fallbacks & timeouts](http://localhost:8089/#mitigations) | Enable fallbacks, edit timeouts, and restore defaults without a terminal |
| [Commands page](http://localhost:8088/tools) | Optional Windows and Mac API examples |

**The loop for every challenge:** baseline -> hypothesis + abort condition -> inject one fault -> measure -> remove fault -> mitigate -> repeat the identical fault -> compare -> clean up -> submit notes.

## 1. Understand the system

```text
Browser / light traffic generator
              |
          Storefront
              |
          Toxiproxy
           /     \
     Inventory  Shipping

Prometheus scrapes application metrics -> Grafana displays them
```

Toxiproxy sits on the real network paths. It can delay replies or disconnect a path without changing the dependency's business code. Prometheus collects metrics every five seconds. Grafana displays those collected measurements.

| Customer API | Dependencies | What a fault can affect |
| --- | --- | --- |
| `GET /api/product` | Inventory | Stock information and product API response |
| `GET /api/order-preview` | Inventory + Shipping, called concurrently | Stock and shipping information in the preview |

The product's name and base price are local to Storefront, but a failed Inventory call can still make the whole product API fail. A Shipping fault should affect the preview while the product API remains usable. Merely loading the HTML page does not establish that its API calls work.

Default dependency timeout: **3000 ms each**. Default fallback: **off for both dependencies**. A dependency timeout produces HTTP **504**; another dependency failure produces **503**. A successful fallback produces **200** with `degraded: true`.

All three products share two Storefront workers and a complete-catalog response. The lamp branches are faultable; chair and desk use healthy branches to the same Inventory/Shipping services. A slow lamp can consume the workers, causing healthy products to queue or be rejected (queue wait limit: 1000 ms; queue capacity: 12). A missing lamp result can reject the complete catalog. Use `/api/catalog` for availability and `/api/catalog?preview=true` for delivery. `/api/system` reports real worker/queue/circuit state. Individual APIs accept `?sku=LAMP-01`, `?sku=CHAIR-02`, or `?sku=DESK-03`.

Enabling a fallback also enables a per-product/dependency **circuit breaker**. After failure it pauses that path for five seconds, then admits one recovery probe. A **timeout** limits how long Storefront waits. A **fallback** defines what it returns when the call fails. Inventory fallback returns unconfirmed stock (`available: null`, `quantity: null`). Shipping fallback returns unavailable quote information (`priceEur: null`, `etaDays: null`). Neither repairs the dependency. The system only previews an order; it never places one.

## 2. Start and prepare

Start Docker Desktop. From the repository root, double-click **start.bat** on Windows, or **start.command** on Mac. If using the distributed ZIP, extract it fully before launching the same files from the extracted folder.

For one-command startup from the repository root, run `.\start.bat` on Windows or `bash ./start.command` on Mac. This starts the full stack plus light traffic and opens all five workshop websites in your default browser.

All four challenges can be completed in the browser on Windows and Mac. In Network Faults, use **Fault injection** to create the problem and **Fallbacks & timeouts** to change the shop's response. The **Info & commands** tab has a platform selector for optional command examples.

For optional maintainer commands only, open PowerShell at the repository root and enter the workshop directory **once**:

```powershell
Set-Location .\field-workshop
```

Alternatively, start manually from that directory:

```powershell
docker compose --profile load up --build -d
docker compose ps
```

The supplied load generator sends five requests per second (three lamp requests and one each for chair and desk) across both customer APIs. Keep that load consistent across comparisons. Do not increase it for this assignment.

Before each challenge:

1. Confirm both faultable lamp proxy paths are connected and have no active faults, except the intentionally seeded incident in Challenge 3.
2. In Fallbacks & timeouts, click **Restore default settings**.
3. Try both customer actions and check Prometheus targets: Storefront, Inventory, Shipping should be `UP`.
4. Collect a healthy baseline. A practical choice is **60-90 seconds per stable phase**, with the same duration for each comparison. This is a suggested method, not a required course threshold.
5. Write down the route, metric, prediction, and an abort condition **before** injecting a fault.

An abort condition must be observable. Example: "Stop if the product route returns errors continuously for 15 seconds, or an unrelated route becomes unavailable." Choose a condition compatible with the intended experiment: preview errors are expected during the Shipping outage. There is **no automatic abort**; you must remove the fault yourself.

## 3. Challenge 1: One slow product blocks the shop

**Question:** Can you keep the healthy chair and desk available while temporarily disabling an unconfirmed lamp availability check?

1. **Measure the healthy catalog.** Use “Refresh all availability”. Record all three stock results, catalog time, workers, queue size and the starting rejected count. In Grafana inspect “Product p95 latency” and “Shared workers and queue”. Predict which products can be affected despite having healthy dependency branches; state an abort condition.

2. **Create a lamp-only slowdown.** Apply +1500 ms to Inventory in Network Faults. Keep supplied traffic unchanged and refresh the catalog. Record lamp delay, chair/desk queue time or failures, catalog status, and the change in rejected requests over a fresh window. The slow request consumes actual shared workers; the indicators are measured state.

3. **Trace the propagation.** Compare “Dependency p95 latency”, “Product p95 latency”, “Shared workers and queue”, and “Capacity rejection rate”. Explain the path: lamp Inventory delay → occupied workers → healthy products waiting/rejected, plus the catalog waiting for every product. A queue can fluctuate; use a full window.

4. **Apply containment.** Remove the fault first. Open Fallbacks & timeouts and use Challenge 1 settings. This applies a 400 ms Inventory timeout and enables fallback plus the product/dependency circuit breaker. Predict the distinct effect of each mechanism.

5. **Repeat the same fault and verify recovery.** Reapply the identical +1500 ms Inventory delay. Refresh several times, including within and after a 5-second cooldown. Compare chair/desk live results, queue pressure, rejection-rate changes, catalog latency, and lamp stock uncertainty. The lamp availability action should be disabled while stock is unconfirmed. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**Interpretation:** Healthy: all three product branches answer quickly and the complete catalog is live. Record actual local timings. With +1500 ms on the lamp Inventory branch, repeated lamp requests can exceed two workers of capacity. Chair/desk requests wait or are rejected even though their own dependency paths are healthy. A complete catalog also waits for or fails on one missing result. With a 400 ms timeout, a failed lamp call releases its worker sooner. The circuit breaker then skips that product/dependency path for 5 seconds; the fallback returns unknown stock instead of rejecting the entire catalog. Chair and desk can return live information. Expect a probe and possible short latency spike every cooldown while the fault persists. HTTP 200 is not confirmed lamp stock. Remove the fault and restore defaults; verify all three recover.

## 4. Challenge 2: One missing quote breaks the catalog

**Question:** Can one unavailable lamp quote be contained to that quote instead of taking down the complete delivery catalog?

1. **Compare both healthy catalog views.** Refresh availability, then preview all deliveries. Record all three results, timings, queue state and an abort condition. Predict why Shipping affects one view but not the other.

2. **Disconnect only lamp Shipping.** Choose Shipping → Disconnect. Repeat both views. Record the failed whole-catalog response, the working availability view, and Shipping failures. Do not claim worker exhaustion if the queue stays empty.

3. **Identify the coupling.** Inspect “Customer request rate”, “Dependency outcomes” and worker indicators. Explain why one rejected quote prevents the aggregate catalog from returning its healthy products. Distinguish this from Challenge 1’s shared-capacity slowdown.

4. **Allow an honest partial catalog.** Reconnect Shipping first, then apply Challenge 2 settings in Fallbacks & timeouts. Shipping fallback and its 5-second circuit breaker are enabled; the timeout stays 3000 ms because disconnection fails immediately. Stock is still authoritative.

5. **Repeat and measure the smaller impact.** Disconnect Shipping again. Preview all deliveries: the catalog should return all three products, chair/desk with live quotes, and the lamp with an unavailable quote. Compare statuses, useful information and fallback activity. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**Interpretation:** Without mitigation, a missing lamp quote rejects /api/catalog?preview=true. Availability still works because it does not call Shipping. Shipping fallback converts the missing lamp quote into an explicit unavailable value. The complete delivery catalog returns useful live chair/desk information and lamp stock; it never invents a lamp delivery price or date. The circuit breaker skips repeated lamp Shipping failures for 5 seconds and probes afterward. This outage primarily demonstrates error containment; queue pressure may stay low. Reconnect, restore defaults and confirm live information for all products. Compare equivalent observation windows.

## 5. Challenge 3: Investigate a spreading incident

**Question:** Which lamp dependency is faulty, how does its impact spread to healthy products, and which mitigation contains that mechanism?

1. **Arrange one hidden incident.** From a clean baseline, ask a partner to seed Assignment 3. Leave the exact fault secret and keep supplied traffic fixed. Write an abort condition.

2. **Collect the customer symptoms.** Compare availability and delivery catalog views. Record catalog times/statuses, chair/desk usefulness, active workers, queue state, and the rejected-count change with timestamps. Leave fault controls unopened.

3. **Write a supported diagnosis.** Use dependency outcomes/latency, product latency, and worker/queue charts. Predict the faulty dependency and whether the impact spreads through shared capacity, aggregate failure, or both. Record an alternative explanation before inspecting controls.

4. **Confirm and contain the mechanism.** Inspect Network Faults with the facilitator after recording your hypothesis. Apply a justified timeout/fallback setting. For slow calls use a short timeout plus fallback/breaker; for immediate disconnection use an honest partial quote. Preserve the exact original fault.

5. **Validate the healthy products and reveal.** Retest the same catalog views and fresh windows. Compare healthy product usefulness, queue pressure, catalog time/status and the affected product’s uncertainty. Ask for the reveal and compare it with your hypothesis. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**Interpretation:** Slow Inventory can increase latency in both catalog views and occupy shared workers. Chair/desk latency or rejection signals can worsen despite healthy dependency branches. Disconnected lamp Shipping should fail delivery aggregation but leave availability working. It can fail fast without filling the worker queue. A short timeout bounds slow worker occupancy; the breaker pauses repeated failed product calls; fallback preserves honest partial catalog results. Choose the combination supported by the evidence. Validate under the same fault and traffic. State which signals improved and which information remains unavailable, then restore and verify all products.

## 6. Challenge 4: Your containment GameDay

**Question:** Can you reproduce a wider customer impact and then contain it to the affected product’s missing information?

1. **Define a propagation hypothesis.** Name the catalog view, lamp dependency, exact fault/magnitude, healthy comparison products, propagation mechanism and abort condition. Choose customer results and worker/product metrics that could disprove your hypothesis.

2. **Record a healthy comparison window.** Measure all three products, catalog latency/status, worker queue and changes in cumulative rejections over a fixed window. Keep supplied traffic unchanged for every phase.

3. **Reproduce impact beyond the lamp.** Apply only your chosen fault. Measure the same view and healthy products. Record whether impact spreads by queuing, rejection, aggregate failure or a combination. If no wider effect appears, report that honestly and revise the experiment before recommending mitigation.

4. **Choose a mechanism-specific mitigation.** Remove the fault before configuring. Use a short dependency timeout for a slow call, enable fallback/breaker for the relevant dependency, and justify the missing-data behavior. Do not claim fallback alone releases workers.

5. **Repeat exactly and recommend.** Reapply the identical fault at the same magnitude and traffic. Show whether chair/desk remain useful, whether catalog status/time improves, and what lamp information remains unavailable. Include probe behavior and exact rollback instructions. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**Interpretation:** There is no single correct experiment. It needs healthy, faulted and mitigated phases, the exact same fault/traffic, a wider customer impact and an honest remaining trade-off. Example: +1500 ms on lamp Shipping during delivery catalog refresh. Default waiting can consume shared workers and delay the aggregate. Set a 400 ms Shipping timeout with fallback/breaker, then repeat the exact delay. Chair and desk should retain live stock/quotes while the lamp quote becomes unavailable. The breaker probes every 5 seconds and may cause short spikes. Compare queue pressure and rejection-rate changes, not lifetime totals. If your chosen fault causes only aggregate failure and no capacity pressure, state that distinction. Finish with verified live results for all three products.

## 7. Read the monitoring correctly

Start with the Storefront catalog time/status and healthy chair/desk results. In Grafana compare **Product p95 latency**, **Shared workers and queue**, **Capacity rejection rate**, and **Open product dependency circuits**. Product latency includes queue time; backend dependency latency does not. Rejected counts are cumulative: compare their change over equal windows. After clearing a fault, allow a five-second breaker cooldown or restore defaults; a recovery probe can produce a short spike. A fast disconnection may show no queue pressure while still failing the aggregate delivery catalog.

| Signal | Meaning and caveat |
| --- | --- |
| Request rate | Requests per second; use it to check comparable traffic |
| Success rate | Fraction of HTTP 2xx responses; fallback can improve this while data remains incomplete |
| p95 latency | Approximate time at/below which 95% of requests complete; includes failed requests in this implementation |
| Dependency outcomes | Calls ending in success, timeout, or other failure, as seen by Storefront |
| Fallback activity | How often Storefront substitutes honest unavailable/unconfirmed information |
| Blast radius | Which customer routes or information are affected |

Grafana's panels use a rolling **one-minute `rate()` window**. After changing state, allow a full fresh minute plus scrape time before recording a stable comparison. Initial panels may need two scrapes before showing anything. Use phase timestamps or an absolute time range to distinguish historical impact from the current state.

Storefront recreation resets its in-memory counters. Compare rates or windowed increases rather than subtracting raw totals across a restart. Series are created on first use: an absent fallback series can mean no fallback has happened yet. In the provided dashboard, a route with no recorded 2xx series can show a missing success-rate line rather than zero; confirm status outcomes directly.

Paste these into the [Prometheus expression browser](http://localhost:9098):

```promql
# Requests/second by route and status
sum by (route, status) (rate(workshop_http_requests_total{service="storefront"}[1m]))

# Customer p95, in seconds
histogram_quantile(0.95, sum by (le, route) (rate(workshop_http_request_duration_seconds_bucket{service="storefront"}[1m])))

# Dependency p95, in seconds, measured from Storefront
histogram_quantile(0.95, sum by (le, dependency) (rate(workshop_dependency_duration_seconds_bucket{service="storefront"}[1m])))

# Dependency outcomes/second
sum by (dependency, outcome) (rate(workshop_dependency_calls_total{service="storefront"}[1m]))

# Fallbacks/second
sum by (dependency) (rate(workshop_fallbacks_total{service="storefront"}[1m]))

# Approximate dependency timeout/failure counts over a one-minute phase
sum by (dependency, outcome) (increase(workshop_dependency_calls_total{service="storefront",outcome=~"timeout|failure"}[1m]))
```

`rate()` is per second, not a count. `increase()` estimates counts over the selected range and may return fractional values due to extrapolation. Convert seconds to milliseconds by multiplying by 1000. To calculate a route's success percentage, divide its 2xx request rate by its total request rate and multiply by 100; explicitly check error-only routes when a success series is absent.

## 8. Browser cleanup and optional technical checks

The browser controls are sufficient for experiments and cleanup. The following PowerShell checks are optional. Run Compose commands from `field-workshop/`. Read live policy from `/api/mitigations`; container environment values describe startup settings, not subsequent browser changes.

```powershell
# Check both API response bodies
Invoke-RestMethod http://localhost:8088/api/product
Invoke-RestMethod http://localhost:8088/api/order-preview

# Inspect state and logs
docker compose ps
docker compose logs --tail 50 storefront
Invoke-RestMethod http://localhost:8089/api/mitigations

# Inspect raw proxy state (Challenge 3: only after writing your hypothesis)
$proxyApi = 'http://localhost:8478'
Invoke-RestMethod "$proxyApi/proxies" -UserAgent 'field-workshop/1.0'
```

For HTTP errors, `Invoke-RestMethod` reports an error instead of returning a normal object. Inspect its HTTP status or use the browser's Network tab. See the [tool reference](field-workshop/docs/tool-reference.md) for raw fault-injection commands and Mac equivalents. In the console, **Info & commands** shows the exact API request; **Remove delay** removes the console's `workshop-latency` toxic, while **Clear all faults** removes every toxic and reconnects both proxies.

After each experiment:

1. Select **Clear all faults** in Network Faults and confirm both paths are connected with no active faults.
2. In **Fallbacks & timeouts**, click **Restore default settings**. Both fallbacks should be off and both timeouts should read **3000 ms**.

3. Verify both APIs return live information. Use **Refresh settings** to read the active policy.
4. Submit and export your notes. When finished, use **stop.bat** or:

   ```powershell
   docker compose --profile load down
   ```

**Reset distinctions:** Clear all faults resets network faults only. Restore default settings resets timeout/fallback configuration. Clear notes resets browser progress only. None of these substitutes for the others. Stopping and restarting the entire stack recreates network state and reloads Storefront startup settings. Browser mitigation changes do not persist across a Storefront restart; maintainer environment overrides can still affect its startup configuration.

## 9. What to submit

Fill every field in the current challenge, then click **Submit notes**. This reveals a possible solution and unlocks the next challenge. The application checks that fields are filled, not whether the diagnosis is correct. You can update submissions.

Use this compact record for each experiment:

| Field | Your entry |
| --- | --- |
| Challenge, date, team | |
| Route and customer behavior at risk | |
| Baseline window, request count/rate, latency, success | |
| Hypothesis, expected blast radius, abort condition | |
| Exact fault target/type/magnitude and command | |
| Fault window and measured customer/dependency impact | |
| Mitigation settings/code and reason | |
| Identical-fault retest window and measurements | |
| Fallback activity and missing/uncertain information | |
| Conclusion, remaining uncertainty, cleanup performed | |

Notes live in **this browser's local storage**, not on the server. Select **Download notes** to export `northstar-experiment-record.json`, especially before changing browser/computer or clearing browser data. Include screenshots, queries, or panel links alongside your measured windows when useful.

The key conclusion to demonstrate is: **Did the customer's experience improve under the same failure, and what information or guarantee did we give up?**

## Source files

- [Workshop README](field-workshop/README.md)
- [Assignment briefs](field-workshop/docs/assignments.md)
- [Tool reference](field-workshop/docs/tool-reference.md)
- [Experiment record template](field-workshop/docs/experiment-record.md)
- [Storefront implementation](field-workshop/services/storefront.mjs)
- [Compose configuration](field-workshop/compose.yaml)
- [Challenge fields and example reasoning](field-workshop/content/)
