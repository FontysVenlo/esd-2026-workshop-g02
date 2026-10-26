# Tool reference (Windows PowerShell and Mac Terminal)

These are real tool/API operations. The [Network Faults console](http://localhost:8089) offers graphical controls for routine latency and disconnection experiments, and its **Info & commands** tab shows the underlying HTTP requests. Run the commands below from the extracted workshop folder unless stated otherwise. Inspect the response after each change. The Toxiproxy API is exposed only on localhost. The PowerShell commands are for Windows; Mac equivalents follow.

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

Use the same API for either proxy. Do not reconfigure proxy upstream targets. For a clean reset, remove faults, re-enable both proxies, stop the load generator, and reset mitigation variables; `docker compose down` followed by `docker compose up --build -d` recreates the whole local stack.

## Change the Storefront's behavior

The Storefront begins with 3000 ms timeouts and no fallback. These variables are deliberately ordinary deployment configuration; recreate only the Storefront after changing them:

```powershell
$env:INVENTORY_TIMEOUT_MS = '400'
$env:INVENTORY_FALLBACK = 'true'
docker compose up -d --force-recreate storefront
```

For Shipping, use `SHIPPING_TIMEOUT_MS` and `SHIPPING_FALLBACK`. To return to defaults in the same PowerShell session:

```powershell
Remove-Item Env:INVENTORY_TIMEOUT_MS,Env:INVENTORY_FALLBACK,Env:SHIPPING_TIMEOUT_MS,Env:SHIPPING_FALLBACK -ErrorAction SilentlyContinue
docker compose up -d --force-recreate storefront
```

The code is in `services/storefront.mjs` if your GameDay calls for a code change. Rebuild with `docker compose up --build -d storefront`. A fallback changes business behavior: it keeps an informational page available, but does **not** assert stock or a shipping price that could not be verified.

## Mac Terminal equivalents

The Mac **Start Workshop.command** and **Stop Workshop.command** files handle normal startup and shutdown without typing commands. For an experiment, open Terminal in the extracted workshop folder. To use the Dock or Finder, you can type `cd ` in Terminal, drag the extracted folder into the window, and press Return. Docker Desktop must already be running.

Use [Network Faults](http://localhost:8089) to add/remove latency or disconnect/reconnect a dependency. In Terminal, apply the example Inventory timeout and fallback with:

```sh
INVENTORY_TIMEOUT_MS=400 INVENTORY_FALLBACK=true docker compose up -d --force-recreate storefront
```

For the Shipping fallback:

```sh
SHIPPING_FALLBACK=true docker compose up -d --force-recreate storefront
```

The values before `docker compose` apply to that one command; Compose writes them into the recreated Storefront container. To return to defaults, ensure no earlier exported settings remain in your shell and recreate it:

```sh
unset INVENTORY_TIMEOUT_MS INVENTORY_FALLBACK SHIPPING_TIMEOUT_MS SHIPPING_FALLBACK
docker compose up -d --force-recreate storefront
```

For manual status or logs, run `docker compose ps` or `docker compose logs -f storefront`. The command-line Docker binary comes with Docker Desktop; if Terminal cannot find it, check Docker Desktop's CLI tools setting and reopen Terminal.

## Raw monitoring

Try these in the Prometheus expression browser at <http://localhost:9098>:

```promql
sum by (route, status) (rate(workshop_http_requests_total{service="storefront"}[1m]))
histogram_quantile(0.95, sum by (le, route) (rate(workshop_http_request_duration_seconds_bucket{service="storefront"}[1m])))
sum by (dependency, outcome) (rate(workshop_dependency_calls_total[1m]))
sum by (dependency) (rate(workshop_fallbacks_total[1m]))
```

The Grafana dashboard visualizes these real series. It does not invent example measurements. The customer page also reports browser-observed latency for the last action.
