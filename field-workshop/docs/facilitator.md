# Facilitator notes

Keep this file away from participants until after Assignment 3. At <http://localhost:8088>, participants submit notes, see an example solution beside their inputs, and unlock the next challenge. There is no correctness evaluation. Records are stored in each participant's browser, so ask them to download the JSON experiment record for review. The incident seed is an actual Toxiproxy state change, not hidden application state.

## Before participants arrive

Generate `northstar-workshop.zip` with `package-workshop.ps1` and distribute it to participants. Have them extract it fully. Pull/build the images while online, start the stack with **Start Workshop.bat** (Windows) or **Start Workshop.command** (Mac), and verify Grafana plus Prometheus targets. If Docker images are already present, the workshop can run without Internet. Ensure ports 8088, 8089, 3008, 9098 and 8478 are free. Test both launchers on representative participant laptops before the session; archive metadata checks alone do not prove macOS Gatekeeper behavior.

## Expected behavior

- Healthy Inventory and Shipping: product and order preview succeed with low local latency.
- Inventory +1500 ms: product and preview latency rise by roughly 1.5 seconds without a short timeout.
- Inventory timeout around 400 ms plus fallback: the informational response returns sooner with **unconfirmed** stock; fallback metrics rise. A real purchase should not rely on it.
- Shipping disconnected: product availability still works; order preview fails by default. Shipping fallback can keep the preview available but without an invented quote.

Numbers depend on the host and browser. Ask teams to compare same-route, same-fault windows, not a single sample. Grafana's one-minute rates need a fresh observation window after each change.

## Seed Assignment 3

First restore clean proxy/configuration state. Choose exactly one scenario. Tell participants only that there is a controlled incident.

On Windows or Mac, the facilitator can seed scenario A in [Network Faults](http://localhost:8089) by choosing **Inventory**, entering **1200 ms**, and clicking **Apply delay**. For scenario B, choose **Shipping** and click **Disconnect**. Use **Clear all faults** afterward. The PowerShell commands below are an alternative for scenario A if you want the toxic named `incident` rather than `workshop-latency`.

**A — slow Inventory.** Using PowerShell, set `$proxyApi='http://localhost:8478'`, then:

```powershell
$fault = @{ name='incident'; type='latency'; stream='downstream'; attributes=@{latency=1200; jitter=0} } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/inventory/toxics" -ContentType 'application/json' -Body $fault -UserAgent 'field-workshop/1.0'
```

**B — unavailable Shipping.** With the same `$proxyApi`:

```powershell
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/shipping" -ContentType 'application/json' -Body '{"enabled":false}' -UserAgent 'field-workshop/1.0'
```

Do not announce the selected scenario before teams submit their diagnosis. The scenarios are deterministic and fully local. A team can inspect Toxiproxy after stating its data-backed hypothesis.

## Cleanup and safety

Remove the `incident` toxic if A was used. Re-enable Shipping if B was used. Clear all mitigation environment variables, recreate Storefront, and confirm both routes work. Before each GameDay, ask teams to state blast radius and an abort condition. If impact exceeds the condition, remove the toxic or re-enable the proxy immediately. There is no automatic abort. End with `docker compose down`; no Docker volume stores challenge state.

## Discussion prompts

Did HTTP success mean useful information? Was a fallback honest about uncertainty? Did the experiment isolate one cause? What did the `rate()` window hide or reveal? Would the same mitigation be safe for actual purchase placement? Which other stakeholders would you involve before running this in production?
