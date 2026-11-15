# Challenge briefs

Follow the tasks and submit notes in [the workshop](http://localhost:8088). These briefs are a quick overview; the browser contains the full instructions.

## 1. One slow product blocks the shop

Apply a **1500 ms delay to Lighting inventory**. Measure how the lamp's slow check affects chair and desk through the shared worker. Compare a **400 ms Inventory timeout**, then the circuit breaker. Fallback is optional: it changes the lamp result to **Stock unconfirmed**.

## 2. Keep delivery information available

**Disconnect Primary Shipping** and compare stock with delivery results. Enable Shipping fallback and verify backup quotes for all three products: **€4.90 / 5 days**, compared with the primary's **€4.90 / 3 days**. The breaker is optional for this outage.

## 3. Reject wrong or missing values

Test **Wrong or missing values** on both Lighting inventory and Primary Shipping. Compare HTTP success with **Response checks** in Grafana. Enable **Check response data** for the affected service and verify that invalid replies are discarded while the last valid information remains visible.

## 4. Diagnose your partner's incident

Record baselines on both machines, then each partner introduces one hidden fault on the other's machine. Start both timers once faults are active. Diagnose, mitigate and document the impact while keeping the fault active and its settings hidden. Stop each timer after recording the results, then compare times.

## For every experiment

Compare healthy, faulted and mitigated results using unchanged traffic and equal **60–90-second windows**. Record customer results, latency, workers, queue and new rejections. Clear faults, restore default settings and verify recovery afterward. Notes are saved in your browser; use **Download notes** to export them.
