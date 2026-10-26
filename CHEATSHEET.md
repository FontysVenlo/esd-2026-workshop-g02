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
| [Commands page](http://localhost:8088/tools) | Windows and Mac configuration examples |

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

A **timeout** limits how long Storefront waits. A **fallback** defines what it returns when the call fails. Inventory fallback returns unconfirmed stock (`available: null`, `quantity: null`). Shipping fallback returns unavailable quote information (`priceEur: null`, `etaDays: null`). Neither repairs the dependency. The system only previews an order; it never places one.

## 2. Start and prepare

Start Docker Desktop. From the repository, double-click **Start Workshop.bat** inside `field-workshop/` on Windows, or **Start Workshop.command** on Mac. If using the distributed ZIP, extract it fully before launching.

For the commands in this cheatsheet, open PowerShell at the repository root and enter the workshop directory **once**:

```powershell
Set-Location .\field-workshop
```

Alternatively, start manually from that directory:

```powershell
docker compose --profile load up --build -d
docker compose ps
```

The supplied load generator sends about three requests per second across both customer APIs. Keep that load consistent across comparisons. Do not increase it for this assignment.

Before each challenge:

1. Confirm both proxy paths are connected and have no active faults, except the intentionally seeded incident in Challenge 3.
2. Restore default mitigation settings using the cleanup commands below.
3. Try both customer actions and check Prometheus targets: Storefront, Inventory, Shipping should be `UP`.
4. Collect a healthy baseline. A practical choice is **60-90 seconds per stable phase**, with the same duration for each comparison. This is a suggested method, not a required course threshold.
5. Write down the route, metric, prediction, and an abort condition **before** injecting a fault.

An abort condition must be observable. Example: "Stop if the product route returns errors continuously for 15 seconds, or an unrelated route becomes unavailable." Choose a condition compatible with the intended experiment: preview errors are expected during the Shipping outage. There is **no automatic abort**; you must remove the fault yourself.

## 3. Challenge 1: slow stock information

**Question:** Does slow Inventory make the customer wait, and can you bound that wait while being honest about unavailable stock?

1. **Baseline:** use `/api/product` through the Storefront. Record latency, success rate, Inventory latency, and the observation window.
2. **Predict:** "Adding 1500 ms Inventory response delay will add roughly 1.5 seconds to product response time while calls still normally succeed, since the default timeout is 3 seconds." Set your abort condition.
3. **Inject:** in Network Faults choose **Inventory**, enter **1500**, then **Apply delay**.
4. **Observe:** repeat the product action. Compare Grafana's **Customer-facing p95 latency**, **Customer request success rate**, and **Dependency p95 latency**. The preview also depends on Inventory, so it can slow too.
5. **Remove delay**, then apply a mitigation in PowerShell:

   ```powershell
   $env:INVENTORY_TIMEOUT_MS = '400'
   $env:INVENTORY_FALLBACK = 'true'
   docker compose up -d --force-recreate storefront
   ```

6. **Retest:** after Storefront is ready, apply the identical **1500 ms Inventory delay**. Use the same route and a fresh measurement window.
7. **Expect:** the API should return after roughly the 400 ms wait plus overhead, with HTTP 200 and unconfirmed stock. Inventory timeouts and Inventory fallbacks should appear. Grafana p95 is a histogram estimate, so it need not read exactly 0.400 seconds.
8. **Conclude:** the page is faster and available as an informational page, but stock is unknown. HTTP 200 does not mean the item is confirmed available. A short timeout without fallback would instead expose timeout errors.
9. **Clean up:** remove the delay, restore default configuration, and verify live stock returns. Fill all Challenge 1 fields and select **Submit notes**.

**Hand in:** baseline/fault/mitigated latency and success, Inventory call latency/outcomes, fallback activity, time windows, chosen timeout, business trade-off, and cleanup.

## 4. Challenge 2: Shipping is unavailable

**Question:** How far does the Shipping outage spread, and can the order preview remain useful without a quote?

1. **Baseline both routes:** product and order preview should succeed with live information. Record each separately and state your expected blast radius and abort condition.
2. **Inject:** choose **Shipping** in Network Faults and click **Disconnect**.
3. **Compare:** `/api/product` should remain healthy. `/api/order-preview` should fail by default, normally with HTTP 503. Confirm Shipping failures in **Dependency outcomes**. A disconnect can fail quickly; low latency alone is not proof of health.
4. **Reconnect** Shipping, then enable an honest preview fallback:

   ```powershell
   $env:SHIPPING_FALLBACK = 'true'
   docker compose up -d --force-recreate storefront
   ```

5. **Repeat the same outage:** disconnect Shipping again, then test both routes over a fresh window.
6. **Expect:** product still works; preview now returns HTTP 200 with `degraded: true` and unavailable shipping price/delivery information. Shipping calls still fail, and Shipping fallback activity rises.
7. **Conclude:** the default blast radius is the order-preview API. With fallback, the visible impact can shrink to missing quote information. That can be acceptable for an informational preview; it does not establish that an actual purchase could proceed safely. Never invent a shipping price or ETA.
8. **Clean up:** reconnect Shipping, restore defaults, check both APIs, submit Challenge 2 notes.

**Hand in:** both routes' before/after statuses and latency, Shipping failures, fallback counts/rates, blast-radius statement, mitigation rationale, and restoration.

## 5. Challenge 3: investigate an unknown incident

**Question:** Can you identify the cause from customer and monitoring evidence before looking at the injected fault?

1. Start from a clean state and ask the facilitator to seed one controlled incident. Record when investigation begins. If working alone, have someone else seed it to preserve the unknown-incident exercise.
2. Try **both customer routes**. Record which is slow or failing, including status and browser latency.
3. Inspect Grafana and Prometheus first. Compare route latency/status with each dependency's latency and `success`, `timeout`, or `failure` outcomes. Record a timeline and the relevant panel/query.
4. Write a data-backed hypothesis, supporting/contradicting evidence, and remaining uncertainty. A useful heuristic:

   | Observed pattern | Candidate explanation to investigate |
   | --- | --- |
   | Both routes slow; Inventory calls slow | Inventory path latency |
   | Product healthy; preview failing; Shipping calls failing | Shipping path unavailable |
   | Both routes failing; Inventory calls failing | Inventory dependency/path failure |

   These are diagnostic clues, not proof. A healthy dependency scrape does not prove Storefront can reach it through Toxiproxy: Prometheus scrapes dependencies directly.

5. **Only after recording the hypothesis**, inspect Network Faults or `GET /proxies` to check it. Do not clear the incident before recording its configuration.
6. Choose a mitigation for the observed failure mode. Use a timeout/fallback configuration from Challenges 1-2, or justify a small code change. If you temporarily remove the fault to configure, restore the **exact same fault and magnitude** for validation.
7. Compare the same routes and signals in fresh windows. Report whether customer behavior improves even if dependency failures remain.
8. Submit the diagnosis, then ask the facilitator to reveal the seed. Record the reveal and cleanup; update the submission if needed.

**Hand in:** timeline, customer symptom, panel/PromQL evidence, diagnosis and uncertainty, mitigation reasoning, comparable results, reveal, and rollback. The facilitator's seed instructions are intentionally unnecessary for this walkthrough.

## 6. Challenge 4: design a Mini GameDay

**Question:** Can another teammate reproduce your experiment and understand the result?

Choose the route, dependency, fault type/magnitude, steady-state measure, expected blast radius, abort condition, and rollback **before acting**. Then run the same measurement/mitigation/retest loop yourself.

One optional plan, distinct from the first two challenges:

| Decision | Example plan; adapt and justify it |
| --- | --- |
| Route and target | `/api/order-preview`, Shipping path |
| Fault | Shipping downstream latency, 2000 ms, jitter 0 |
| Baseline | Record preview p95 and success rate, Shipping latency, product behavior |
| Hypothesis | Preview slows by roughly 2 seconds; product stays healthy |
| Blast radius | Local preview information only; watch product as a control |
| Abort | Remove fault if product fails continuously for 15 seconds or preview p95 exceeds 4 seconds for a full minute |
| Mitigation | `SHIPPING_TIMEOUT_MS=500`, `SHIPPING_FALLBACK=true`, recreate Storefront |
| Validation | Identical 2000 ms Shipping delay; compare preview latency/success and Shipping fallback activity |
| Trade-off | Faster preview with no confirmed shipping quote or ETA |
| Rollback | Clear faults, unset mitigation variables, recreate Storefront, verify both routes |

For that example's mitigation:

```powershell
$env:SHIPPING_TIMEOUT_MS = '500'
$env:SHIPPING_FALLBACK = 'true'
docker compose up -d --force-recreate storefront
```

Only the **two local Toxiproxy proxies** are in scope. Keep the supplied light traffic. Record exact commands and fault settings so the experiment is reproducible. If changing code, the implementation is `field-workshop/services/storefront.mjs`; rebuild from the workshop directory with `docker compose up --build -d storefront` and document how to undo your specific edit.

**Hand in:** a complete [experiment record](field-workshop/docs/experiment-record.md), including plan, actual commands, measurements, conclusion, trade-off, and completed rollback. Submit Challenge 4 notes.

## 7. Read the monitoring correctly

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

## 8. Command and cleanup reference (Windows PowerShell)

Run Compose commands from `field-workshop/`. Changing a shell variable alone does not update a running container; recreate Storefront after changing it. Keep experiments and cleanup in the **same PowerShell session**, or verify the effective environment explicitly.

```powershell
# Check both API response bodies
Invoke-RestMethod http://localhost:8088/api/product
Invoke-RestMethod http://localhost:8088/api/order-preview

# Inspect state and logs
docker compose ps
docker compose logs --tail 50 storefront
docker compose exec storefront printenv INVENTORY_TIMEOUT_MS INVENTORY_FALLBACK SHIPPING_TIMEOUT_MS SHIPPING_FALLBACK

# Inspect raw proxy state (Challenge 3: only after writing your hypothesis)
$proxyApi = 'http://localhost:8478'
Invoke-RestMethod "$proxyApi/proxies" -UserAgent 'field-workshop/1.0'
```

For HTTP errors, `Invoke-RestMethod` reports an error instead of returning a normal object. Inspect its HTTP status or use the browser's Network tab. See the [tool reference](field-workshop/docs/tool-reference.md) for raw fault-injection commands and Mac equivalents. In the console, **Info & commands** shows the exact API request; **Remove delay** removes the console's `workshop-latency` toxic, while **Clear all faults** removes every toxic and reconnects both proxies.

After each experiment:

1. Select **Clear all faults** in Network Faults and confirm both paths are connected with no active faults.
2. Restore the default settings:

   ```powershell
   Remove-Item Env:INVENTORY_TIMEOUT_MS,Env:INVENTORY_FALLBACK,Env:SHIPPING_TIMEOUT_MS,Env:SHIPPING_FALLBACK -ErrorAction SilentlyContinue
   docker compose up -d --force-recreate storefront
   ```

3. Verify both APIs return live information. If settings remain unexpected, check for a Compose `.env` file or other overrides as well as the container environment.
4. Submit and export your notes. When finished, use **Stop Workshop.bat** or:

   ```powershell
   docker compose --profile load down
   ```

**Reset distinctions:** Clear all faults resets network faults only. Unsetting variables plus recreating Storefront resets configuration. Clear notes resets browser progress only. None of these substitutes for the others. Stopping and restarting the entire stack recreates network state, but exported shell configuration can still reapply mitigations.

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
- [Challenge fields and example reasoning](field-workshop/web/workshop-state.mjs)
