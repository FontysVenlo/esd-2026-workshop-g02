# Engineering assignments

Open the workshop overview at <http://localhost:8088>. You are the engineer responsible for a lamp shop. Customers use **Check availability** to ask Inventory for stock, and **Order preview** to ask Inventory and Shipping for stock and delivery information. No purchase is made.

The stack normally starts healthy. You deliberately create a problem in Challenges 1, 2, and 4; a facilitator or teammate prepares the hidden incident in Challenge 3. Opening a challenge or submitting notes does not inject a fault.

For each experiment, compare the same customer action in three states: **healthy**, **fault active**, and **the same fault with mitigation**. Then remove the fault, restore default settings, and submit your own measurements. Submitting reveals an example solution and unlocks the next challenge; there is no automatic grading.

## Know your tools and terms

- **Storefront:** act as a customer. Read the result and request time shown under the buttons.
- **Network Faults:** introduce a response delay or disconnection and clear it afterward.
- **Grafana:** read charts of customer latency, request outcomes, dependency behavior, and fallback activity.
- **Prometheus:** collects service measurements every five seconds and supplies Grafana. Its website is optional for raw queries; you do not need to enter anything there for the guided tasks.
- **Fallbacks & timeouts:** the second tab in Network Faults enables and resets the built-in mitigation behavior immediately. No terminal or code changes are required. The optional Info & commands tab has a Windows/Mac selector for command examples.
- **Baseline:** your measurements before adding a fault.
- **Timeout:** how long Storefront waits for a dependency.
- **Fallback:** the response returned when a dependency cannot answer. The code already supports it: Inventory can return “Stock unconfirmed”, and Shipping can return an unavailable quote. Enable it in [Fallbacks & timeouts](http://localhost:8089/#mitigations); no terminal or code edit is required.
- **Abort condition:** an unexpected result at which you stop and remove the fault.

Use comparable fresh observation windows, for example 60–90 seconds in each phase. Grafana uses one-minute rates, so old data can linger after a change. Charts labeled in seconds use 1.5 s for 1500 ms. Record measured results rather than copying expected numbers.

## 1 — Slow stock information (Guided entry)

**The customer problem.** You maintain an online shop that sells a desk lamp. A customer clicks “Check availability” before deciding to buy, but the stock check keeps them waiting. The lamp description and price are already visible; the shop is waiting for a separate Inventory service to confirm stock.

**Why this matters.** A slow dependency can make a working shop feel unresponsive. You need to decide how long the customer should wait and what the shop can honestly show when it cannot confirm stock.

**The issue to reproduce.** Make Inventory replies 1500 ms (1.5 seconds) slower in Network Faults. Then click “Check availability” in Storefront. You are reproducing a slow stock check, not a complete outage.

**Before you start.** The stack starts healthy. Before this experiment, use “Clear all faults” in Network Faults and “Restore default settings” in the Fallbacks & timeouts tab if you changed mitigation settings earlier. Confirm that “Check availability” shows live stock. Opening this challenge does not apply a fault.

**Your question.** Can the shop respond sooner during a slow stock check without pretending the lamp is in stock?

1. **Try the healthy customer journey.** Open Storefront and click “Check availability” a few times. Record the displayed milliseconds and stock result. In Grafana, find /api/product under “Customer-facing p95 latency”. Write what you expect a 1.5-second Inventory delay to do and when you would stop the test.

2. **Reproduce the customer complaint.** Open Network Faults, choose Inventory, set “Response delay (ms)” to 1500, and click “Apply delay”. Return to Storefront and click “Check availability” again. Look for the longer wait; with default settings, the request should normally still succeed.

3. **Find evidence of the cause.** Record the new request times and compare them with your healthy measurements. In Grafana, compare /api/product in “Customer-facing p95 latency” with inventory in “Dependency p95 latency”. Use a fresh 60–90-second window per phase so old data does not dominate the comparison.

4. **Change how the shop handles the delay.** Remove the Inventory delay first. In Network Faults, open “Fallbacks & timeouts” and click “Use Challenge 1 settings”. This enables Inventory fallback with a 400 ms timeout immediately. The timeout limits the wait; the fallback lets the shop return “Stock unconfirmed”. No source-code edit is required.

5. **Repeat, compare, and clean up.** Apply the same 1500 ms Inventory delay again. Repeat “Check availability” and record the response time, displayed stock message, and “Fallback activity” in Grafana. Explain the speed-versus-certainty trade-off. Clear faults, click “Restore default settings” in Fallbacks & timeouts, check live stock returns, then submit your notes below.

**You are finished when:**

- You recorded the same customer action in three states: healthy, delayed, and delayed with mitigation.
- You explained whether the response became faster and why “Stock unconfirmed” is different from confirmed availability.
- You removed the fault, restored the defaults, and submitted your own measurements.

## 2 — Shipping is unavailable (Intermediate)

**The customer problem.** A customer can check that the desk lamp is in stock, but clicks “Order preview” to see delivery cost and time. The external shipping provider is unavailable. The shop currently treats that missing quote as a failure of the whole preview.

**Why this matters.** A shipping outage should have a limited effect on the customer journey. You need to decide whether an informational preview is still useful when it can show stock but cannot promise a delivery price or date.

**The issue to reproduce.** Choose Shipping in Network Faults and click “Disconnect”. In Storefront, try both “Check availability” and “Order preview”. Compare which customer action still works and which fails.

**Before you start.** Clear all faults and click “Restore default settings” in Fallbacks & timeouts. Verify that both Storefront buttons work before disconnecting Shipping. This is an order preview only; no purchase is made.

**Your question.** Can a shipping outage be limited to missing delivery information instead of a failed preview?

1. **Check both healthy actions.** Click “Check availability” and “Order preview” in Storefront. Record the stock result, shipping quote, and timings. These actions call /api/product and /api/order-preview respectively. Predict which action needs Shipping and set an abort condition.

2. **Reproduce the provider outage.** In Network Faults, choose Shipping and click “Disconnect”. Return to Storefront and try both buttons. Record which action succeeds, which fails, and any error status shown.

3. **Measure the affected part of the shop.** Use “Customer request rate” in Grafana to compare route/status outcomes and “Dependency outcomes” to inspect shipping failures. Observe comparable 60–90-second windows. Describe the blast radius: the customer functions affected by this one dependency outage.

4. **Keep the preview useful.** Reconnect Shipping first. In Network Faults, open “Fallbacks & timeouts” and click “Use Challenge 2 settings” to enable Shipping fallback immediately. This permits a preview without a shipping quote; it must not invent a price or delivery date.

5. **Repeat the outage and check the trade-off.** Disconnect Shipping again and repeat both customer actions. Record whether the preview is now useful, which information is missing, and the “Fallback activity” signal. Reconnect Shipping, restore defaults, verify both actions, and submit your notes.

**You are finished when:**

- You compared both customer actions before the outage, during the outage, and during the same outage with mitigation.
- You identified the affected customer function and explained why an unavailable quote must not become a made-up delivery promise.
- You restored Shipping and the default settings and submitted your evidence.

## 3 — Investigate an unknown incident (Advanced)

**The customer problem.** You are the engineer on call. A support ticket says: “Something is wrong with the lamp shop: checking stock or previewing delivery is slow or fails.” A facilitator or teammate introduces one hidden dependency fault. You must find the likely cause from the customer symptoms and monitoring.

**Why this matters.** During a real incident, the customer reports a symptom, not the broken dependency. This challenge practices using evidence to choose a fix instead of changing settings at random.

**The issue to reproduce.** Ask a facilitator or teammate to seed exactly one incident using the facilitator notes. They keep the chosen fault secret. You do not inject your own known fault in this challenge.

**Before you start.** This challenge needs another person to prepare the incident. Before they seed it, clear old faults, restore default settings, and record healthy behavior. If working alone, arrange a partner or facilitator before starting; an unchanged, healthy stack has no mystery incident to diagnose. Do not clear faults after the incident has been seeded.

**Your question.** Which customer action is affected, which dependency is responsible, and what evidence supports your diagnosis?

1. **Prepare the incident with a partner.** Start from the clean baseline described above. Ask the facilitator or teammate to use the “Seed Assignment 3” instructions in docs/facilitator.md without showing you their choice. Once they confirm the incident is active, begin your investigation.

2. **Reproduce the reported symptom.** Try “Check availability” and “Order preview”. Record which one is slow or failing, the displayed time/status, and when you observed it. Leave the fault controls and their current-state display unopened for now.

3. **Write a diagnosis from monitoring.** In Grafana, compare customer latency and route/status outcomes with “Dependency p95 latency” and “Dependency outcomes”. Write the likely dependency, whether the symptom suggests delay or unavailability, and an alternative explanation before inspecting Network Faults.

4. **Confirm and mitigate.** After recording your hypothesis, inspect Network Faults with the facilitator. Choose a timeout/fallback change supported by your evidence and apply it in Fallbacks & timeouts. Keep the same incident active, or have the facilitator reapply it exactly, so the comparison remains fair.

5. **Validate and ask for the reveal.** Repeat the same customer actions and compare fresh observation windows before and after mitigation. Ask the facilitator to reveal the fault and compare it with your diagnosis. Clear the incident, restore defaults, verify recovery, and submit the timeline and evidence.

**You are finished when:**

- You recorded a diagnosis with supporting signals before looking at the fault state.
- You compared the same incident before and after a justified mitigation and checked your diagnosis against the reveal.
- You and the facilitator restored the clean system and you submitted your findings.

## 4 — Your Mini GameDay (Capstone)

**The customer problem.** Your team owns the lamp shop and is preparing a release. The team lead asks: “If one of our providers becomes slow or unavailable, can customers still get useful information?” You have time to test one concrete failure in this local Docker shop and recommend a response.

**Why this matters.** The earlier challenges gave you an incident and a path to follow. Now you turn a customer risk into your own repeatable experiment that a teammate could run from your notes.

**The issue to reproduce.** Choose one dependency and one fault: an Inventory or Shipping response delay, or a disconnection. Choose the customer action you want to protect. For example, investigate slow Shipping replies during “Order preview”; record your chosen delay before applying it.

**Before you start.** Clear old faults and restore default settings. Use only the two local dependency paths and keep the supplied light traffic. Choose one fault, not a combination, so you can explain what caused the result.

**Your question.** Design and run one test that answers a specific customer-facing reliability question, then recommend a mitigation with evidence.

1. **Write a customer question and a test plan.** Name the Storefront button/API route, the dependency, the exact fault and magnitude, and the metric you will watch. Predict the customer effect. State an abort condition: a specific unexpected result that means you will remove the fault immediately.

2. **Measure normal behavior.** Run the chosen customer action and record a healthy baseline. Choose a consistent observation window, for example 60–90 seconds, for every phase. Keep the supplied traffic unchanged.

3. **Run your chosen failure.** Use Network Faults to apply only the planned delay or disconnection. Repeat the customer action and record timings, route/status outcomes, and the relevant dependency signals. Decide whether your original prediction matched the evidence.

4. **Make a justified change.** Remove the fault first. Choose and apply a timeout/fallback change in the Fallbacks & timeouts tab. You can complete this experiment entirely in the browser. Explain what customer behavior it protects and what information or certainty may be lost.

5. **Repeat the exact test and recommend a response.** Apply the same fault to the same dependency at the same magnitude. Repeat the action and compare equivalent windows. State whether your change helped, document its trade-off and exact reproduction steps, then remove the fault, undo the mitigation, verify recovery, and submit your record.

**You are finished when:**

- A teammate can reproduce your chosen customer action, fault, mitigation, and rollback from the submitted record.
- Your recommendation compares healthy, faulted, and mitigated results under the identical fault.
- You explained the remaining risk and restored the clean system.

## Your evidence

Use the answer fields in each challenge or the [experiment record](experiment-record.md). Record your actual timings and outcomes, the fault and mitigation settings used, the remaining uncertainty, and cleanup. Only the two local dependency paths are in scope; keep the supplied light traffic.
