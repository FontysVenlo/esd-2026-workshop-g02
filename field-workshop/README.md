# Northstar Supply — field workshop

A small, runnable commerce system for hands-on Chaos Engineering. The overview contains four assignments and saves participant notes. The customer page remains the application to investigate.

## Edit the website text

The running website reads its copy from `content/`:

- `challenge-1.json` through `challenge-4.json`: one challenge per file, including its overview summary, brief, steps, completion criteria, answer labels/prompts, mitigation help, and example solution.
- `tasks-shared.json`: repeated assignment text, including setup, cleanup, measurement guidance, mitigation guidance, and shared input labels. Challenge files insert these values with references such as `{{measurementGuidance}}`. Edit the shared value to update every challenge that uses it; keep reference names intact. References can be a complete value or part of a longer sentence and must point directly to plain text in this file.
- `shared.json`: all remaining website copy, grouped by workshop, Storefront, Network Faults, page templates, and API messages.

Edit JSON values while keeping keys and placeholders such as `{number}` intact. Challenge `id`, `number`, field `key`, and `mitigationGuide` are identifiers used by the application; keep them unchanged when editing wording. Text is rendered as plain text, so HTML tags in JSON are displayed literally. JSON supports `\n` for line breaks but does not support comments or trailing commas.

After editing, rebuild the images and restart the stack using the start launcher, then refresh the browser. Docker copies these files into the image; editing the host JSON alone does not change an already running container. Participant notes keep their existing storage format. Markdown handouts in `docs/` and the Grafana dashboard remain separate documents; synchronize their wording when changing an assignment.

## What runs

Storefront shows customer results; internal worker, queue, rejection and circuit monitoring lives in Grafana. The dashboard includes current counts, history, per-product dependency state and sampled retry delays. Prometheus scrapes every five seconds, so it can miss brief transitions. Rejection totals reset on Storefront restart; compare fresh equal windows using the rejection rate or estimated one-minute increase.

`Browser → Storefront → Toxiproxy → Inventory / Shipping`

The Storefront cannot contact either dependency directly. Toxiproxy is initialized with four fixed local branches to the same two services: the faultable lamp Inventory/Shipping paths and healthy Inventory/Shipping paths shared by chair and desk. All products share two Storefront workers, with a bounded queue (12 waiting operations, 1000 ms queue deadline). The complete catalog requires every product result unless fallback is enabled. Prometheus scrapes real application metrics every five seconds; Grafana is provisioned with a local dashboard. No CDN or cloud account is used.

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

No WebStorm, Node.js installation, or typed terminal commands are needed for startup. The first start needs Internet access to pull Docker images and may take several minutes. If Grafana is initially blank, wait for two scrapes and refresh it. The light traffic generator runs at five requests per second (three for the lamp, one each for chair and desk). Docker Desktop must be installed for the laptop's architecture; both Intel and Apple-silicon Macs are supported by the pinned container images. macOS may ask for approval before opening a downloaded script; approve only a ZIP from your trusted workshop organizer.

For a single terminal command from the repository root or the extracted ZIP, use `.\start.bat` in Windows PowerShell or `bash ./start.command` on Mac. Stop with `.\stop.bat` or `bash ./stop.command`. In a source checkout, the launchers live at the repository root, one directory above this README. Docker Desktop must already be running; these commands start the workshop containers and open all five pages after their HTTP health checks pass. Startup waits up to 120 seconds for readiness after the build; if it fails, the launcher shows container status and keeps the error visible. Health checks use the applications' local health endpoints so intentional dependency faults remain usable during experiments.

The ZIP contains the workshop source and configuration. Docker supplies Node.js and the monitoring tools inside containers, so participants do not install them separately. The initial Docker image download can still be substantial; Docker reuses the cached images and build layers on subsequent starts. Prepare the images before class if the classroom connection is limited.

For maintainers, run `package-workshop.ps1` from the repository root to generate `dist/northstar-workshop.zip`. The old `northstar-workshop-windows.zip` name is also generated as an identical compatibility copy. The ZIP is not published automatically; upload it to your course platform or release page. For manual troubleshooting, start from this directory with `docker compose --profile load up --build -d` and stop with `docker compose --profile load down`. Participants can complete all four challenges using browser controls; no terminal or code edits are required.

## Practical work

The home page has the quick start and all tool links; the sidebar shows four challenges and their lock status. Challenge 1 is available immediately. For each challenge, complete the experiment and select **Submit notes**. An example solution appears beside your notes and the next challenge unlocks. Answers are not graded; filled-in fields are the only submission requirement. Drafts and submissions are stored in the browser, not on the server. **Download notes** exports a JSON copy. Export before clearing browser data or switching computers. **Reset all answers** on the home page (or **Clear notes** in the sidebar) asks for confirmation, clears drafts and submissions, and locks Challenges 2–4 again. It erases only browser progress, not Docker, faults, or mitigations.

The overview contains the working briefs; [the four assignments](docs/assignments.md) are also available as a standalone handout. [The experiment record template](docs/experiment-record.md) shows what a complete engineering report should contain. In Network Faults, **Fault injection** changes the real Toxiproxy paths; the second tab, **Fallbacks & timeouts**, applies Storefront mitigation settings immediately, with presets for Challenges 1 and 2 and a restore-defaults button. Settings apply to new requests without restarting containers or resetting counters. They remain until Storefront restarts and reloads its startup configuration. Clearing faults, restoring settings, and clearing answers are separate actions.

The same console works on Windows and Mac: all buttons send platform-independent HTTP requests. **Info & commands** includes a Windows PowerShell / Mac Terminal selector for optional command examples. The [tool reference](docs/tool-reference.md) documents those APIs. The Storefront settings listener is internal to Docker and has no published host port; the console uses neither a Docker socket nor a host shell. A facilitator can seed the third assignment using [facilitator notes](docs/facilitator.md).

The three-product catalog visibly demonstrates propagation: a slow lamp consumes shared workers and can delay/reject healthy products; a missing lamp quote rejects the full delivery catalog. Inventory mitigation disables the unconfirmed lamp availability action while keeping healthy products live. Enabling fallback also enables a per-product/dependency circuit breaker with a five-second cooldown and a single recovery probe. The timeout releases capacity, the breaker pauses repeated failed calls, and fallback preserves useful partial data. Grafana and Storefront show real queue, rejection, latency and circuit state.

The Storefront offers product availability and an order **preview**, not a live checkout. A fallback never invents stock or a shipping price: it reports that the value is unconfirmed. This is a deliberate business trade-off to discuss.

## Run tests

All workshop-owned pages use React: `src/storefront.jsx`, `src/workshop.jsx` (overview and all challenges), `src/fault-console.jsx`, and `src/tools.jsx`. Shared JavaScript helpers live in `src/shared/`; editable copy lives in `content/`; images and CSS live in `public/`. Run `pnpm install --frozen-lockfile --ignore-scripts` then `pnpm build` after changing source or public assets. The build generates the browser JavaScript, license notices, and minimal HTML entry shells into ignored `build/`. Do not commit generated files. Docker builds them automatically in a separate build stage, and the workshop ZIP includes only source and configuration. Grafana and Prometheus remain externally supplied applications.

Product photos in `public/images/` were generated for this demo. Copy remains in `content/`; the React bundle imports shared copy at runtime so rebuilding the bundle is not required for wording edits. Rebuild/restart containers as described above. Product cards retain the previous catalog while refreshing and explicitly label it as last known data after a failure or view change. Individual checks remain independent of background catalog polling.

```powershell
pnpm test
docker compose config --quiet
```

`pnpm test` builds the frontend first, then runs Node tests using the standard library and temporary loopback servers. For direct Node testing, run `node build.mjs` before `node --test tests/*.test.mjs`. Build output is also required before starting the services directly with Node. Docker is needed for the complete Toxiproxy/Prometheus/Grafana path.
