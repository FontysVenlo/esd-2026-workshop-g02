# Northstar Supply reliability workshop

A hands-on Chaos Engineering workshop with a three-product shop. Inject Inventory and Shipping faults, observe their impact in Grafana, and test timeouts, circuit breakers, fallbacks and response validation across four challenges.

## Start

1. Start Docker Desktop and wait until the engine is ready.
2. If using the workshop ZIP, extract it fully.
3. Run the launcher from the repository root or extracted folder:

| Platform | Start | Stop |
| --- | --- | --- |
| Windows | Double-click `start.bat` or run `.\start.bat` | `stop.bat` |
| Mac | Double-click `start.command` or run `bash ./start.command` | `bash ./stop.command` |

The first start downloads and builds the Docker images and may take several minutes. The launcher starts background traffic and opens all five pages once ready.

### Alternative: Start with Bun 

Install and start Docker Desktop. Install [Bun](https://bun.com/docs/installation) once:

Windows PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Mac Terminal:

```sh
curl -fsSL https://bun.com/install | bash
```

Open a new terminal in the repository root, then run:

```sh
bun install --frozen-lockfile
bun run dev
```

Docker installs the workshop dependencies and opens the pages once ready. Saving files under `content/`, `src/` or `public/` in `field-workshop/` rebuilds and refreshes the pages. Restart after backend changes.

Keep the terminal open. Press **Ctrl+C** to stop; remove the containers with:

```sh
bun run stop
```

| Page | Address |
| --- | --- |
| Workshop and challenges | [localhost:8088](http://localhost:8088) |
| Storefront | [localhost:8088/storefront](http://localhost:8088/storefront) |
| Network Faults | [localhost:8089](http://localhost:8089) |
| Grafana | [Workshop dashboard](http://localhost:3008/d/field-workshop/field-workshop) |
| Prometheus | [localhost:9098](http://localhost:9098) |

## Run an experiment

Open Challenge 1 in the workshop. Measure a healthy baseline, inject a fault in **Network Faults**, then apply protections under **Fallbacks & timeouts**. Compare Storefront results and Grafana over equal 60–90-second windows with unchanged traffic. Clear faults and restore default settings afterward.

Notes are saved in your browser; use **Download notes** to export them.

## Repository guide

- [Chaos Engineering presentation](<Chaos Engineering Presentation final.pdf>): presentation slides (PDF).
- [Challenge briefs](field-workshop/docs/assignments.md): a quick overview of the four experiments.
- [Cheatsheet](CHEATSHEET.md): walkthroughs and expected results.
- [Tool reference](field-workshop/docs/tool-reference.md): API and terminal commands.
- [Facilitator notes](field-workshop/docs/facilitator.md): preparation and session guidance.

