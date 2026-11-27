# Facilitator checklist

## Prepare

- Run `./package-workshop.ps1` in PowerShell from the repository root and distribute `dist/northstar-workshop.zip`.
- Ask participants to install and start Docker Desktop, fully extract the ZIP, then run `start.bat` (Windows) or `bash ./start.command` (Mac). Test both platforms before the session.
- Build and start once while online so images and dependencies are cached. Keep ports **8088, 8089, 3008, 9098 and 8478** free.
- Check the [workshop](http://localhost:8088), [Storefront](http://localhost:8088/storefront), [Network Faults](http://localhost:8089), [Grafana](http://localhost:3008/d/field-workshop/field-workshop) and [Prometheus targets](http://localhost:9098/targets). All six scrape targets should be UP.

## Run the session

The launcher supplies **3.5 requests/second**. Keep traffic unchanged and compare fresh **60–90-second windows**. Exact timings vary by machine.

| Challenge | Expected result |
| --- | --- |
| 1 | Slow lamp stock occupies the shared worker. A 400 ms timeout frees it sooner; the breaker reduces repeated waits. Fallback only changes the lamp's displayed result. |
| 2 | Shipping fallback restores €4.90 quotes with 5-day delivery during the primary outage. The breaker is optional. |
| 3 | Test bad stock and shipping values. Response checks detect invalid HTTP 200 replies; enforcement discards them and retains the last valid information. It does not call the backup. |
| 4 | Each partner sets one hidden fault on the other's machine. Both diagnose, mitigate, test and document before stopping their own timer. Keep faults active until results are recorded. |

Open each challenge before injecting faults: the first visit to Challenges 2–4 resets the environment. Fault and protection controls remain available throughout. Agree on acceptable customer results and when to abort an experiment.

Submitting requires completed fields and unlocks the next challenge; it does not grade correctness. Example solutions appear for Challenges 1–3. Ask participants to export their browser notes for review.

## Finish

Use **Clear all faults**, then **Restore default settings**, and verify live stock and normal delivery information. Stop with `stop.bat` or `bash ./stop.command`. Notes remain in the browser; Storefront runtime settings and cached values are lost on restart.
