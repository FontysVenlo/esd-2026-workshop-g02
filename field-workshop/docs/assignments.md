# Engineering assignments

Open <http://localhost:8088> for the guided workflow and <http://localhost:8088/storefront> for the three-product catalog. The start launcher supplies five requests per second. Fault controls target Lighting inventory or shared Shipping. Chair and desk use their own Seating and Desks inventory services. All products share two workers and one catalog response.

Compare healthy, faulted and mitigated phases using fresh 60–90-second windows and unchanged traffic. No purchases are made.

Timeouts bound dependency waiting; a circuit breaker pauses a failed product/dependency for five seconds and permits one recovery probe; fallback supplies an honest incomplete result. They serve different purposes.

## 1 — One slow product blocks the shop (Guided entry)

**The customer problem.** Desk Lamp, Task Chair and Writing Desk share two Storefront workers. Only the lamp’s Inventory network branch becomes slow. Repeated lamp requests hold the workers; healthy chair and desk requests now queue or are rejected. The complete catalog also waits for the lamp result.

**Why this matters.** The mitigation now protects other products. A 400 ms timeout releases a worker, the 5-second circuit breaker stops repeated waiting on the lamp, and the fallback lets the catalog show chair and desk while lamp stock is unconfirmed. These are three different mechanisms; fallback alone does not free capacity.

**The issue to reproduce.** Choose Lighting inventory in Network Faults and apply a 1500 ms response delay. It affects only Desk Lamp’s branch. Use “Refresh all availability” in Storefront and watch the shared workers in Grafana as fixed background traffic runs.

**Before you start.** Start with “Clear all faults” and “Restore default settings” in Network Faults. Use the start launcher so fixed background traffic is running. Compare the catalog in Storefront; read workers, queue, rejections and dependency circuits in Grafana. Keep the same traffic throughout, use fresh 60–90-second windows, and record changes in the cumulative rejected count rather than its lifetime total.

**Your question.** Can you keep the healthy chair and desk available while temporarily disabling an unconfirmed lamp availability check?

1. **Measure the healthy catalog.** Use “Refresh all availability”. Record all three stock results, catalog time, workers, queue size and the starting rejected count. In Grafana inspect “Product p95 latency” and “Shared workers and queue”. Predict which products can be affected despite having healthy dependency branches; state an abort condition.

2. **Create a lamp-only slowdown.** Apply +1500 ms to Lighting inventory in Network Faults. Keep supplied traffic unchanged and refresh the catalog. Record lamp delay, chair/desk queue time or failures, catalog status, and the change in rejected requests over a fresh window. The slow request consumes actual shared workers; Grafana charts measured state.

3. **Trace the propagation.** Compare “Dependency p95 latency”, “Product p95 latency”, “Shared workers and queue”, and “Capacity rejection rate”. Explain the path: lamp Inventory delay → occupied workers → healthy products waiting/rejected, plus the catalog waiting for every product. A queue can fluctuate; use a full window.

4. **Apply containment.** Remove the fault first. Open Fallbacks & timeouts and use Challenge 1 settings. This applies a 400 ms Inventory timeout and enables fallback plus the product/dependency circuit breaker. Predict the distinct effect of each mechanism.

5. **Repeat the same fault and verify recovery.** Reapply the identical +1500 ms Lighting inventory delay. Refresh several times, including within and after a 5-second cooldown. Compare chair/desk live results, queue pressure, rejection-rate changes, catalog latency, and lamp stock uncertainty. The lamp availability action should be disabled while stock is unconfirmed. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**You are finished when:**

- You measured healthy, delayed and mitigated phases under unchanged traffic.
- You observed and explained impact on chair/desk or the complete catalog, then verified that impact shrank while lamp stock remained unconfirmed.
- You distinguished timeout, circuit breaker and fallback; compared equal windows; and verified cleanup.

## 2 — Keep the catalog usable during a Shipping outage

The shared Shipping service is unreachable. All three inventory services still answer, but the delivery preview requires a quote for each product. Can customers see live stock for every product while every delivery estimate is unavailable?

1. **Compare both healthy catalog views.** Refresh availability and preview deliveries. Record all products, timings and queue state. Set an abort condition and predict which view Shipping affects.

2. **Disconnect shared Shipping.** Disconnect Shipping and repeat both views. Record catalog failure, working availability and Shipping errors. Check whether the queue actually fills.

3. **Identify the coupling.** Check Shipping failures and queue size in Grafana. Compare stock-only results with delivery previews for the lamp, chair and desk.

4. **Enable fallback during the outage.** Leave Shipping disconnected and apply Challenge 2 settings. Preview all deliveries again. Record the stock and quote status for each product and watch fallback activity.

5. **Reconnect and verify recovery.** Reconnect Shipping with fallback still enabled. After the five-second cooldown, refresh to allow a recovery probe. Refresh again and verify three live quotes. Restore default settings and submit your observations.

## 3 — Investigate a spreading incident

A hidden incident affects the catalog. Use stock checks, delivery previews and Grafana to identify which dependency failed. Which dependency explains the symptoms, and which customer information can you preserve?

1. **Arrange one hidden incident.** Record a healthy baseline, then ask a partner to seed Assignment 3 without revealing it. Keep traffic fixed and set an abort condition.

2. **Collect the customer symptoms.** Compare availability and delivery catalogs. Record times, status, chair/desk results, workers, queue and new rejections with timestamps. Leave fault controls closed.

3. **Write a supported diagnosis.** Use dependency outcomes, latency and worker charts to predict the fault and how it spreads. Record an alternative explanation before opening controls.

4. **Confirm and contain the mechanism.** Inspect Network Faults with your partner. Keep the original fault. For slow calls, use a short timeout plus fallback/breaker; for a disconnect, preserve honest partial results.

5. **Validate the healthy products and reveal.** Retest under the original fault. Record which customer action improved and which information is still missing. Compare your diagnosis with the reveal. Remove the fault, allow a recovery probe, verify live stock and quotes, then restore defaults.

## 4 — Your containment GameDay

Choose a dependency fault and measure the trade-off between waiting for complete results and returning useful partial information sooner. When is a faster partial catalog more useful than waiting for full results?

1. **Define a propagation hypothesis.** Choose your dependency, fault, customer action, stop condition and measurements. For slow Shipping, predict what a shorter wait will do to preview time and quote availability.

2. **Record a healthy comparison window.** Measure all products, catalog time/status, queue and new rejections over a fixed window. Keep traffic unchanged.

3. **Measure the fault.** Apply your chosen fault. Repeat the same view and count live stocks and quotes. Record catalog time, queue and new rejections.

4. **Choose a mechanism-specific mitigation.** Remove the fault. Choose a short timeout for slow calls and fallback/breaker for the affected dependency. Explain the missing-data response; fallback alone does not free workers.

5. **Repeat exactly and recommend.** Repeat the identical fault and traffic. Compare time, useful stock and missing quotes. Explain the trade-off, remove the fault, verify recovery after the cooldown and restore defaults.
