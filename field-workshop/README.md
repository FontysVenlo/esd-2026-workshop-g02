# Northstar Supply — field workshop

A small, runnable commerce system for hands-on Chaos Engineering. The overview contains four assignments and saves participant notes. The customer page remains the application to investigate.

## What runs

`Browser → Storefront → Toxiproxy → Inventory / Shipping`

The Storefront cannot contact either dependency directly. Toxiproxy is initialized with two fixed local proxies when the stack starts. Prometheus scrapes real application metrics every five seconds; Grafana is provisioned with a local dashboard. No CDN or cloud account is used.

| Tool | Local address | What you use it for |
| --- | --- | --- |
| Workshop overview | <http://localhost:8088> | Read assignments, save evidence notes, unlock the next task |
| Storefront | <http://localhost:8088/storefront> | Try the customer journey |
| Network Faults console | <http://localhost:8089> | Apply real latency/outages and inspect the API commands |
| Grafana | <http://localhost:3008/d/field-workshop/field-workshop> | Investigate latency, errors and dependency behavior |
| Prometheus | <http://localhost:9098> | Inspect or query raw time series |
| Toxiproxy API | <http://localhost:8478> | Optional raw API access from a client, not a browser dashboard |

All host ports bind to `127.0.0.1`.

## Start and stop

Distribute `northstar-workshop.zip` and use its included `START-HERE.txt`:

1. Install and start [Docker Desktop](https://docs.docker.com/desktop/). Extract the ZIP fully and open the extracted folder. Do not run a launcher from a ZIP preview.
2. On Windows, double-click **Start Workshop.bat**. On Mac, double-click **Start Workshop.command**. Either launcher downloads/builds the images, starts every service plus light traffic, and opens <http://localhost:8088>.
3. Use the matching **Stop Workshop.bat** or **Stop Workshop.command** when finished.

No WebStorm, Node.js installation, or typed terminal commands are needed for startup. The first start needs Internet access to pull Docker images and may take several minutes. If Grafana is initially blank, wait for two scrapes and refresh it. The light traffic generator runs at about three requests per second. Docker Desktop must be installed for the laptop's architecture; both Intel and Apple-silicon Macs are supported by the pinned container images. macOS may ask for approval before opening a downloaded script; approve only a ZIP from your trusted workshop organizer.

For maintainers, run `package-workshop.ps1` from the repository root to generate `dist/northstar-workshop.zip`. The old `northstar-workshop-windows.zip` name is also generated as an identical compatibility copy. The ZIP is not published automatically; upload it to your course platform or release page. For manual troubleshooting, start from this directory with `docker compose --profile load up --build -d` and stop with `docker compose --profile load down`. Challenge mitigation changes may still use the Windows or Mac commands in the tool reference.

## Practical work

The home page has the quick start and all tool links; the sidebar shows four challenges and their lock status. Challenge 1 is available immediately. For each challenge, complete the experiment and select **Submit notes**. An example solution appears beside your notes and the next challenge unlocks. Answers are not graded; filled-in fields are the only submission requirement. Drafts and submissions are stored in the browser, not on the server. **Download notes** exports a JSON copy. Export before clearing browser data or switching computers. **Clear notes** erases only browser progress, not Docker, faults, or mitigations.

The overview contains the working briefs; [the four assignments](docs/assignments.md) are also available as a standalone handout. [The experiment record template](docs/experiment-record.md) shows what a complete engineering report should contain. The Network Faults console changes the real Toxiproxy paths and displays the HTTP requests in its **Info & commands** tab. It does not change mitigation settings or clear metrics. [The tool reference](docs/tool-reference.md) has Windows PowerShell and Mac Terminal examples for Compose; the assignments intentionally leave decisions to participants. A facilitator can seed the third assignment using [facilitator notes](docs/facilitator.md).

The Storefront offers product availability and an order **preview**, not a live checkout. A fallback never invents stock or a shipping price: it reports that the value is unconfirmed. This is a deliberate business trade-off to discuss.

## Run tests

```powershell
node --test tests/*.test.mjs
docker compose config --quiet
```

The Node tests use only the standard library and temporary loopback servers. Docker is needed for the complete Toxiproxy/Prometheus/Grafana path.
