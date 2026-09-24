import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import type { MetricsSnapshot } from "./types";
import { visibleChartEvents } from "./chartEvents";

function formatLatency(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString()} ms`;
}

function timeLabel(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour12: false });
}

export default function LiveMetrics({ snapshot }: { snapshot: { metrics: MetricsSnapshot } | null }) {
  const metrics = snapshot?.metrics;
  const points = metrics?.samples.map((sample) => ({
    timeMs: Date.parse(sample.timestamp),
    latency: sample.durationMs,
    result: sample.success ? "Success" : "Failure"
  })) ?? [];
  const firstTime = points[0]?.timeMs ?? 0;
  const lastTime = points[points.length - 1]?.timeMs ?? 0;
  const markers = visibleChartEvents(metrics);

  return (
    <section className="live-section" aria-label="Live system metrics">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LIVE SYSTEM METRICS</p>
          <h2>Live / current metrics</h2>
        </div>
        <span className="subtle">Rolling 90 seconds · for monitoring, not the saved comparison</span>
      </div>
      <div className="measurements">
        <div className="metric-card"><span>Current response latency</span><strong>{formatLatency(metrics?.currentLatencyMs ?? null)}</strong><small>Most recently completed request</small></div>
        <div className="metric-card"><span>Rolling average latency</span><strong>{formatLatency(metrics?.averageLatencyMs ?? null)}</strong><small>All visible requests in the last 90 seconds</small></div>
        <div className="metric-card"><span>Latest request</span><strong className={metrics?.lastRequestSucceeded === false ? "failure-text" : ""}>{metrics?.lastRequestSucceeded == null ? "—" : metrics.lastRequestSucceeded ? "Success" : "Failure"}</strong><small>{metrics?.successes ?? 0} succeeded · {metrics?.failures ?? 0} failed</small></div>
      </div>
      <div className="chart-card">
        <div className="chart-heading"><h3>Response latency</h3><span>Each point is a real request · dashed lines mark events</span></div>
        {points.length === 0 ? (
          <div className="empty-chart">Start traffic to see measured response times.</div>
        ) : (
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 28, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#263d4d" strokeDasharray="3 4" />
                <XAxis type="number" dataKey="timeMs" domain={[firstTime - 1000, lastTime + 1000]} tickFormatter={timeLabel} stroke="#9eb3c1" minTickGap={32} />
                <YAxis stroke="#9eb3c1" width={58} unit=" ms" />
                <Tooltip labelFormatter={(value) => timeLabel(Number(value))} contentStyle={{ background: "#172430", border: "1px solid #345163", color: "#e9f0f5" }} />
                {markers.map((event) => (
                  <ReferenceLine key={`${event.timestamp}-${event.type}`} x={Date.parse(event.timestamp)} stroke={event.type === "FAILURE_INJECTED" || event.type === "FAULT_INJECTED" || event.type === "VALIDATION_STARTED" ? "#f2b886" : "#9bb5c6"} strokeDasharray="4 4" />
                ))}
                <Line type="linear" dataKey="latency" stroke="#78d9c1" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {markers.length > 0 && <ol className="chart-events" aria-label="Chart events">{markers.map((event) => <li key={`${event.timestamp}-${event.type}`}><time dateTime={event.timestamp}>{timeLabel(Date.parse(event.timestamp))}</time><span>{event.label}</span></li>)}</ol>}
      </div>
    </section>
  );
}
