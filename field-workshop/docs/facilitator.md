# Facilitator notes

Use this file to prepare and review the experiments. At <http://localhost:8088>, participants submit notes, see an example solution beside their inputs, and unlock the next challenge. There is no correctness evaluation. Records are stored in each participant's browser, so ask them to download the JSON experiment record for review. Network faults change Toxiproxy paths; response faults change the real Lighting inventory or primary Shipping service replies.

## Before participants arrive

Generate `northstar-workshop.zip` with `package-workshop.ps1` and distribute it to participants. Have them extract it fully. Pull/build the images while online, start the stack with **start.bat** (Windows) or **start.command** (Mac), and verify Grafana plus Prometheus targets. If Docker images are already present, the workshop can run without Internet. Ensure ports 8088, 8089, 3008, 9098 and 8478 are free. Test both launchers on representative participant laptops before the session; archive metadata checks alone do not prove macOS Gatekeeper behavior.

## Expected behavior

- Three products share one Storefront worker. Three stock proxies lead to Lighting, Seating and Desks inventory. All three products use one shared Shipping proxy. Disconnecting it takes delivery estimates offline for the whole shop.
- Healthy: all product and catalog views succeed quickly. The load profile supplies 3.5 requests per second: 1.5 lamp requests plus one each for chair and desk.
- Inventory +1500 ms: repeated lamp calls can occupy the single worker. Healthy products then queue or are rejected after a 1000 ms queue wait (queue bound: 12); catalog aggregation also waits for every product. Observe a full window, not a single refresh.
- Inventory timeout 400 ms alone: the lamp check errors sooner, releasing the worker so chair and desk can load. Fallback is optional for Challenge 1: it changes the lamp error to Stock unconfirmed, disabling its availability action, but does not improve worker capacity or healthy-product availability. The separate breaker then skips failed lamp stock calls for five seconds before one probe, avoiding repeated 400 ms waits. With a 3000 ms timeout, the 1500 ms reply succeeds slowly: fallback and breaker do not activate. A probe can cause a brief spike.
- Shipping disconnected: stock remains live. With fallback off the delivery preview fails. With fallback on it obtains real quotes from backup Shipping: €4.90 and 5 days instead of the primary carrier’s €4.90 and 3 days. Reconnect and verify all three primary quotes after recovery.
- The shared worker makes the dependency risk visible. Catalog aggregation preserves per-product results. Discuss separate worker pools (bulkheads) as an additional way to isolate capacity. Do not present a circuit breaker as a fallback alone.

Numbers depend on the host and browser. Ask teams to compare same-route, same-fault windows, not a single sample. Grafana's one-minute rates need a fresh observation window after each change.

## Challenge 3 — Invalid successful responses

No partner seed is needed. The participant records a baseline, then introduces **Wrong or missing values**. The primary returns HTTP 200 while cycling per product through negative delivery days, empty fields, a negative price and a valid quote. The backup remains healthy.

All response faults and response checks are available throughout the workshop. Choose Lighting inventory for bad stock values or Shipping for bad delivery information. **Response checks** counts invalid quotes regardless of validation; blocked quotes increase only when enforcement is enabled. Validation marks an invalid quote unavailable without activating fallback or breaker. Healthy stock remains visible. Normal transport-failure fallbacks still behave as in Challenge 2.

## Challenge 4 — Partner competition

Open Challenge 4 before seeding: its first opening clears faults and restores protections. Seed one fault only after the investigator records a healthy baseline. Use delay, jitter or disconnect on Lighting/Shipping, or wrong/missing values and intermittent errors on either service. Intermittent errors fail alternating calls per product, so keep background traffic fixed.

The injector says go after applying the fault. The investigator starts the manual timer and uses Storefront, Grafana and the mitigation tab. Keep fault controls/current state hidden by agreement; this is a local workshop, not a role-based examination system. Require a diagnosis and three consecutive acceptable refreshes while the fault remains active. Clear faults and restore defaults between rounds, swap roles and compare faults of similar difficulty. A shorter time alone does not prove a better design.

## Cleanup and safety

Use **Clear all faults** in Fault injection, then **Restore default settings** in Fallbacks & timeouts, and confirm both Storefront actions return live information. Before each GameDay, ask teams to state blast radius and an abort condition. If impact exceeds the condition, remove the fault or reconnect the dependency immediately. There is no automatic abort. End with **stop.bat** on Windows or **stop.command** on Mac; challenge answers remain in the participant's browser. Runtime mitigation settings reset to the startup configuration when Storefront restarts.

## Discussion prompts

Did HTTP success mean useful information? Was a fallback honest about uncertainty? Did the experiment isolate one cause? What did the `rate()` window hide or reveal? Would the same mitigation be safe for actual purchase placement? Which other stakeholders would you involve before running this in production?
