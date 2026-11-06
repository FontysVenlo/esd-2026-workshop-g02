# Engineering assignments

Open <http://localhost:8088> for the guided workflow and <http://localhost:8088/storefront> for the three-product catalog. The start launcher supplies five requests per second. Fault controls target only the lamp branch; chair and desk use separate healthy network branches to the same services. All products share two workers and one catalog response.

Compare healthy, faulted and mitigated phases using fresh 60–90-second windows and unchanged traffic. No purchases are made.

Timeouts bound dependency waiting; a circuit breaker pauses a failed product/dependency for five seconds and permits one recovery probe; fallback supplies an honest incomplete result. They serve different purposes.

## 1 — One slow product blocks the shop (Guided entry)

**The customer problem.** Desk Lamp, Task Chair and Writing Desk share two Storefront workers. Only the lamp’s Inventory network branch becomes slow. Repeated lamp requests hold the workers; healthy chair and desk requests now queue or are rejected. The complete catalog also waits for the lamp result.

**Why this matters.** The mitigation now protects other products. A 400 ms timeout releases a worker, the 5-second circuit breaker stops repeated waiting on the lamp, and the fallback lets the catalog show chair and desk while lamp stock is unconfirmed. These are three different mechanisms; fallback alone does not free capacity.

**The issue to reproduce.** Choose Inventory in Network Faults and apply a 1500 ms response delay. It affects only Desk Lamp’s branch. Use “Refresh all availability” in Storefront and watch the shared workers in Grafana as fixed background traffic runs.

**Before you start.** Start with “Clear all faults” and “Restore default settings” in Network Faults. Use the start launcher so fixed background traffic is running. Compare the catalog in Storefront; read workers, queue, rejections and dependency circuits in Grafana. Keep the same traffic throughout, use fresh 60–90-second windows, and record changes in the cumulative rejected count rather than its lifetime total.

**Your question.** Can you keep the healthy chair and desk available while temporarily disabling an unconfirmed lamp availability check?

1. **Measure the healthy catalog.** Use “Refresh all availability”. Record all three stock results, catalog time, workers, queue size and the starting rejected count. In Grafana inspect “Product p95 latency” and “Shared workers and queue”. Predict which products can be affected despite having healthy dependency branches; state an abort condition.

2. **Create a lamp-only slowdown.** Apply +1500 ms to Inventory in Network Faults. Keep supplied traffic unchanged and refresh the catalog. Record lamp delay, chair/desk queue time or failures, catalog status, and the change in rejected requests over a fresh window. The slow request consumes actual shared workers; Grafana charts measured state.

3. **Trace the propagation.** Compare “Dependency p95 latency”, “Product p95 latency”, “Shared workers and queue”, and “Capacity rejection rate”. Explain the path: lamp Inventory delay → occupied workers → healthy products waiting/rejected, plus the catalog waiting for every product. A queue can fluctuate; use a full window.

4. **Apply containment.** Remove the fault first. Open Fallbacks & timeouts and use Challenge 1 settings. This applies a 400 ms Inventory timeout and enables fallback plus the product/dependency circuit breaker. Predict the distinct effect of each mechanism.

5. **Repeat the same fault and verify recovery.** Reapply the identical +1500 ms Inventory delay. Refresh several times, including within and after a 5-second cooldown. Compare chair/desk live results, queue pressure, rejection-rate changes, catalog latency, and lamp stock uncertainty. The lamp availability action should be disabled while stock is unconfirmed. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**You are finished when:**

- You measured healthy, delayed and mitigated phases under unchanged traffic.
- You observed and explained impact on chair/desk or the complete catalog, then verified that impact shrank while lamp stock remained unconfirmed.
- You distinguished timeout, circuit breaker and fallback; compared equal windows; and verified cleanup.

## 2 — One missing quote breaks the catalog (Intermediate)

**The customer problem.** The delivery catalog contains three products, but its response requires every quote to succeed. Disconnecting only the lamp’s Shipping path rejects the complete catalog, hiding the healthy chair and desk too. Availability does not require Shipping and should still work.

**Why this matters.** This is error propagation through a coupled catalog response. A fast disconnect need not exhaust workers. An explicit unavailable lamp quote can preserve healthy products and stock information without inventing a delivery promise.

**The issue to reproduce.** Choose Shipping and click Disconnect in Network Faults. Compare “Refresh all availability” with “Preview all deliveries”. The complete delivery catalog should fail even though chair and desk have healthy Shipping paths.

**Before you start.** Start with “Clear all faults” and “Restore default settings” in Network Faults. Use the start launcher so fixed background traffic is running. Compare the catalog in Storefront; read workers, queue, rejections and dependency circuits in Grafana. Keep the same traffic throughout, use fresh 60–90-second windows, and record changes in the cumulative rejected count rather than its lifetime total.

**Your question.** Can one unavailable lamp quote be contained to that quote instead of taking down the complete delivery catalog?

1. **Compare both healthy catalog views.** Refresh availability, then preview all deliveries. Record all three results, timings, queue state and an abort condition. Predict why Shipping affects one view but not the other.

2. **Disconnect only lamp Shipping.** Choose Shipping → Disconnect. Repeat both views. Record the failed whole-catalog response, the working availability view, and Shipping failures. Do not claim worker exhaustion if the queue stays empty.

3. **Identify the coupling.** Inspect “Customer request rate”, “Dependency outcomes” and “Shared workers and queue” in Grafana. Explain why one rejected quote prevents the aggregate catalog from returning its healthy products. Distinguish this from Challenge 1’s shared-capacity slowdown.

4. **Allow an honest partial catalog.** Reconnect Shipping first, then apply Challenge 2 settings in Fallbacks & timeouts. Shipping fallback and its 5-second circuit breaker are enabled; the timeout stays 3000 ms because disconnection fails immediately. Stock is still authoritative.

5. **Repeat and measure the smaller impact.** Disconnect Shipping again. Preview all deliveries: the catalog should return all three products, chair/desk with live quotes, and the lamp with an unavailable quote. Compare statuses, useful information and fallback activity. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**You are finished when:**

- You compared both complete-catalog views before, during and after mitigation of the same outage.
- You showed healthy chair/desk delivery information surviving while only the lamp quote remained unavailable.
- You explained aggregate error propagation without assuming a fast failure saturates workers, then restored all paths and defaults.

## 3 — Investigate a spreading incident (Advanced)

**The customer problem.** Support reports that a three-product catalog is slow or unavailable, although only one lamp dependency branch has been faulted. A facilitator seeds either slow lamp Inventory or disconnected lamp Shipping. Diagnose whether shared workers or aggregate error propagation explains the wider customer impact.

**Why this matters.** The visible failures can be healthy products downstream of a shared bottleneck or an all-or-nothing response. Fixing the wrong dependency or enabling fallback without an appropriate timeout can leave the real problem active.

**The issue to reproduce.** Ask a partner or facilitator to seed exactly one incident from docs/facilitator.md. They keep the chosen dependency and fault secret. Do not inspect Network Faults before writing your hypothesis.

**Before you start.** Start with “Clear all faults” and “Restore default settings” in Network Faults. Use the start launcher so fixed background traffic is running. Compare the catalog in Storefront; read workers, queue, rejections and dependency circuits in Grafana. Keep the same traffic throughout, use fresh 60–90-second windows, and record changes in the cumulative rejected count rather than its lifetime total. Record the healthy baseline before your partner seeds the incident; do not clear it afterward. This challenge requires another person.

**Your question.** Which lamp dependency is faulty, how does its impact spread to healthy products, and which mitigation contains that mechanism?

1. **Arrange one hidden incident.** From a clean baseline, ask a partner to seed Assignment 3. Leave the exact fault secret and keep supplied traffic fixed. Write an abort condition.

2. **Collect the customer symptoms.** Compare availability and delivery catalog views. Record catalog times/statuses, chair/desk usefulness, active workers, queue state, and the rejected-count change with timestamps. Leave fault controls unopened.

3. **Write a supported diagnosis.** Use dependency outcomes/latency, product latency, and worker/queue charts. Predict the faulty dependency and whether the impact spreads through shared capacity, aggregate failure, or both. Record an alternative explanation before inspecting controls.

4. **Confirm and contain the mechanism.** Inspect Network Faults with the facilitator after recording your hypothesis. Apply a justified timeout/fallback setting. For slow calls use a short timeout plus fallback/breaker; for immediate disconnection use an honest partial quote. Preserve the exact original fault.

5. **Validate the healthy products and reveal.** Retest the same catalog views and fresh windows. Compare healthy product usefulness, queue pressure, catalog time/status and the affected product’s uncertainty. Ask for the reveal and compare it with your hypothesis. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**You are finished when:**

- You recorded a diagnosis and propagation mechanism before inspecting fault controls.
- You retested the identical incident and showed which healthy-product or catalog outcome improved, while recording the affected product’s missing data.
- You compared the diagnosis with the reveal and restored all three products.

## 4 — Your containment GameDay (Capstone)

**The customer problem.** Your team wants evidence that one faulty lamp dependency cannot unnecessarily hide the chair and desk. Design one repeatable local experiment that demonstrates impact beyond the lamp, then test whether your mitigation contains it.

**Why this matters.** A fallback is justified by useful behavior preserved under a specific fault, not by an enabled checkbox. Your recommendation needs before-and-after evidence for the catalog or healthy products and an explicit statement of lost certainty.

**The issue to reproduce.** Choose Inventory or Shipping on the lamp branch and one fault: a measured delay or disconnection. Choose availability or delivery catalog. A +1500 ms delay can pressure shared workers; disconnection demonstrates aggregate error propagation.

**Before you start.** Start with “Clear all faults” and “Restore default settings” in Network Faults. Use the start launcher so fixed background traffic is running. Compare the catalog in Storefront; read workers, queue, rejections and dependency circuits in Grafana. Keep the same traffic throughout, use fresh 60–90-second windows, and record changes in the cumulative rejected count rather than its lifetime total. Use only the two exposed lamp fault controls; the other product paths are the healthy comparison group.

**Your question.** Can you reproduce a wider customer impact and then contain it to the affected product’s missing information?

1. **Define a propagation hypothesis.** Name the catalog view, lamp dependency, exact fault/magnitude, healthy comparison products, propagation mechanism and abort condition. Choose customer results and worker/product metrics that could disprove your hypothesis.

2. **Record a healthy comparison window.** Measure all three products, catalog latency/status, worker queue and changes in cumulative rejections over a fixed window. Keep supplied traffic unchanged for every phase.

3. **Reproduce impact beyond the lamp.** Apply only your chosen fault. Measure the same view and healthy products. Record whether impact spreads by queuing, rejection, aggregate failure or a combination. If no wider effect appears, report that honestly and revise the experiment before recommending mitigation.

4. **Choose a mechanism-specific mitigation.** Remove the fault before configuring. Use a short dependency timeout for a slow call, enable fallback/breaker for the relevant dependency, and justify the missing-data behavior. Do not claim fallback alone releases workers.

5. **Repeat exactly and recommend.** Reapply the identical fault at the same magnitude and traffic. Show whether chair/desk remain useful, whether catalog status/time improves, and what lamp information remains unavailable. Include probe behavior and exact rollback instructions. Clear all faults, restore default settings, wait for in-flight work and any 5-second cooldown, then verify all three products have live stock and delivery information. Submit your own measurements.

**You are finished when:**

- A teammate can reproduce the fault, traffic, three-phase measurements, mitigation and rollback.
- You demonstrated and measured a wider impact before mitigation, then compared healthy products and catalog usefulness under the identical fault.
- You distinguished timeout, breaker and fallback, described remaining uncertainty/probe spikes, and restored all three products.
