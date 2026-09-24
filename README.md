# Chaos Engineering Workshop

A local, single-participant workshop for practicing controlled failure experiments. Phase 5 adds Challenge 3, an independent experiment, alongside the accepted Challenges 1 and 2.

## Start

Install Docker with Compose, then from this repository run:

```sh
docker compose up --build
```

Wait for the services to start, then open **http://localhost:8080**. Choose a challenge from the overview. Direct links are `http://localhost:8080/#challenge-1`, `http://localhost:8080/#challenge-2`, and `http://localhost:8080/#challenge-3`. Only the workshop UI is published to the host. Once the images are available locally, the workshop runs without an Internet connection. Stop the stack with `docker compose down`.

## Challenge 1 in brief

The five steps are **Measure → Hypothesis → Experiment → Observe → Improve**. Start Traffic and capture at least 15 normal requests as your baseline. Write a prediction, inject the 1500 ms Inventory delay, and capture the failure results. Compare those saved results with the baseline and record your observation. Choose a mitigation, rerun the same delay, and compare all three saved result sets. A short timeout with a graceful stock-information fallback should keep product responses useful and responsive.

The live chart and rolling average are for monitoring; the saved baseline, failure, and post-mitigation windows are the evidence used for comparison. **Reset Challenge** stops traffic, removes the fault, restores default Storefront behavior, clears all measurements and answers, and returns to Step 1.

## Challenge 2 in brief

Challenge 2 asks whether an order summary should fail when Shipping cannot provide an estimate. Capture a normal baseline, predict the effect of losing Shipping, disconnect it, capture the failure, record what changed, then choose an approach and rerun the *same* outage. The Shipping Service stays unavailable during validation; a useful mitigation keeps the order summary working and honestly marks the estimate as unavailable. The interface gives fewer step-by-step instructions than Challenge 1. Each challenge has separate live and captured measurements.

The controller sets up the network fault automatically. Participants do not need to configure infrastructure or use the API. See the [participant guide](docs/participant-guide.md) for the exercise and the [facilitator guide](docs/facilitator-guide.md) for expected results and troubleshooting.

## Challenge 3 in brief

Choose steady-state indicators and save a normal product-page baseline. Write a testable hypothesis and choose a stock-service fault: 500, 1000, or 1500 ms added latency, or an unavailable service. Capture the failure, interpret the saved results, then combine timeout, fallback, retry, and circuit-breaker controls as you see fit. Validation always reruns the *same* selected fault. Completion requires a measurable improvement and a short reflection; the controls are not scored as a preselected answer. Reset restores Challenge 3's separate connection and settings without clearing Challenges 1 or 2.

## Repository map

- `frontend/` — React workshop UI.
- `workshop-controller/` — challenge workflows, traffic, measurements, and fault control.
- `services/` — Storefront, Inventory, and Shipping services.
- `challenges/` — challenge content and technical thresholds.
- `docs/` — participant and facilitator guides, architecture, and API contracts.

## Development checks

Run `npm ci` and `npm run build` in `frontend/` for the UI, or build everything with `docker compose build`. Run Java tests from the repository root with `mvn test` (Java 21 and Maven required). The Docker build does not replace a local test run.
