# Tool reference (Windows PowerShell and Mac Terminal)

These are real tool/API operations. The [Network Faults console](http://localhost:8089) offers graphical controls for routine latency and disconnection experiments, and its **Info & commands** tab shows the underlying HTTP requests. Run the commands below from the folder containing `compose.yaml`: `field-workshop` in a source checkout, or the extracted ZIP folder. Inspect the response after each change. The Toxiproxy API is exposed only on localhost. The PowerShell commands are for Windows; Mac equivalents follow.

## What is a fallback, and how do I enable it?

A fallback is the response the shop uses when a dependency cannot answer. The workshop already implements it; you do not need to write code. Inventory fallback returns **Stock unconfirmed**. Shipping fallback keeps the preview available while reporting **Shipping quote unavailable**. Neither invents stock or delivery information.

Open **Fallbacks & timeouts**, the second tab in [Network Faults](http://localhost:8089/#mitigations). Use the Challenge 1/2 preset or edit a dependency's timeout and fallback checkbox, then click Apply. Settings affect new requests immediately; no terminal or restart is needed. Use **Restore default settings** to turn both fallbacks off and restore 3000 ms timeouts. Reapply the identical fault to test the behavior.

## What is Prometheus for?

Prometheus collects the services' counters and timing measurements every five seconds and stores them as time series. Grafana queries those measurements and presents charts. You can complete the guided experiments using Grafana; opening Prometheus is optional for inspecting raw measurements or writing queries. It does not inject faults or enable fallbacks.

## Start and observe

```powershell
docker compose up --build -d
docker compose --profile load up -d loadgen
docker compose ps
docker compose logs -f storefront
```

In another terminal, try `Invoke-RestMethod http://localhost:8088/api/product` and `Invoke-RestMethod http://localhost:8088/api/order-preview`. Open the product page and the Grafana dashboard. Prometheus's `/targets` page should show three `UP` services.

## Inspect and change network faults

```powershell
$proxyApi = 'http://localhost:8478'
Invoke-RestMethod "$proxyApi/proxies" -UserAgent 'field-workshop/1.0'
```

Add 1500 ms to Inventory responses. Toxiproxy changes the **actual Storefront → Inventory network call**.

```powershell
$fault = @{ name='inventory-lag'; type='latency'; stream='downstream'; attributes=@{latency=1500; jitter=0} } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/inventory/toxics" -ContentType 'application/json' -Body $fault -UserAgent 'field-workshop/1.0'
Invoke-RestMethod -Method Get -Uri "$proxyApi/proxies/inventory" -UserAgent 'field-workshop/1.0'
```

Remove that fault:

```powershell
Invoke-RestMethod -Method Delete -Uri "$proxyApi/proxies/inventory/toxics/inventory-lag" -UserAgent 'field-workshop/1.0'
```

Disconnect and reconnect Shipping:

```powershell
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/shipping" -ContentType 'application/json' -Body '{"enabled":false}' -UserAgent 'field-workshop/1.0'
Invoke-RestMethod -Method Post -Uri "$proxyApi/proxies/shipping" -ContentType 'application/json' -Body '{"enabled":true}' -UserAgent 'field-workshop/1.0'
```

Use the same API for either proxy. Do not reconfigure proxy upstream targets. For a clean experiment baseline, click **Clear all faults** in Fault injection and **Restore default settings** in Fallbacks & timeouts. Keep the supplied light traffic.

## Change Storefront behavior in the browser

Use the **Fallbacks & timeouts** tab on Windows or Mac. Inventory's preset applies a 400 ms timeout and enables fallback; Shipping's preset enables fallback with a 3000 ms timeout. You can also choose a timeout from 50 to 5000 ms and independently enable or disable either fallback.

Settings are held by the running Storefront. New requests use the updated settings; an in-flight request keeps the policy it started with. The console does not restart containers, clear metrics, or change network faults. Restarting Storefront discards runtime changes and reloads its startup configuration (normally 3000 ms timeouts with fallbacks off). Environment variables in Compose are startup overrides for maintainers, not the live settings display.

The console exposes GET and POST at /api/mitigations. A POST accepts either a configure action with dependency, timeoutMs, and a boolean fallback, or a reset action. It forwards only to a fixed internal Storefront settings listener on port 8081, which is not published to the host. No Docker socket, shell commands, or extra platform-specific services are needed.

## Optional command examples

Participants do not need to type these. The console's **Info & commands** tab has a Windows/Mac selector and produces an equivalent command after each successful fault or mitigation change. The [Commands page](http://localhost:8088/tools) has self-contained examples. Both platforms call the same HTTP endpoints.

Windows PowerShell, Inventory example:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8089/api/mitigations' -ContentType 'application/json' -Body '{"action":"configure","dependency":"inventory","timeoutMs":400,"fallback":true}'
```

Mac Terminal, the same change:

```sh
curl -f -sS -X POST 'http://localhost:8089/api/mitigations' -H 'Content-Type: application/json' --data '{"action":"configure","dependency":"inventory","timeoutMs":400,"fallback":true}'
```

For Shipping use dependency shipping and the desired timeout. To restore defaults, POST only an action of reset. Reapply the fault and use Storefront to validate the customer result.

## Raw monitoring

Try these in the Prometheus expression browser at <http://localhost:9098>:

```promql
sum by (route, status) (rate(workshop_http_requests_total{service="storefront"}[1m]))
histogram_quantile(0.95, sum by (le, route) (rate(workshop_http_request_duration_seconds_bucket{service="storefront"}[1m])))
sum by (dependency, outcome) (rate(workshop_dependency_calls_total[1m]))
sum by (dependency) (rate(workshop_fallbacks_total[1m]))
```

The Grafana dashboard visualizes these real series. It does not invent example measurements. The customer page also reports browser-observed latency for the last action.
