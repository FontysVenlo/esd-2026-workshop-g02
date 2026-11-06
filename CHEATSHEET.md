# Solve the four Northstar challenges

Start Docker Desktop and run the start launcher. Open [the workshop](http://localhost:8088), [Storefront](http://localhost:8088/storefront), [Network Faults](http://localhost:8089), and [Grafana](http://localhost:3008/d/field-workshop/field-workshop) in separate tabs. Leave the launcher’s background traffic running.

| Challenge | Fault to check | Question to answer |
| --- | --- | --- |
| 1 | You add **1500 ms delay to Lighting inventory** | Can a slow lamp stock check make healthy products wait? |
| 2 | You **disconnect Shipping** | Can one missing lamp quote hide all deliveries? |
| 3 | A partner secretly applies **one of the first two faults** | Which fault fits the symptoms? |
| 4 | You choose one fault. This walkthrough uses **1500 ms delay to Shipping** | Can you keep chair and desk deliveries useful while lamp Shipping is slow? |

**What to write down.** For each run, record the time, what happened to the lamp, chair and desk, and the catalog status and response time shown in Storefront. In Grafana, check **Shared workers and queue** and **Rejected since restart**. Record how much the rejection counter changed during the run. Use the same customer action, traffic and 60–90-second observation window for each comparison.

The lamp uses Lighting inventory, the chair uses Seating inventory, and the desk uses Desks inventory. A Storefront worker holds one product check until its dependency calls finish. Two slow lamp checks can fill both slots and make a chair wait before Seating inventory even receives its request.

**Start each challenge clean.** In Network Faults, click **Clear all faults**. Open **Fallbacks & timeouts** and click **Restore default settings**. Check that all three products have live stock and delivery quotes. Write down what you expect and when you would stop the experiment early.

## 1. Make the lamp stock check slow

1. In Storefront, click **Refresh all availability**. Record this healthy baseline.
2. In Network Faults, choose **Lighting inventory**, enter **1500** ms and click **Apply delay**. Refresh availability again. Watch the two shared workers in Grafana. Lamp calls can occupy both, so the healthy chair and desk may wait or their requests may be rejected.
3. Click **Remove delay** for Inventory. In **Fallbacks & timeouts**, click **Use Challenge 1 settings**. This sets a 400 ms Inventory timeout and enables fallback and the circuit breaker.
4. Apply the **same 1500 ms Lighting inventory delay**. Refresh availability again. Look for live chair and desk stock, unconfirmed lamp stock, and a change in queue or rejections. Record what actually happened.
5. **Finish:** clear all faults, restore default settings and allow the five-second cooldown to finish. Verify live stock and deliveries, fill in the challenge notes, and click **Submit notes**.

## 2. Make one missing quote break the delivery catalog

1. Click **Refresh all availability**, then **Preview all deliveries**. Record both healthy results.
2. In Network Faults, choose **Shipping** and click **Disconnect**. Repeat **both** Storefront actions. Availability should still work because stock uses Inventory. The whole delivery preview should fail because it needs a quote for every product.
3. Check **Dependency outcomes** in Grafana for Shipping failures. Record whether requests queued. An immediate disconnect can break the catalog even when workers have spare capacity.
4. **Reconnect** Shipping. In **Fallbacks & timeouts**, click **Use Challenge 2 settings**. Disconnect Shipping again and repeat both actions. Look for chair and desk quotes alongside an unavailable lamp quote. That is the evidence that fallback contained the failure.
5. Clear faults, restore defaults and verify all three live quotes. Record which view failed before mitigation and what the customer could still see afterward. Submit your notes.

## 3. Diagnose your partner’s hidden fault

1. Record a healthy baseline using **both** Storefront actions. Then have your partner secretly apply exactly one fault from the [facilitator notes](field-workshop/docs/facilitator.md). Keep Network Faults closed until you have written your diagnosis.
2. Repeat both Storefront actions and check Grafana. Use these clues to choose your hypothesis:

   | What you see | Fault to suspect | Evidence to check |
   | --- | --- | --- |
   | Both views slow down and healthy products can wait or fail | **Lighting inventory delay of 1500 ms** | Inventory latency rises. Check worker occupancy, queue and rejections. |
   | Availability works but the delivery catalog fails | **Shipping disconnected** | Shipping failures rise. The queue can stay low. |

3. In your notes, name the suspected dependency, the Storefront symptom, a Grafana signal and another possible explanation. Then inspect Network Faults with your partner.
4. Keep the seeded fault active. For slow Inventory, apply **Use Challenge 1 settings**. For disconnected Shipping, apply **Use Challenge 2 settings**. Repeat the same customer actions. Record what improved for the chair and desk and what information the lamp still lacks.
5. Compare your diagnosis with your partner’s reveal. Clear faults, restore defaults, verify recovery and submit your notes.

## 4. Run your own experiment

Here is one complete experiment you can use. **Predict** that delaying lamp Shipping will slow the whole delivery preview, and that a short timeout plus fallback will let customers see healthy quotes sooner.

1. Click **Preview all deliveries**. Record all three quotes, the catalog time, workers, queue and rejections. Choose a stop condition, such as availability failing unexpectedly.
2. Choose **Shipping**, enter **1500** ms and click **Apply delay**. Repeat the delivery preview. Record whether the chair and desk results arrive late, whether the catalog fails, and whether the queue grows.
3. **Remove delay** for Shipping. In **Fallbacks & timeouts**, set the **Shipping timeout to 400 ms**, enable the **Shipping fallback**, and click **Apply Shipping settings**. The timeout bounds waiting, the breaker pauses repeated failed calls, and fallback lets the other quotes appear.
4. Reapply the **same 1500 ms Shipping delay**. Repeat the delivery preview over the same window. Compare catalog times, chair and desk quotes, missing lamp information and queue pressure. Record any short spike when the breaker retries. If a wider impact never appeared, say so and revise the experiment before recommending the change.
5. Clear all faults and restore defaults. Check that all products have live stock and quotes again. In your notes, give the exact fault, settings, measured difference, remaining drawback and rollback steps. Submit, then **Download notes** from the workshop sidebar.
