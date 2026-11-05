# Facilitator notes

Keep this file away from participants until after Assignment 3. At <http://localhost:8088>, participants submit notes, see an example solution beside their inputs, and unlock the next challenge. There is no correctness evaluation. Records are stored in each participant's browser, so ask them to download the JSON experiment record for review. The incident seed is an actual Toxiproxy state change, not hidden application state.

## Before participants arrive

Generate `northstar-workshop.zip` with `package-workshop.ps1` and distribute it to participants. Have them extract it fully. Pull/build the images while online, start the stack with **start.bat** (Windows) or **start.command** (Mac), and verify Grafana plus Prometheus targets. If Docker images are already present, the workshop can run without Internet. Ensure ports 8088, 8089, 3008, 9098 and 8478 are free. Test both launchers on representative participant laptops before the session; archive metadata checks alone do not prove macOS Gatekeeper behavior.

## Expected behavior

- Three products share two Storefront workers. Four fixed Toxiproxy branches lead to the same Inventory/Shipping services: two faultable lamp branches and two healthy branches used by chair/desk. The controls fault only the lamp; the healthy branches are the comparison group.
- Healthy: all product and catalog views succeed quickly. The load profile supplies five requests per second: three lamp requests plus one each for chair and desk.
- Inventory +1500 ms: repeated lamp calls can occupy both workers. Healthy products then queue or are rejected after a 1000 ms queue wait (queue bound: 12); catalog aggregation also waits for every product. Observe a full window, not a single refresh.
- Inventory timeout 400 ms plus fallback: workers are released sooner. Failed product/dependency circuits pause calls for five seconds, then permit one probe. Lamp stock is unconfirmed and its availability action is disabled; chair and desk can stay live. A probe can cause a brief spike.
- Shipping disconnected: availability works, but the complete delivery catalog fails because one required quote fails. This is aggregate error propagation, not necessarily worker exhaustion. Shipping fallback preserves all three cards with an unavailable lamp quote and live chair/desk quotes.
- The deliberately coupled baseline makes the dependency risk visible. Discuss alternatives such as independently rendering product cards, bulkheads, or partial aggregation as well as timeout/breaker/fallback. Do not present a circuit breaker as a fallback alone.

Numbers depend on the host and browser. Ask teams to compare same-route, same-fault windows, not a single sample. Grafana's one-minute rates need a fresh observation window after each change.

## Seed Assignment 3

First restore clean proxy/configuration state: click **Clear all faults** in Fault injection and **Restore default settings** in Fallbacks & timeouts. Choose exactly one scenario. Tell participants only that there is a controlled incident. Participants can enable mitigations in the second tab without a terminal or container restart.

On Windows or Mac, the facilitator can seed scenario A in [Network Faults](http://localhost:8089) by choosing **Inventory**, entering **1500 ms**, and clicking **Apply delay**. For scenario B, choose **Shipping** and click **Disconnect**. Keep the load profile running and use **Clear all faults** afterward. The PowerShell commands below are an alternative for scenario A if you want the toxic named `incident` rather than `workshop-latency`.

**A — slow Inventory.** Using PowerShell, set `$proxyApi='http://localhost:8478'`, then:

```powershell
$fault = @{ name='incident'; type='latency'; stream='downstream'; attributes=@{latency=1500; jitter=0} } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/inventory/toxics" -ContentType 'application/json' -Body $fault -UserAgent 'field-workshop/1.0'
```

**B — unavailable Shipping.** With the same `$proxyApi`:

```powershell
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/shipping" -ContentType 'application/json' -Body '{"enabled":false}' -UserAgent 'field-workshop/1.0'
```

Do not announce the selected scenario before teams submit their diagnosis. The scenarios are deterministic and fully local. A team can inspect Toxiproxy after stating its data-backed hypothesis.

## Cleanup and safety

Use **Clear all faults** in Fault injection, then **Restore default settings** in Fallbacks & timeouts, and confirm both Storefront actions return live information. Before each GameDay, ask teams to state blast radius and an abort condition. If impact exceeds the condition, remove the fault or reconnect the dependency immediately. There is no automatic abort. End with **stop.bat** on Windows or **stop.command** on Mac; challenge answers remain in the participant's browser. Runtime mitigation settings reset to the startup configuration when Storefront restarts.

## Discussion prompts

Did HTTP success mean useful information? Was a fallback honest about uncertainty? Did the experiment isolate one cause? What did the `rate()` window hide or reveal? Would the same mitigation be safe for actual purchase placement? Which other stakeholders would you involve before running this in production?
