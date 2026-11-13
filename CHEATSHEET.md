# Solve the four Northstar challenges

Start Docker Desktop and run the start launcher. Open [the workshop](http://localhost:8088), [Storefront](http://localhost:8088/storefront), [Network Faults](http://localhost:8089), and [Grafana](http://localhost:3008/d/field-workshop/field-workshop) in separate tabs. Leave the launcher’s background traffic running.

| Challenge | Fault to check | Question to answer |
| --- | --- | --- |
| 1 | You add **1500 ms delay to Lighting inventory** | Can a slow lamp stock check make healthy products wait? |
| 2 | You **disconnect Shipping** | Can the backup carrier restore usable quotes during the primary outage? |
| 3 | You inject **invalid shipping responses** | Can HTTP 200 still deliver bad data? |
| 4 | A partner chooses **one hidden fault**, then you swap | Who can diagnose and contain it faster? |

**What to write down.** For each run, record the time, what happened to the lamp, chair and desk, and the catalog status and response time shown in Storefront. In Grafana, check **Shared workers and queue** and **Rejected since restart**. Record how much the rejection counter changed during the run. Use the same customer action, traffic and 60–90-second observation window for each comparison.

The lamp uses Lighting inventory, the chair uses Seating inventory, and the desk uses Desks inventory. A Storefront worker holds one product check until its dependency calls finish. One slow lamp check can occupy the single slot and make a chair wait before Seating inventory even receives its request.

**Three different jobs:** a **timeout** limits waiting; **fallback** supplies a usable alternative after failure (unconfirmed stock or a backup quote); a **breaker** pauses repeated calls after a failure. They can be used independently. A breaker does not supply replacement data.

**Reading Grafana:** `shipping · success` is successful calls **per second**, not a success percentage. It can fall when slow Lighting fills the workers, then rise after containment lets more requests reach healthy Shipping. The chart uses a one-minute window, so changes take time to settle.

**Start each challenge clean.** In Network Faults, click **Clear all faults**. Open **Fallbacks & timeouts** and click **Restore default settings**. Check that all three products have live stock and delivery quotes. Write down what you expect and when you would stop the experiment early.

## 1. Make the lamp stock check slow

**Core mitigation — Inventory timeout 400 ms. Breaker ON reduces repeated waiting. Fallback is optional.** Timeout releases the worker sooner so chair and desk can load. The breaker skips lamp stock requests for five seconds after a failure. Inventory fallback only changes the lamp error to Stock unconfirmed; it does not make the shop faster or restore confirmed stock.

| Inventory timeout | Fallback | Breaker | What to compare |
| --- | --- | --- | --- |
| 3000 ms | ON or OFF | ON or OFF | Slow lamp calls still occupy the worker: 1500 ms completes before the timeout, so fallback and breaker do not activate for the slow lookup. |
| 400 ms | OFF | ON or OFF | The lamp returns an error after its stock attempt times out; chair and desk can load as the worker is released sooner. |
| 400 ms | ON | OFF | The lamp shows Stock unconfirmed; chair and desk retain live results. Each new lamp stock attempt still waits up to 400 ms. |
| **400 ms** | **ON** | **ON** | After the first failure, most lamp requests skip the slow lookup and immediately return unconfirmed stock. Recovery probes may briefly increase latency. |

1. In Storefront, click **Refresh availability**. Record this healthy baseline.
2. In Network Faults, choose **Lighting inventory**, enter **1500** ms and click **Apply delay**. Refresh availability again. Watch the single shared worker in Grafana. A lamp call can occupy it, so the healthy chair and desk may wait or their requests may be rejected.
3. Keep the delay active. In **Fallbacks & timeouts**, set Inventory timeout to **400 ms**, leave fallback and breaker off, and apply. Check whether chair and desk recover while the lamp shows an error.
4. Enable and apply the breaker. Compare repeated waiting and rejections. Optionally enable fallback: the lamp changes to **Stock unconfirmed**, while chair and desk keep working. The **Use Challenge 1 settings** preset enables all three together. Record what each setting actually changes.
5. **Finish:** clear all faults, restore default settings and allow the five-second cooldown to finish. Verify live stock and deliveries, fill in the challenge notes, and click **Submit notes**.

## 2 — Restore quotes with a backup carrier

**Core mitigation — Shipping fallback ON. Breaker ON adds protection.** Fallback alone can restore €4.90 quotes with 5-day delivery. The breaker avoids repeated primary-carrier attempts for five seconds; the visible speed improvement may be small because disconnection already fails quickly. Keep the default 3000 ms timeout for this fault.

| Shipping timeout | Fallback | Breaker | What to compare |
| --- | --- | --- | --- |
| 3000 ms | OFF | OFF | Delivery previews fail while Primary Shipping is disconnected. |
| 3000 ms | OFF | ON | Repeated primary calls stop during cooldown, but delivery quotes remain unavailable. |
| 3000 ms | ON | OFF | Backup quotes restore delivery options, but every request first attempts the failed primary. |
| **3000 ms** | **ON** | **ON** | After a primary failure, requests go straight to the backup during the five-second pause. |

For a **slow primary carrier**, a shorter timeout such as 400 ms reaches the backup sooner. The limit applies separately to each provider call, so verify that the backup can respond within it.

1. Click **Refresh shipping info**. Record €4.90 and 3 days for each product.
2. In Network Faults choose **Primary Shipping (all products)** and **Disconnect**. Stock checks still work, but delivery previews fail. Record this customer impact.
3. Keep the outage active. Under Fallbacks & timeouts keep the Shipping timeout at **3000 ms**, enable **Shipping fallback** and **Shipping circuit breaker**, then click **Apply Shipping settings**. Refresh shipping info. All products should show €4.90 shipping and **5 days** delivery.
4. Reconnect Primary Shipping. If the breaker is enabled, wait five seconds and allow a probe. Refresh again and confirm all products return to €4.90 and 3 days.
5. Restore defaults and submit your measurements. Explain what customers regained and why the extra delivery time is a trade-off.

## 3 — Block invalid quotes, not successful requests

**Use response validation, independently of fallback.** The primary returns HTTP 200 but cycles through negative delivery days, empty fields, a negative price and a normal quote. Timeout and breaker do not detect bad contents in a successful call. Validation blocks the whole invalid quote; it does not request backup Shipping.

1. Open Challenge 3. All fault and protection controls are available at any time. Record healthy stock, shipping and a prediction before injecting anything.
2. In Network Faults, choose **Primary Shipping** and **Wrong or missing values**, then click **Apply response fault**. Click **Refresh shipping info** several times. Record incorrect or missing values while stock stays live.
3. Compare **Dependency outcomes** with **Response checks** in Grafana. Invalid quotes rise despite HTTP success. Optional hints are under the Challenge 3 menu.
4. Keep the fault active. In Fallbacks & timeouts, under Shipping, select **Check response data** and click **Apply Shipping settings**. Incorrect replies are discarded. The last valid quote stays visible with its check time; only a new valid reply updates it. With no valid history, delivery information is unavailable. Stock stays visible. **Responses rejected** now rises too. Compare fresh one-minute windows.
5. Remove the response fault, restore defaults and verify €4.90 / 3 days again. Explain that validation protects customers but does not repair the carrier's data.

## 4 — Diagnose your partner's incident

**Compete on correct diagnosis and stable protection.** Use comparable difficulty and swap roles. All faults can target Lighting inventory or Shipping. The response checker is a third checkbox in each service’s settings.

1. Open Challenge 4 and record a healthy baseline. Agree on useful customer results and an abort condition.
2. Your partner applies exactly one fault and says go. Click **Start new round**. Keep the Fault injection/current-state tab closed; use Storefront, Grafana and Fallbacks & timeouts to investigate.
3. Diagnose and contain the fault while leaving it active: **slow calls → short timeout + fallback**, **failed Shipping calls → fallback**, **wrong or missing values → Check response data**. Breaker additionally reduces repeated failed calls. Intermittent errors return 503 on alternating calls per product.
4. Complete three consecutive refreshes with no incorrect information or catalog failures. Healthy stock must remain usable; affected stock or quotes may be explicitly unavailable where appropriate. Stop the timer and record diagnosis, settings, evidence and seconds.
5. Reveal the fault, clear all faults and restore defaults. Swap roles, compare both rounds, verify final recovery and submit. Clearing the fault during a round does not count as containment. The manual timer does not grade answers.
