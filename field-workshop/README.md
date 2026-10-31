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
2. On Windows, double-click **start.bat**. On Mac, double-click **start.command**. Either launcher downloads/builds the images, starts every service plus light traffic, and opens the workshop overview, Storefront, Network Faults console, Grafana dashboard, and Prometheus in your default browser.
3. Use the matching **stop.bat** or **stop.command** when finished.

No WebStorm, Node.js installation, or typed terminal commands are needed for startup. The first start needs Internet access to pull Docker images and may take several minutes. If Grafana is initially blank, wait for two scrapes and refresh it. The light traffic generator runs at about three requests per second. Docker Desktop must be installed for the laptop's architecture; both Intel and Apple-silicon Macs are supported by the pinned container images. macOS may ask for approval before opening a downloaded script; approve only a ZIP from your trusted workshop organizer.

For a single terminal command from the repository root or the extracted ZIP, use `.\start.bat` in Windows PowerShell or `bash ./start.command` on Mac. Stop with `.\stop.bat` or `bash ./stop.command`. In a source checkout, the launchers live at the repository root, one directory above this README. Docker Desktop must already be running; these commands start the workshop containers and open all five pages after their HTTP health checks pass. Startup waits up to 120 seconds for readiness after the build; if it fails, the launcher shows container status and keeps the error visible. Health checks use the applications' local health endpoints so intentional dependency faults remain usable during experiments.

The ZIP contains the workshop source and configuration. Docker supplies Node.js and the monitoring tools inside containers, so participants do not install them separately. The initial Docker image download can still be substantial; Docker reuses the cached images and build layers on subsequent starts. Prepare the images before class if the classroom connection is limited.

For maintainers, run `package-workshop.ps1` from the repository root to generate `dist/northstar-workshop.zip`. The old `northstar-workshop-windows.zip` name is also generated as an identical compatibility copy. The ZIP is not published automatically; upload it to your course platform or release page. For manual troubleshooting, start from this directory with `docker compose --profile load up --build -d` and stop with `docker compose --profile load down`. Participants can complete all four challenges using browser controls; no terminal or code edits are required.

## Practical work

The home page has the quick start and all tool links; the sidebar shows four challenges and their lock status. Challenge 1 is available immediately. For each challenge, complete the experiment and select **Submit notes**. An example solution appears beside your notes and the next challenge unlocks. Answers are not graded; filled-in fields are the only submission requirement. Drafts and submissions are stored in the browser, not on the server. **Download notes** exports a JSON copy. Export before clearing browser data or switching computers. **Reset all answers** on the home page (or **Clear notes** in the sidebar) asks for confirmation, clears drafts and submissions, and locks Challenges 2–4 again. It erases only browser progress, not Docker, faults, or mitigations.

The overview contains the working briefs; [the four assignments](docs/assignments.md) are also available as a standalone handout. [The experiment record template](docs/experiment-record.md) shows what a complete engineering report should contain. In Network Faults, **Fault injection** changes the real Toxiproxy paths; the second tab, **Fallbacks & timeouts**, applies Storefront mitigation settings immediately, with presets for Challenges 1 and 2 and a restore-defaults button. Settings apply to new requests without restarting containers or resetting counters. They remain until Storefront restarts and reloads its startup configuration. Clearing faults, restoring settings, and clearing answers are separate actions.

The same console works on Windows and Mac: all buttons send platform-independent HTTP requests. **Info & commands** includes a Windows PowerShell / Mac Terminal selector for optional command examples. The [tool reference](docs/tool-reference.md) documents those APIs. The Storefront settings listener is internal to Docker and has no published host port; the console uses neither a Docker socket nor a host shell. A facilitator can seed the third assignment using [facilitator notes](docs/facilitator.md).

The Storefront offers product availability and an order **preview**, not a live checkout. A fallback never invents stock or a shipping price: it reports that the value is unconfirmed. This is a deliberate business trade-off to discuss.

## Run tests

```powershell
node --test tests/*.test.mjs
docker compose config --quiet
```

The Node tests use only the standard library and temporary loopback servers. Docker is needed for the complete Toxiproxy/Prometheus/Grafana path.
