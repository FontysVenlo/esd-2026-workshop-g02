import type { MetricsSnapshot } from "./types";

/** Keep every event inside the visible sample range, including near-simultaneous ones. */
export function visibleChartEvents(metrics: MetricsSnapshot | undefined): MetricsSnapshot["events"] {
  if (!metrics || metrics.samples.length === 0) return [];
  const firstTime = Date.parse(metrics.samples[0].timestamp);
  const lastTime = Date.parse(metrics.samples[metrics.samples.length - 1].timestamp);
  return metrics.events.filter((event) => {
    const time = Date.parse(event.timestamp);
    return time >= firstTime && time <= lastTime;
  });
}
