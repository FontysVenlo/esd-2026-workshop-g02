import type { MeasurementSummary } from "./types";

type SummaryTableProps = {
  baseline: MeasurementSummary | null;
  experiment: MeasurementSummary | null;
  validation: MeasurementSummary | null;
};

function formatMs(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toLocaleString()} ms`;
}

export default function SummaryTable({ baseline, experiment, validation }: SummaryTableProps) {
  return (
    <div className="table-wrap">
      <table className="summary-table">
        <caption>Saved results from three separate measurement windows. These do not change with the live rolling average. p95 is the time within which 95% of requests completed.</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Baseline</th>
            <th scope="col">Failure</th>
            <th scope="col">Failure with mitigation</th>
          </tr>
        </thead>
        <tbody>
          <tr><th scope="row">Average latency</th><td>{formatMs(baseline?.averageLatencyMs)}</td><td>{formatMs(experiment?.averageLatencyMs)}</td><td>{formatMs(validation?.averageLatencyMs)}</td></tr>
          <tr><th scope="row">p95 latency</th><td>{formatMs(baseline?.p95LatencyMs)}</td><td>{formatMs(experiment?.p95LatencyMs)}</td><td>{formatMs(validation?.p95LatencyMs)}</td></tr>
          <tr><th scope="row">Success rate</th><td>{baseline ? `${Math.round(baseline.successRate * 100)}%` : "—"}</td><td>{experiment ? `${Math.round(experiment.successRate * 100)}%` : "—"}</td><td>{validation ? `${Math.round(validation.successRate * 100)}%` : "—"}</td></tr>
          <tr><th scope="row">Requests measured</th><td>{baseline?.requestCount ?? "—"}</td><td>{experiment?.requestCount ?? "—"}</td><td>{validation?.requestCount ?? "—"}</td></tr>
          <tr><th scope="row">Fallback responses</th><td>{baseline?.fallbackCount ?? "—"}</td><td>{experiment?.fallbackCount ?? "—"}</td><td>{validation?.fallbackCount ?? "—"}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
