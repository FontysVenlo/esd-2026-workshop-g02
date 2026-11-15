# Northstar challenge cheatsheet

Start Docker Desktop, then run `start.bat` (Windows) or `bash ./start.command` (Mac) from the repository root or extracted ZIP. The launcher opens [the workshop](http://localhost:8088), [Storefront](http://localhost:8088/storefront), [Network Faults](http://localhost:8089) and [Grafana](http://localhost:3008/d/field-workshop/field-workshop), plus Prometheus. Leave background traffic running.

## Before each challenge

- Open the challenge before injecting faults. The first visit to Challenges 2–4 clears faults and restores protection defaults.
- In Network Faults, use **Clear all faults**, then **Restore default settings** under **Fallbacks & timeouts**. Defaults are 3000 ms timeouts with fallback, breaker and response checks off.
- Refresh availability and shipping information. Record stock, delivery, catalog status and response time for all three products. State your prediction and an abort condition.
- Compare the same customer action, unchanged traffic and equal 60–90-second windows. In Grafana, check **Product p95 latency**, **Shared workers and queue** and the change in **Rejected since restart**.

The lamp, chair and desk have separate Inventory services but share one Storefront worker and Primary Shipping. A slow lamp check can occupy the worker while healthy products queue or are rejected.

| Protection | Purpose |
| --- | --- |
| Timeout | Limits each dependency call's waiting time and releases the worker sooner. Queue waiting happens before this timer starts. |
| Circuit breaker | After a failed call, skips calls for five seconds, then allows one recovery probe. Inventory circuits are per product; Shipping has one shared circuit. |
| Inventory fallback | Shows **Stock unconfirmed** after a failed stock call. It does not restore stock or shorten the wait. |
| Shipping fallback | Requests a real quote from the backup carrier after a primary failure. Each provider gets its own timeout. |
| Check response data | Discards invalid values and retains the last valid information. With no valid history, shows unavailable information. |

In **Dependency outcomes**, `shipping · success` means successful calls per second. The one-minute rate needs time to settle after a change.

## 1. A slow lamp blocks healthy products

**Main protection: Inventory timeout 400 ms. Compare the breaker separately; fallback is optional.**

1. Record healthy results using **Refresh availability**.
2. In Network Faults, select **Lighting inventory**, set **Response delay** to **1500 ms** with zero variation, and click **Apply delay**. Refresh again and measure chair/desk waiting or rejections alongside lamp latency.
3. Keep the delay active. Under **Fallbacks & timeouts**, set Inventory timeout to **400 ms**, leave fallback and breaker off, and click **Apply Inventory settings**. The lamp errors sooner, releasing the worker so chair and desk can load.
4. Enable the Inventory circuit breaker and apply again. Compare repeated waits and rejections over a fresh window: failed lamp calls are skipped for five seconds before a probe.
5. Optionally enable Inventory fallback. The lamp shows **Stock unconfirmed** and its availability action is disabled. **Use Challenge 1 settings** enables the 400 ms timeout, fallback and breaker together.
6. Clear faults, restore defaults and let in-flight calls finish. Verify live stock and delivery information, then submit your notes.

With a 3000 ms timeout, the delayed 1500 ms lookup still succeeds. That slow success does not trigger fallback or the breaker. The timeout provides the core capacity protection.

## 2. Restore delivery through a backup carrier

**Main protection: Shipping fallback. Keep the default 3000 ms timeout for a disconnected primary.**

1. Click **Refresh shipping info** and record **€4.90 / 3 days** for all products.
2. Select **Primary Shipping (all products)** in Network Faults and click **Disconnect**. Compare availability and shipping: stock remains usable, while delivery requests fail.
3. Keep the outage active. Enable **Shipping fallback**, leave the breaker off, and click **Apply Shipping settings**. Refresh shipping information: the backup supplies **€4.90 / 5 days** for all products.
4. Optionally enable the Shipping circuit breaker. It skips repeated primary attempts during its five-second cooldown. Fallback already restores quotes; disconnection usually fails quickly, so the speed difference may be small.
5. Reconnect Primary Shipping. If the breaker is enabled, allow its cooldown and a probe. Verify **€4.90 / 3 days**, restore defaults and submit your results.

For a slow primary, a shorter timeout can reach the backup sooner. Check that the backup can also respond within that limit.

## 3. Reject wrong or missing values

**Main protection: Check response data for both Inventory and Shipping.**

1. Record healthy stock and delivery information before injecting faults.
2. Select **Lighting inventory**, choose **Wrong or missing values**, and click **Apply response fault**. Refresh availability several times: stock cycles through negative, missing, fractional and valid values.
3. Compare **Dependency outcomes** with **Response checks** in Grafana. Replies can count as HTTP successes while containing invalid data.
4. Keep the fault active. Under Inventory, enable **Check response data** and click **Apply Inventory settings**. Invalid replies are discarded; the last valid stock remains visible as **Last known result**. Without valid history, stock is unavailable. **Responses rejected** counts discarded replies.
5. Remove the Inventory response fault and repeat for **Primary Shipping (all products)** using **Refresh shipping info**. Its sequence includes negative days, missing fields, a negative price and a valid quote. Enable **Check response data** under Shipping and click **Apply Shipping settings**. The last valid quote is retained for that product and carrier.
6. Remove response faults, restore defaults, verify normal stock and **€4.90 / 3 days**, and submit your results for both services.

Timeouts and breakers do not detect invalid values in successful replies. Response validation does not call backup Shipping or repair the service's data.

## 4. Diagnose your partner's incident

1. Open Challenge 4 on both machines. Record healthy baselines and agree on comparable fault difficulty and acceptable customer results.
2. Each partner introduces one hidden fault on the other's machine. Once both faults are active, each clicks **Start new round** on their own machine.
3. Keep **Fault injection** and its current-state display closed. Diagnose using Storefront and Grafana, then apply protection under **Fallbacks & timeouts** while leaving the fault active.
4. Match the protection to the evidence: short timeouts for slow calls, fallback for failed calls, and response checks for invalid values. A breaker reduces repeated failed calls. **Some requests fail (50%)** alternates HTTP 503 errors with successful calls.
5. Refresh repeatedly. Working products must stay usable, wrong values must be hidden, and missing information must be clear. **While the timer runs**, record your diagnosis, settings and measured impact against the baseline.
6. Click **Stop timer** after documenting the result. Compare both times and reveal the faults. Clear faults, restore defaults, verify recovery and submit. Download your notes from the sidebar.

Removing the fault does not count as containment. The timer is manual and answers are not automatically graded.
