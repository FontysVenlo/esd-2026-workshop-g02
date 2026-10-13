# Challenge 1: Slow Inventory Service

## Purpose

Practice the Chaos Engineering loop: learn what normal behavior looks like, predict the effect of a controlled failure, run the experiment, examine evidence, and improve the system. Storefront needs stock information from Inventory to answer a product request. The experiment makes Inventory respond 1500 ms slower.

Open **http://localhost:8080** after the facilitator starts the workshop, then choose a challenge. The progress strip marks the current step, completed steps, and locked future steps. You do not need a terminal or infrastructure knowledge.

## Your five steps

1. **Measure:** Start Traffic. Watch the live latency and request outcomes. Once at least 15 requests have completed, capture the baseline. This is a saved normal measurement, not the changing live average.
2. **Hypothesis:** Write what you expect to change when Inventory is delayed, and why. Name a measurable outcome such as product response latency.
3. **Experiment:** Inject the 1500 ms latency. Watch the chart, wait for at least 15 delayed requests, and capture the failure results. The fault is removed after capture.
4. **Observe:** Compare the saved baseline and failure columns. Describe what changed, identify the metric that changed most, and explain whether the evidence supports your hypothesis.
5. **Improve:** Select a response to slow stock information, explain why, and state what evidence would show improvement. Rerun the same failure. If the result is insufficient, try another option. Compare **Baseline vs Failure vs Failure with mitigation**, then write a short conclusion to complete the record.

The live chart and its 90-second rolling average show what is happening *now*. The saved table contains three separate measurement windows and is the evidence for your conclusions. A fallback response can still be successful: it returns useful product information while clearly saying that stock information is temporarily unavailable.

Use **Reset Challenge** to start over. It stops traffic, removes the delay, clears your answers and results, and returns to Step 1. You can then run a new normal baseline.

## Challenge 2: Service Unavailable

The order summary normally includes a delivery estimate from Shipping. Your goal is to find out what happens when Shipping is unavailable and whether the main order summary can remain useful. This challenge provides fewer instructions; use what you learned in Challenge 1.

1. **Measure:** Start Traffic and save at least 15 normal order-summary requests as the baseline.
2. **Hypothesis:** Write your own prediction before changing anything.
3. **Experiment:** Click **Disconnect Shipping Service**. Watch the request outcomes and capture at least 15 completed requests while Shipping is unavailable.
4. **Observe:** Compare the saved normal and unavailable results. Record what changed, which metrics were affected, whether the whole request failed, and whether your hypothesis held.
5. **Improve:** Choose an approach, explain your choice, and rerun the same outage. Shipping remains disconnected during this test. Compare all three saved columns and decide whether the blast radius shrank; save that conclusion to complete the record.

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

## How to use the assignments

Allow approximately 8–10 minutes for Challenge 1, 10–12 for Challenge 2, 12–15 for Challenge 3, and 15–18 for Challenge 4. These are planning estimates, not countdowns. Read the **Your Assignment** card before starting each exercise. It states the situation, what to prove, evidence needed, tools, and deliverable. Short, specific notes are more useful than long essays. Every completion screen is an experiment record: read its saved windows and write your own conclusion rather than treating the completion marker as the conclusion.

For Challenge 1, identify the stock dependency and select latency as a healthy-behavior metric before capturing a baseline. Before applying a mitigation, name the problem in your measurements and the evidence that would persuade you the change worked. Challenge 2 adds **blast radius**: what part of the customer journey failed, and did your response narrow that scope? Challenge 3 asks you to choose a fault magnitude and an **abort condition**—the point where impact would be unacceptable in a real experiment. If your chosen limit is reached, stop the fault and discuss it with the facilitator.

## Challenge 4: Mini GameDay

A GameDay is a planned reliability exercise: a team monitors the system, introduces a realistic controlled failure, responds, and validates the outcome. Here the cause of the initial incident is hidden. Grafana is your main observation tool; the workshop only controls safe predefined faults and stores your experiment record.

1. Open Challenge 4 and read its assignment card. Start requests and click **Open Grafana**. Choose useful signals such as request rate, error rate, latency, dependency calls, and fallback activity. Record what healthy behavior looks like, then save a normal window.
2. Begin the unknown incident. Return to Grafana and inspect which user-facing and dependency signals changed. Save the incident window.
3. Record the dependency you believe is unhealthy, a concrete metric observation, your hypothesis, the fault you will use to reproduce it, expected blast radius, and an abort condition. If evidence is ambiguous, spend more time inspecting the dashboard before committing to a diagnosis.
4. Run the planned fault, inspect Grafana, and save its result. Explain the impact in your own words.
5. Choose timeout/fallback/retry settings, explain the problem they address, and state what evidence would prove improvement. Rerun the **same** fault, inspect Grafana again, and compare the saved windows.
6. Record a final conclusion. The completion view presents your GameDay experiment record and a concise summary of the process, tools, and concepts practiced.

The controlled actions target only local Stock or Shipping connections. Do not run faults against external services. You can open [Prometheus](http://localhost:9090) as an optional detail view; Grafana is preconfigured at [localhost:3000](http://localhost:3000). The workshop's built-in live chart is a simplified educational view, whereas Grafana displays the real exported monitoring signals. The optional **Chaos Engineering Toolbox** and **Architecture** pages explain the roles of Toxiproxy, Prometheus, Grafana, and other common tools.

Use the overview's **Reset Entire Workshop** to stop all request traffic, restore all connections and settings, and clear all four records. This is useful when handing the laptop to another participant. Individual reset buttons clear only that challenge. Progress is local and in memory; restarting the controller also loses the records.
