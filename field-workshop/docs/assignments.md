# Engineering assignments

The assignments appear in the sidebar at <http://localhost:8088>. Submit your notes to see an example solution beside them and unlock the next challenge. There is no automatic grading. Measure before injecting a fault, set an abort condition, and remove the fault afterward.

## 1 — Is slow stock data a customer problem? (guided entry)

**Situation.** Customers say the product page sometimes feels slow. Stock is obtained from a separate service.

**Your assignment.** Establish a healthy baseline for the product page, then add about 1.5 seconds of latency on the Inventory network path. Determine whether that dependency delay reaches the customer. Try a bounded timeout and an honest fallback, then repeat the *same* fault.

**Decide before acting.** Which customer-facing metric defines healthy behavior? What change do you expect? At what point would you stop the experiment? A 200 response with unconfirmed stock may be faster, but is it an acceptable product experience?

**Evidence to hand in.** Baseline and faulted request latency, success rate, Inventory call latency, fallback activity after mitigation, and a short conclusion about the trade-off. Use the product page plus Grafana; apply the fault in the [Network Faults console](http://localhost:8089) or with the API commands in the [tool reference](tool-reference.md).

## 2 — Shipping is offline (intermediate)

**Situation.** A shipping provider is unavailable. The Storefront can still retrieve product and stock information.

**Your assignment.** Disconnect the Shipping path in the Network Faults console (or through the Toxiproxy API). Determine the failure's blast radius: product page, order preview, or the whole Storefront? Decide whether an unavailable shipping quote should block an order *preview*. Test a mitigation and verify it under the same outage.

**Decide before acting.** Which routes and signals will you watch? What is your abort condition? What information must never be fabricated by a fallback?

**Evidence to hand in.** Route-level outcomes before/after, dependency failure counts, fallback counts, a blast-radius statement, and the reason for your mitigation. Restore the proxy afterward.

## 3 — Incident investigation (advanced)

**Situation.** Users report a slow or unreliable Storefront. The facilitator has introduced one controlled incident; you are not told which dependency or fault is involved.

**Your assignment.** Begin with the customer symptom, use Grafana and Prometheus to identify the affected route and dependency, and inspect the Toxiproxy state only after making a data-backed hypothesis. Choose a mitigation, apply it via Compose or a small code change, and collect comparable evidence.

**Decide before acting.** Which signals distinguish latency from unavailability? How will you avoid confusing historical dashboard data with the current state? What uncertainty remains after the diagnosis?

**Evidence to hand in.** Timeline, relevant query or panel, suspected root cause, evidence that supports or contradicts it, mitigation rationale, and before/after outcome. The facilitator can reveal the seed only after your report.

## 4 — Mini GameDay (capstone)

**Situation.** Your team owns this Storefront. You have a short maintenance window to test one realistic dependency failure without affecting anything outside this local stack.

**Your assignment.** Design the experiment yourself. Select a route, dependency, fault, magnitude, steady-state measure, blast radius and abort condition. Run the fault using Toxiproxy, observe it in Grafana, improve the service through configuration or code, and rerun the identical fault. A teammate should be able to reproduce your work from your record.

**Boundaries.** Only the two local Toxiproxy proxies are in scope. The system never places an order. Do not target external hosts or increase load beyond the supplied light traffic generator.

**Evidence to hand in.** A complete [experiment record](experiment-record.md), including the exact fault, the commands/configuration used, before/after measurements, a conclusion, and a rollback plan. There is no automatic grading or “correct” button.

## Real-world connection

This uses the same operational loop engineers use outside a training app: establish normal behavior, form a hypothesis, limit the blast radius, inject a controlled fault, interpret monitoring, mitigate, and repeat. Toxiproxy is one network fault tool; production teams may instead use Gremlin, Chaos Mesh, LitmusChaos or Linux `tc/netem` depending on infrastructure. The tools are not interchangeable in every environment.
