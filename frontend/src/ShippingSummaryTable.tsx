import type { ShippingMeasurement } from "./types";

type Props = {
  baseline: ShippingMeasurement | null;
  experiment: ShippingMeasurement | null;
  validation: ShippingMeasurement | null;
};

function ms(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toLocaleString()} ms`;
}

function percent(value: number | undefined): string {
  return value === undefined ? "—" : `${Math.round(value * 100)}%`;
}

function status(value: ShippingMeasurement | null): string {
  return value === null ? "—" : value.shippingAvailable ? "Available" : "Unavailable";
}

export default function ShippingSummaryTable({ baseline, experiment, validation }: Props) {
  return (
    <div className="table-wrap">
      <table className="summary-table">
        <caption>Saved results from separate request windows, not the live rolling average. p95 is the time within which 95% of requests completed.</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col">Baseline</th><th scope="col">Shipping unavailable</th><th scope="col">Unavailable with mitigation</th></tr></thead>
        <tbody>
          <tr><th scope="row">Average latency</th><td>{ms(baseline?.averageLatencyMs)}</td><td>{ms(experiment?.averageLatencyMs)}</td><td>{ms(validation?.averageLatencyMs)}</td></tr>
          <tr><th scope="row">p95 latency</th><td>{ms(baseline?.p95LatencyMs)}</td><td>{ms(experiment?.p95LatencyMs)}</td><td>{ms(validation?.p95LatencyMs)}</td></tr>
          <tr><th scope="row">Success rate</th><td>{percent(baseline?.successRate)}</td><td>{percent(experiment?.successRate)}</td><td>{percent(validation?.successRate)}</td></tr>
          <tr><th scope="row">Error rate</th><td>{percent(baseline?.errorRate)}</td><td>{percent(experiment?.errorRate)}</td><td>{percent(validation?.errorRate)}</td></tr>
          <tr><th scope="row">Requests measured</th><td>{baseline?.requestCount ?? "—"}</td><td>{experiment?.requestCount ?? "—"}</td><td>{validation?.requestCount ?? "—"}</td></tr>
          <tr><th scope="row">Fallback responses</th><td>{baseline?.fallbackCount ?? "—"}</td><td>{experiment?.fallbackCount ?? "—"}</td><td>{validation?.fallbackCount ?? "—"}</td></tr>
          <tr><th scope="row">Shipping state</th><td>{status(baseline)}</td><td>{status(experiment)}</td><td>{status(validation)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
