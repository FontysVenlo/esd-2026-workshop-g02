export type MeasurementSummary = {
  averageLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  requestCount: number;
  fallbackCount: number;
};

export type Hypothesis = {
  expectedBehavior: string;
  reason: string;
};

export type Observation = {
  whatChanged: string;
  metricChangedMost: string;
  hypothesisConfirmed: string;
  why: string;
};

export type MitigationOption = {
  id: string;
  label: string;
  description: string;
};

export type ChallengeStep =
  | "MEASURE"
  | "HYPOTHESIS"
  | "EXPERIMENT"
  | "OBSERVE"
  | "IMPROVE"
  | "COMPLETED";

export type ChallengeView = {
  id: string;
  title: string;
  scenario: string;
  instructions: { step: string; title: string; body: string }[];
  hints: string[];
  mitigationOptions: MitigationOption[];
  latencyMs: number;
  minimumSamples: number;
  currentWindowSamples: number;
  step: ChallengeStep;
  experimentActive: boolean;
  validationActive: boolean;
  baseline: MeasurementSummary | null;
  hypothesis: Hypothesis | null;
  experiment: MeasurementSummary | null;
  observation: Observation | null;
  mitigationId: string | null;
  validation: MeasurementSummary | null;
  validationFeedback: string[];
  completed: boolean;
};

export type MetricsSnapshot = {
    currentLatencyMs: number | null;
    lastRequestSucceeded: boolean | null;
    averageLatencyMs: number | null;
    successes: number;
    failures: number;
    samples: {
      timestamp: string;
      durationMs: number;
      success: boolean;
      fallbackUsed: boolean;
      windowId: number;
    }[];
    events: { timestamp: string; type: string; label: string }[];
};

export type SliceSnapshot = {
  trafficRunning: boolean;
  proxyAvailable: boolean;
  latencyFaultActive: boolean | null;
  metrics: MetricsSnapshot;
  challenge: ChallengeView;
};

export type ShippingMeasurement = MeasurementSummary & {
  errorRate: number;
  shippingAvailable: boolean;
};

export type Challenge2Observation = {
  whatChanged: string;
  metricsAffected: string;
  completeRequestFailed: boolean;
  hypothesisConfirmed: string;
  why: string;
};

export type Challenge2View = {
  id: string;
  title: string;
  scenario: string;
  objective: string;
  hints: string[];
  difficulty: string;
  estimatedMinutes: number;
  guidanceLevel: string;
  mitigationOptions: MitigationOption[];
  minimumSamples: number;
  currentWindowSamples: number;
  step: ChallengeStep;
  experimentActive: boolean;
  validationActive: boolean;
  baseline: ShippingMeasurement | null;
  hypothesis: string | null;
  experiment: ShippingMeasurement | null;
  observation: Challenge2Observation | null;
  mitigationId: string | null;
  mitigationReason: string | null;
  validation: ShippingMeasurement | null;
  validationFeedback: string[];
  conceptFeedback: string[];
  completed: boolean;
};

export type ShippingSnapshot = {
  trafficRunning: boolean;
  shippingAvailable: boolean | null;
  metrics: MetricsSnapshot;
  challenge: Challenge2View;
};

export type ExperimentMeasurement = MeasurementSummary & {
  errorRate: number;
  dependencyStatus: string;
};

export type ExperimentSettings = {
  timeoutMs: number;
  fallbackEnabled: boolean;
  retries: number;
  circuitBreakerEnabled: boolean;
};

export type ExperimentSnapshot = {
  trafficRunning: boolean;
  dependency: { enabled: boolean; latencyMs: number | null; toxicCount: number } | null;
  metrics: MetricsSnapshot;
  challenge: {
    id: string; title: string; scenario: string; guidanceLevel: string;
    faults: { id: string; label: string; type: string; latencyMs: number }[];
    controls: { timeoutMs: number[]; retries: number[]; fallback: boolean; circuitBreaker: boolean };
    minimumSamples: number; currentWindowSamples: number;
    step: ChallengeStep | "REFLECT";
    steadyStateIndicators: string[];
    baseline: ExperimentMeasurement | null;
    hypothesis: string | null; selectedFaultId: string | null;
    failure: ExperimentMeasurement | null;
    observation: { whatChanged: string; strongestEvidence: string; hypothesisConfirmed: string; explanation: string } | null;
    settings: ExperimentSettings; mitigationReason: string | null;
    validation: ExperimentMeasurement | null; validationFeedback: string[];
    reflection: { failureRevealed: string; mitigationAddressed: string; whyMoreResilient: string } | null;
    experimentActive: boolean; validationActive: boolean; completed: boolean;
  };
};
