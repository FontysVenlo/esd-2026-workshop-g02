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

The primary Shipping provider becomes unreachable, so delivery quotes fail for all three products. A backup carrier can deliver the same products at the same shipping price, but needs 5 days instead of 3.

1. **Compare both healthy catalog views.** Record stock and delivery quotes for all three products, including the shipping price and estimated days. Record catalog time and queue state.

2. **Disconnect Primary Shipping.** Disconnect Primary Shipping and repeat both views. Record working stock checks, failed delivery quotes, customer-visible errors and worker pressure.

3. **Identify the coupling.** Use Shipping failures in Grafana and the Storefront results to identify which customer action requires a carrier. Describe what customers can no longer do.

4. **Enable fallback during the outage.** Keep Primary Shipping disconnected and choose a mitigation in Fallbacks & timeouts. Retest all three products and record the carrier, quote price, estimated days and catalog response time.

5. **Reconnect and verify recovery.** Reconnect Primary Shipping while keeping your mitigation active. If the breaker is enabled, allow its five-second cooldown and a recovery probe, then refresh again. Verify that normal estimates return, restore defaults and submit.

## 3 — When successful requests return bad data

Customers see strange delivery estimates and prices while monitoring reports successful requests. Record the healthy baseline and a hypothesis, then inject **Wrong or missing values** in Network Faults. Refresh several times and compare HTTP success with **Response checks** in Grafana.

Under Shipping select **Check response data** and apply its settings to block missing or invalid quotes. It preserves stock and does not invoke a backup carrier. Keep the fault active for validation; compare invalid and blocked quotes over fresh one-minute windows. Optional hints live under the Challenge 3 menu. Remove the fault, restore defaults and verify normal quotes afterward.

## 4 — Partner incident challenge

Take turns introducing one hidden fault: delay, jitter, disconnection, intermittent Shipping errors or invalid shipping responses. Record a healthy baseline and agree on comparable difficulty and what useful customer protection means.

After the injector says go, start the page timer. The investigator keeps Fault injection/current state closed, states a supported diagnosis and applies protection through Fallbacks & timeouts. Keep the fault active and verify three consecutive refreshes with healthy stock or honest uncertainty for the affected item, and usable or explicitly unavailable quotes without incorrect values. Then stop the timer.

Record both times, diagnoses, settings and remaining trade-offs. Clear faults and restore defaults between rounds and at the end. Removing the fault does not count as containment. The timer is manual; submissions are not automatically graded.
