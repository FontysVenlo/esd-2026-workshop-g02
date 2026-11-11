# Solve the four Northstar challenges

Start Docker Desktop and run the start launcher. Open [the workshop](http://localhost:8088), [Storefront](http://localhost:8088/storefront), [Network Faults](http://localhost:8089), and [Grafana](http://localhost:3008/d/field-workshop/field-workshop) in separate tabs. Leave the launcher’s background traffic running.

| Challenge | Fault to check | Question to answer |
| --- | --- | --- |
| 1 | You add **1500 ms delay to Lighting inventory** | Can a slow lamp stock check make healthy products wait? |
| 2 | You **disconnect Shipping** | Can the backup carrier restore usable quotes during the primary outage? |
| 3 | A partner secretly applies **one of the first two faults** | Which fault fits the symptoms? |
| 4 | You choose one fault. This walkthrough uses **1500 ms delay to Shipping** | How much quote information is worth waiting for? |

**What to write down.** For each run, record the time, what happened to the lamp, chair and desk, and the catalog status and response time shown in Storefront. In Grafana, check **Shared workers and queue** and **Rejected since restart**. Record how much the rejection counter changed during the run. Use the same customer action, traffic and 60–90-second observation window for each comparison.

The lamp uses Lighting inventory, the chair uses Seating inventory, and the desk uses Desks inventory. A Storefront worker holds one product check until its dependency calls finish. Two slow lamp checks can fill both slots and make a chair wait before Seating inventory even receives its request.

**Start each challenge clean.** In Network Faults, click **Clear all faults**. Open **Fallbacks & timeouts** and click **Restore default settings**. Check that all three products have live stock and delivery quotes. Write down what you expect and when you would stop the experiment early.

## 1. Make the lamp stock check slow

**Recommended combination — Inventory timeout 400 ms, fallback ON, breaker ON.** The timeout releases a worker before the 1500 ms delay finishes. Fallback keeps the catalog usable with unconfirmed lamp stock. The breaker skips further failed lamp lookups for five seconds, giving chair and desk requests more access to the workers.

| Inventory timeout | Fallback | Breaker | What to compare |
| --- | --- | --- | --- |
| 3000 ms | OFF | OFF | Baseline under fault. Slow lamp calls occupy workers and can cause queues or rejections. |
| 400 ms | ON | OFF | The catalog can show partial results, but each new lamp request still waits up to 400 ms. |
| **400 ms** | **ON** | **ON** | After the first failure, most lamp requests skip the slow lookup and immediately return unconfirmed stock. Recovery probes may briefly increase latency. |

1. In Storefront, click **Refresh all availability**. Record this healthy baseline.
2. In Network Faults, choose **Lighting inventory**, enter **1500** ms and click **Apply delay**. Refresh availability again. Watch the two shared workers in Grafana. Lamp calls can occupy both, so the healthy chair and desk may wait or their requests may be rejected.
3. Click **Remove delay** for Inventory. In **Fallbacks & timeouts**, click **Use Challenge 1 settings**. This sets a 400 ms Inventory timeout and enables fallback and the circuit breaker.
4. Apply the **same 1500 ms Lighting inventory delay**. Refresh availability again. Look for live chair and desk stock, unconfirmed lamp stock, and a change in queue or rejections. Record what actually happened.
5. **Finish:** clear all faults, restore default settings and allow the five-second cooldown to finish. Verify live stock and deliveries, fill in the challenge notes, and click **Submit notes**.

## 2 — Restore quotes with a backup carrier

**Recommended combination — Shipping timeout 3000 ms, fallback ON, breaker ON.** Fallback obtains a real backup quote at €4.90 with 5-day delivery. The breaker avoids repeated primary-carrier attempts for five seconds. Keep the default timeout for this immediate disconnect; shortening it brings little benefit when the primary already fails quickly.

| Shipping timeout | Fallback | Breaker | What to compare |
| --- | --- | --- | --- |
| 3000 ms | OFF | OFF | Delivery previews fail while Primary Shipping is disconnected. |
| 3000 ms | ON | OFF | Backup quotes restore delivery options, but every request first attempts the failed primary. |
| **3000 ms** | **ON** | **ON** | After a primary failure, requests go straight to the backup during the five-second pause. |

For a **slow primary carrier**, a shorter timeout such as 400 ms can also help by reaching the backup sooner. That limit applies separately to each provider call, so verify that the backup can respond within it. A breaker with fallback OFF still leaves customers without a delivery quote.

1. Preview all deliveries. Record €4.90 and 3 days for each product.
2. In Network Faults choose **Primary Shipping (all products)** and **Disconnect**. Stock checks still work, but delivery previews fail. Record this customer impact.
3. Keep the outage active. Under Fallbacks & timeouts keep the Shipping timeout at **3000 ms**, enable **Shipping fallback** and **Shipping circuit breaker**, then click **Apply Shipping settings**. Preview deliveries. All products should show a **backup carrier**, €4.90 shipping and **5 days** delivery.
4. Reconnect Primary Shipping. If the breaker is enabled, wait five seconds and allow a probe. Refresh again and confirm all products return to €4.90 and 3 days.
5. Restore defaults and submit your measurements. Explain what customers regained and why the extra delivery time is a trade-off.

## 3 — Identify your partner’s fault

1. Record healthy availability and delivery results. Ask your partner to seed exactly one incident from the facilitator notes. Keep fault controls closed.
2. Test both views. **Slow Lighting inventory** can delay both views and fill shared workers. **Disconnected shared Shipping** causes quote failures across products while stock checks still work. Check dependency latency, outcomes and queue size in Grafana.
3. Write your diagnosis, supporting observations and one alternative. Then check with your partner.
4. Keep the original fault active. Apply **Use Challenge 1 settings** for slow Lighting. For unavailable Shipping, set **3000 ms**, enable **Shipping fallback** and **Shipping circuit breaker**, then apply the settings. Repeat the same actions and record any remaining stock uncertainty or longer backup delivery estimates.
5. Remove the fault, wait for a probe and verify full stock and delivery results. Restore defaults and submit.

## 4 — Decide how long a quote is worth waiting for

This worked example uses slow shared Shipping. You may choose your own experiment on the challenge page.

1. Preview all deliveries with default settings. Record response time, available quotes, queue and rejections. Write a prediction and a condition for stopping early.
2. Choose **Shipping (all products)**, enter **1500 ms** and click **Apply delay**. Repeat the preview. Shipping may still return quotes if requests complete within their timeouts. Record what customers actually receive.
3. Remove the delay. Under **Fallbacks & timeouts**, set **Shipping timeout** to **400 ms**, enable Shipping fallback and click **Apply Shipping settings**.
4. Apply the identical delay and repeat under the same traffic. Compare preview time, worker pressure, stocks and number of usable quotes and delivery days. Explain whether the faster partial response is worth the longer backup delivery estimate.
5. Remove the delay, allow a recovery probe and verify three live quotes. Restore defaults and submit your recommendation.
