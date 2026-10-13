# Chaos Engineering Workshop

A completely local, single-participant workshop with four engineering assignments. The practical exercises are designed for roughly **45–55 minutes** in total; no timers are imposed. Participants define steady state, form hypotheses, inject controlled faults, interpret real measurements, and validate resilience changes.

## Start on Windows

Install and start Docker Desktop. Double-click `scripts/start-workshop.bat` from this repository, or run `docker compose up -d --build --wait` here. The first run needs Internet access to download base images and dependencies. Wait for the script to report that the workshop is ready.

Open:

- Workshop: **http://localhost:8080**
- Grafana dashboard: **http://localhost:3000/d/workshop-observability/workshop-observability**
- Prometheus: **http://localhost:9090**

The Grafana data source and dashboard are provisioned automatically. No account, cloud service, or manual proxy configuration is needed. Stop with `scripts/stop-workshop.bat` or `docker compose down`. Workshop challenge progress is in controller memory and disappears on controller restart.

The three published ports bind to `127.0.0.1` only; business services and Toxiproxy are not exposed on the host.

For an offline workshop, **build and pull all images while online first**. After preparation, `docker compose up -d --no-build --pull never --wait` starts using local images. No CDN or external authentication is used at runtime. Rebuilding offline additionally requires Maven/npm dependencies cached by Docker; ordinary workshop use does not rebuild.

## Practical assignments

1. **Network Latency · guided · 8–10 minutes.** Establish normal product-page behavior, test +1500 ms Stock latency, justify a mitigation, and repeat the same fault. The workshop dashboard introduces the process.
2. **Service Unavailable · intermediate · 10–12 minutes.** Investigate a Shipping outage, its blast radius, and whether the order summary can remain usable.
3. **Independent Experiment · advanced · 12–15 minutes.** Select steady-state metrics, fault magnitude, blast radius, and an abort condition. Design and interpret your own Stock experiment.
4. **Mini GameDay · capstone · 15–18 minutes.** Use Grafana to investigate a hidden, reproducible incident; record a diagnosis and plan; reproduce a safe predefined fault; apply a resilience change; and compare the same fault before/after mitigation.

Each assignment begins with scenario, success criteria, tools, and deliverable. The optional **Chaos Engineering Toolbox** and **Architecture** pages explain the real components. The overview's **Reset Entire Workshop** stops traffic, removes faults, restores default settings, and clears challenge records. Individual challenges have their own reset buttons.

The four direct links are `http://localhost:8080/#challenge-1` through `#challenge-4`.

See the [participant guide](docs/participant-guide.md), [facilitator guide](docs/facilitator-guide.md), [Phase 6 facilitator notes](docs/phase-6-facilitator.md), and [architecture notes](docs/architecture.md).

## Repository map and checks

- `frontend/` — React assignment UI and simplified live metrics.
- `workshop-controller/` — workflow state, real request generation, measurement, and fault control.
- `services/` — Storefront, Inventory, and Shipping.
- `challenges/` — local challenge definitions and outcome thresholds.
- `observability/` — Prometheus scrape and Grafana provisioning/dashboard.
- `scripts/` — Windows one-click start and stop.
- `docs/` — participant, facilitator, architecture, and API guides.

With Java 21/Maven, run `mvn test` at the root. With Node, run `npm ci`, `npm test`, and `npm run build` in `frontend/`. Docker alternatives are `docker compose build` and the local Maven/Node images. `docker compose ps` shows container health; `docker compose logs workshop-controller storefront-service prometheus grafana` helps diagnose startup or monitoring issues.
