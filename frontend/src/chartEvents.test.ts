import { describe, expect, it } from "vitest";
import { visibleChartEvents } from "./chartEvents";
import type { MetricsSnapshot } from "./types";

describe("visibleChartEvents", () => {
  it("retains close-together event markers and their details", () => {
    const metrics: MetricsSnapshot = {
      currentLatencyMs: 8, lastRequestSucceeded: true, averageLatencyMs: 8,
      successes: 2, failures: 0,
      samples: [
        { timestamp: "2026-09-24T10:00:00.000Z", durationMs: 8, success: true, fallbackUsed: false, windowId: 1 },
        { timestamp: "2026-09-24T10:00:05.000Z", durationMs: 8, success: true, fallbackUsed: false, windowId: 1 }
      ],
      events: [
        { timestamp: "2026-09-24T09:59:59.000Z", type: "OLD", label: "Outside chart" },
        { timestamp: "2026-09-24T10:00:02.000Z", type: "BASELINE_CAPTURED", label: "Baseline captured" },
        { timestamp: "2026-09-24T10:00:02.010Z", type: "FAILURE_INJECTED", label: "Failure injected" }
      ]
    };

    expect(visibleChartEvents(metrics).map((event) => event.label))
      .toEqual(["Baseline captured", "Failure injected"]);
  });
});
