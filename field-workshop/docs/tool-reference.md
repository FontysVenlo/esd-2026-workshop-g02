# Tool and API reference

Use [Network Faults](http://localhost:8089) for fault injection and live protections. **Info & commands** shows equivalent Windows/Mac requests. The [Commands page](http://localhost:8088/tools) has copyable examples.

## Docker

Run from `field-workshop/` in a checkout or the extracted ZIP folder:

```sh
docker compose --profile load up --build -d --wait
docker compose ps
docker compose logs -f storefront
docker compose --profile load down
```

## Customer and monitoring endpoints

GET requests on `http://localhost:8088`:

| Path | Result |
| --- | --- |
| `/api/catalog` | Stock for all three products |
| `/api/catalog?preview=true` | Stock and delivery quotes |
| `/api/product?sku=CHAIR-02` | One product's stock; also `LAMP-01` or `DESK-03` |
| `/api/order-preview?sku=CHAIR-02` | One product's stock and quote |
| `/api/system` | Worker, queue, rejection and circuit state |

Catalog HTTP 200 responses can contain individual product errors. Check each product's result as well as transport status.

## Fault and protection endpoints

Requests below use `http://localhost:8089`. POST bodies must be JSON with `Content-Type: application/json`. `proxy` and `dependency` accept `inventory` (Lighting) or `shipping` (Primary Shipping).

| Method and path | Request or purpose |
| --- | --- |
| `GET /api/state` | Current injected faults |
| `POST /api/action` | `action`: `set-latency`, `remove-latency`, `disconnect`, `reconnect` or `reset`. Include `proxy` except for reset. Delay requires `latencyMs` (50–5000); optional `jitterMs` is 0–latencyMs. |
| `GET /api/response-fault?proxy=inventory` | Current response fault |
| `POST /api/response-fault` | `proxy` and `mode`: `none`, `invalid-data` or `intermittent-errors` |
| `GET /api/mitigations` | Current protections for both services |
| `POST /api/mitigations` | `action: configure`, `dependency`, `timeoutMs` (50–5000) and boolean `fallback`; optional booleans `breaker` and `validate` preserve their current values when omitted |

Inventory timeout example, with other protections off:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8089/api/mitigations' -ContentType 'application/json' -Body '{"action":"configure","dependency":"inventory","timeoutMs":400,"fallback":false,"breaker":false,"validate":false}'
```

The same request in Mac Terminal:

```sh
curl -f -sS -X POST 'http://localhost:8089/api/mitigations' -H 'Content-Type: application/json' --data '{"action":"configure","dependency":"inventory","timeoutMs":400,"fallback":false,"breaker":false,"validate":false}'
```

To clear faults, POST `{"action":"reset"}` to `/api/action`. To restore protections, POST the same body to `/api/mitigations`: both timeouts become 3000 ms and fallback, breaker and validation turn off. These are separate operations. Changes affect new requests; Storefront restart reloads its startup settings.

Network faults use Toxiproxy, whose raw API is at `http://localhost:8478`. Response faults change service replies directly.

## Read the measurements

[Grafana](http://localhost:3008/d/field-workshop/field-workshop) shows customer latency, shared capacity, dependency outcomes and response checks. **Response checks** reports invalid values even with enforcement off; **Responses rejected** counts discarded replies when enforcement is on. **Product results** includes errors inside HTTP 200 catalog responses.

[Prometheus](http://localhost:9098) scrapes every two seconds. Grafana's one-minute rates need a fresh observation window after each change. Product latency includes queue time; dependency latency measures the backend call. Expand **More diagnostics** for circuit state and retry delays.
