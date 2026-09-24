# Challenge 1: Slow Inventory Service

## Purpose

Practice the Chaos Engineering loop: learn what normal behavior looks like, predict the effect of a controlled failure, run the experiment, examine evidence, and improve the system. Storefront needs stock information from Inventory to answer a product request. The experiment makes Inventory respond 1500 ms slower.

Open **http://localhost:8080** after the facilitator starts the workshop, then choose a challenge. The progress strip marks the current step, completed steps, and locked future steps. You do not need a terminal or infrastructure knowledge.

## Your five steps

1. **Measure:** Start Traffic. Watch the live latency and request outcomes. Once at least 15 requests have completed, capture the baseline. This is a saved normal measurement, not the changing live average.
2. **Hypothesis:** Write what you expect to change when Inventory is delayed, and why. Name a measurable outcome such as product response latency.
3. **Experiment:** Inject the 1500 ms latency. Watch the chart, wait for at least 15 delayed requests, and capture the failure results. The fault is removed after capture.
4. **Observe:** Compare the saved baseline and failure columns. Describe what changed, identify the metric that changed most, and explain whether the evidence supports your hypothesis.
5. **Improve:** Select a response to slow stock information, apply it, and rerun the same failure. Capture the post-mitigation results. If the system is not improved enough, use the feedback to try a different option. At completion, compare **Baseline vs Failure vs Failure with mitigation**.

The live chart and its 90-second rolling average show what is happening *now*. The saved table contains three separate measurement windows and is the evidence for your conclusions. A fallback response can still be successful: it returns useful product information while clearly saying that stock information is temporarily unavailable.

Use **Reset Challenge** to start over. It stops traffic, removes the delay, clears your answers and results, and returns to Step 1. You can then run a new normal baseline.

## Challenge 2: Service Unavailable

The order summary normally includes a delivery estimate from Shipping. Your goal is to find out what happens when Shipping is unavailable and whether the main order summary can remain useful. This challenge provides fewer instructions; use what you learned in Challenge 1.

1. **Measure:** Start Traffic and save at least 15 normal order-summary requests as the baseline.
2. **Hypothesis:** Write your own prediction before changing anything.
3. **Experiment:** Click **Disconnect Shipping Service**. Watch the request outcomes and capture at least 15 completed requests while Shipping is unavailable.
4. **Observe:** Compare the saved normal and unavailable results. Record what changed, which metrics were affected, whether the whole request failed, and whether your hypothesis held.
5. **Improve:** Choose an approach, explain your choice, and rerun the same outage. Shipping remains disconnected during this test. Capture the new results and compare all three saved columns. If the result does not pass, use the feedback to try another approach.

Look at both response time and success/error rates. A successful order summary may still say that the delivery estimate is temporarily unavailable. The live 90-second chart helps you watch the run; it is not the stored evidence. Dashed lines mark events, and their details appear below the chart without overlapping labels.

**Reset Challenge** reconnects Shipping, restores normal behavior, clears your answers and measurements, and returns to Step 1. Challenge 2 is directly accessible; completing Challenge 1 is not a technical prerequisite.

## Challenge 3: Independent experiment

The product page relies on stock information. This time you design more of the experiment yourself. Challenge 3 is available directly from the overview; you do not have to finish the other challenges first.

1. **Measure:** Select one or more steady-state indicators, start traffic, and capture at least 12 successful normal requests.
2. **Hypothesis:** Select either a 500, 1000, or 1500 ms stock-response delay, or a stock-service outage. Write what you expect the selected indicators to show. Your fault choice is locked for this run.
3. **Experiment:** Inject your chosen fault and capture at least 12 completed requests under it. The workshop removes the fault after capture.
4. **Observe:** Compare the *saved* baseline and failure columns. Describe what changed, cite your strongest measured evidence, and say whether your hypothesis held.
5. **Improve:** Choose your own combination of request timeout, fallback, retry, and temporary circuit-breaker controls. Explain your choice, apply it, and rerun the original fault. If the result falls short, adjust the controls and rerun it again.

Once the validation passes, complete the final reflection: what the failure revealed, what your mitigation addressed, and why the system is more resilient. The completion view compares **Baseline vs Failure vs Failure with mitigation**. Successful fallback responses remain useful but explicitly say stock information is unavailable; they never invent a stock count.

The live 90-second chart is for watching the current run; use the separate saved columns for conclusions. **Reset Challenge** stops traffic, restores the stock connection and default settings, clears all answers and measurements, and returns to Step 1. It does not clear the other challenges.
