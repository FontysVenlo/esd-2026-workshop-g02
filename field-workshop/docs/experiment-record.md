# Experiment record template

Copy this section for each assignment. Short, specific answers are better than long generic ones.

| Field | Your evidence or decision |
| --- | --- |
| Assignment / date / team | |
| Customer behavior at risk | |
| Steady-state metrics and why | |
| Baseline window and measurements | |
| Hypothesis | |
| Fault target, type and magnitude | |
| Expected blast radius | |
| Abort condition | |
| Actual fault window and measurements | |
| What changed? What did not? | |
| Mitigation and reason | |
| Same-fault validation window and measurements | |
| Trade-off or new risk | |
| Conclusion: did resilience improve? | |
| Cleanup / rollback performed | |

Useful measurements: route-level request rate, p95 latency and success rate; dependency latency/failure rate; fallback rate. Include a panel URL, PromQL expression, screenshot, or brief numbers with time windows so another engineer can inspect the evidence. Grafana's one-minute `rate()` panels may retain the previous phase briefly—wait for a fresh window before comparing.
