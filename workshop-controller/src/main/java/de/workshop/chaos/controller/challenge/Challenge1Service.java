package de.workshop.chaos.controller.challenge;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import de.workshop.chaos.controller.slice.MetricsStore;
import de.workshop.chaos.controller.slice.MetricsStore.MeasurementSummary;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** The small, ordered workflow for the first guided exercise. */
@Service
public class Challenge1Service {

    public enum Step {
        MEASURE, HYPOTHESIS, EXPERIMENT, OBSERVE, IMPROVE, CONCLUDE, COMPLETED
    }

    private final Challenge1Definition definition;
    private final ToxiproxyClient toxiproxy;
    private final TrafficGenerator traffic;
    private final ShippingTrafficGenerator shippingTraffic;
    private GameDayTrafficGenerator gameDayTraffic;
    private final MetricsStore metrics;
    private final StorefrontSettingsClient storefront;

    private Step step = Step.MEASURE;
    private long baselineWindowId;
    private long experimentWindowId;
    private long validationWindowId;
    private boolean experimentActive;
    private boolean validationActive;
    private MeasurementSummary baseline;
    private MeasurementSummary experiment;
    private MeasurementSummary validation;
    private Hypothesis hypothesis;
    private Observation observation;
    private Challenge1Definition.MitigationOption mitigation;
    private List<String> validationFeedback = List.of();
    private List<String> steadyStateMetrics = List.of();
    private String testedDependency;
    private String mitigationReason;
    private String expectedEvidence;
    private String conclusion;

    public Challenge1Service(Challenge1Definition definition, ToxiproxyClient toxiproxy,
            TrafficGenerator traffic, MetricsStore metrics, StorefrontSettingsClient storefront,
            ShippingTrafficGenerator shippingTraffic) {
        this.definition = definition;
        this.toxiproxy = toxiproxy;
        this.traffic = traffic;
        this.metrics = metrics;
        this.storefront = storefront;
        this.shippingTraffic = shippingTraffic;
    }

    public synchronized ChallengeView view() {
        long activeWindow = switch (step) {
            case MEASURE -> baselineWindowId;
            case EXPERIMENT -> experimentActive ? experimentWindowId : 0;
            case IMPROVE -> validationActive ? validationWindowId : 0;
            default -> 0;
        };
        int currentWindowSamples = activeWindow == 0 ? 0
                : metrics.summaryForWindow(activeWindow).requestCount();
        return new ChallengeView(definition.id(), definition.title(), definition.scenario(),
                definition.instructions(), definition.hints(), definition.resilienceOptions(),
                definition.latencyMs(), definition.evaluation().technical().minimumSamplesPerSnapshot(),
                currentWindowSamples, step, experimentActive, validationActive,
                baseline, hypothesis, experiment, observation,
                mitigation == null ? null : mitigation.id(), validation,
                validationFeedback, step == Step.COMPLETED, steadyStateMetrics,
                testedDependency, mitigationReason, expectedEvidence, conclusion);
    }

    public synchronized void startTraffic() {
        require(step != Step.COMPLETED, "Reset the challenge before starting new traffic.");
        shippingTraffic.stop();
        if (gameDayTraffic != null) gameDayTraffic.stop();
        if (step == Step.MEASURE && baselineWindowId == 0) {
            baselineWindowId = traffic.beginWindow();
            metrics.addEvent("TRAFFIC_STARTED", "Baseline traffic started");
        }
        traffic.start();
    }

    public synchronized void stopTraffic() {
        traffic.stop();
    }

    public synchronized void captureBaseline() {
        require(step == Step.MEASURE, "The baseline has already been captured.");
        require(traffic.isRunning(), "Start traffic before capturing a baseline.");
        require(baselineWindowId != 0, "Start traffic before capturing a baseline.");
        require(!toxiproxy.latencyActive(), "Remove the latency fault before measuring a baseline.");
        baseline = enoughSamples(baselineWindowId);
        metrics.addEvent("BASELINE_CAPTURED", "Baseline captured");
        step = Step.HYPOTHESIS;
    }

    @Autowired
    void gameDayTraffic(GameDayTrafficGenerator generator) {
        this.gameDayTraffic = generator;
    }

    public synchronized void captureBaseline(List<String> metrics, String dependency) {
        require(metrics != null && metrics.contains("responseLatency")
                        && metrics.stream().allMatch(Set.of("responseLatency", "successRate")::contains),
                "Select response latency as a steady-state metric.");
        require("inventory".equals(dependency), "Identify the Stock dependency being tested.");
        captureBaseline();
        steadyStateMetrics = List.copyOf(metrics);
        testedDependency = dependency;
    }

    public synchronized void saveHypothesis(Hypothesis input) {
        require(step == Step.HYPOTHESIS, "Capture a baseline before writing a hypothesis.");
        require(input != null && filled(input.expectedBehavior()) && filled(input.reason()),
                "Complete both parts of the hypothesis.");
        hypothesis = new Hypothesis(input.expectedBehavior().trim(), input.reason().trim());
        step = Step.EXPERIMENT;
    }

    public synchronized void startExperiment() {
        require(step == Step.EXPERIMENT && !experimentActive,
                "Record a hypothesis before injecting the failure.");
        require(traffic.isRunning(), "Start traffic before injecting the failure.");
        require(!toxiproxy.latencyActive(), "Remove the existing latency fault first.");
        toxiproxy.injectLatency(definition.latencyMs());
        experimentWindowId = traffic.beginWindow();
        experimentActive = true;
        metrics.addEvent("FAILURE_INJECTED", "1500 ms latency injected");
    }

    public synchronized void captureExperiment() {
        require(step == Step.EXPERIMENT && experimentActive,
                "Inject the latency fault before measuring its impact.");
        require(toxiproxy.latencyActive(), "The latency fault is no longer active.");
        MeasurementSummary captured = enoughSamples(experimentWindowId);
        toxiproxy.removeLatency();
        experiment = captured;
        experimentActive = false;
        metrics.addEvent("FAILURE_REMOVED", "Latency removed after measurement");
        step = Step.OBSERVE;
    }

    public synchronized void saveObservation(Observation input) {
        require(step == Step.OBSERVE, "Measure the failure before recording observations.");
        require(input != null && filled(input.whatChanged()) && filled(input.why()),
                "Describe what changed and why your hypothesis was or was not confirmed.");
        require(input.metricChangedMost() != null && Set.of("AVERAGE_LATENCY", "P95_LATENCY", "SUCCESS_RATE")
                        .contains(input.metricChangedMost()),
                "Choose the metric that changed most.");
        require(input.hypothesisConfirmed() != null
                        && Set.of("YES", "PARTIALLY", "NO").contains(input.hypothesisConfirmed()),
                "Choose whether your hypothesis was confirmed.");
        observation = new Observation(input.whatChanged().trim(), input.metricChangedMost(),
                input.hypothesisConfirmed(), input.why().trim());
        step = Step.IMPROVE;
    }

    public synchronized void applyMitigation(String optionId) {
        require(step == Step.IMPROVE && !validationActive,
                "Record your observation before applying a mitigation.");
        Challenge1Definition.MitigationOption selected = definition.resilienceOptions().stream()
                .filter(option -> option.id().equals(optionId)).findFirst()
                .orElseThrow(() -> new ChallengeStateException("Choose one of the available mitigations."));
        storefront.apply(selected.settings());
        mitigation = selected;
        validation = null;
        validationFeedback = List.of();
        metrics.addEvent("MITIGATION_APPLIED", selected.label());
    }

    public synchronized void applyMitigation(String optionId, String reason, String evidence) {
        require(reason != null && reason.trim().length() >= 10
                        && evidence != null && evidence.trim().length() >= 10,
                "Explain the problem you are addressing and what evidence would show improvement.");
        applyMitigation(optionId);
        mitigationReason = reason.trim();
        expectedEvidence = evidence.trim();
    }

    public synchronized void startValidation() {
        require(step == Step.IMPROVE && mitigation != null && !validationActive,
                "Apply a mitigation before rerunning the experiment.");
        require(traffic.isRunning(), "Start traffic before rerunning the experiment.");
        require(!toxiproxy.latencyActive(), "Remove the existing latency fault first.");
        toxiproxy.injectLatency(definition.latencyMs());
        validationWindowId = traffic.beginWindow();
        validationActive = true;
        metrics.addEvent("VALIDATION_STARTED", "Same 1500 ms fault rerun");
    }

    public synchronized void captureValidation() {
        require(step == Step.IMPROVE && validationActive,
                "Rerun the same latency experiment before validating.");
        require(toxiproxy.latencyActive(), "The validation fault is no longer active.");
        MeasurementSummary captured = enoughSamples(validationWindowId);
        toxiproxy.removeLatency();
        validation = captured;
        validationActive = false;
        metrics.addEvent("FAILURE_REMOVED", "Latency removed after validation");
        validationFeedback = evaluate(captured);
        if (validationFeedback.isEmpty()) {
            step = Step.CONCLUDE;
            traffic.stop();
            metrics.addEvent("VALIDATION_PASSED", "Challenge 1 validation passed");
        }
    }

    public synchronized void saveConclusion(String text) {
        require(step == Step.CONCLUDE, "Validate an improvement before concluding.");
        require(text != null && text.trim().length() >= 10,
                "Summarize what the saved measurements show.");
        conclusion = text.trim();
        step = Step.COMPLETED;
        metrics.addEvent("CHALLENGE_COMPLETED", "Challenge 1 completed");
    }

    public synchronized void reset() {
        traffic.stop();
        toxiproxy.removeLatency();
        storefront.apply(definition.defaultResilience());
        traffic.resetMetrics();
        step = Step.MEASURE;
        baselineWindowId = 0;
        experimentWindowId = 0;
        validationWindowId = 0;
        experimentActive = false;
        validationActive = false;
        baseline = null;
        experiment = null;
        validation = null;
        hypothesis = null;
        observation = null;
        mitigation = null;
        validationFeedback = List.of();
        steadyStateMetrics = List.of();
        testedDependency = mitigationReason = expectedEvidence = conclusion = null;
    }

    private MeasurementSummary enoughSamples(long windowId) {
        MeasurementSummary summary = metrics.summaryForWindow(windowId);
        int minimum = definition.evaluation().technical().minimumSamplesPerSnapshot();
        require(summary.requestCount() >= minimum,
                "Keep traffic running until at least " + minimum + " requests complete in this step.");
        return summary;
    }

    private List<String> evaluate(MeasurementSummary postMitigation) {
        var rules = definition.evaluation().technical();
        List<String> issues = new ArrayList<>();
        if (experiment.p95LatencyMs() - baseline.p95LatencyMs()
                < rules.failureMustIncreaseP95ByMs()) {
            issues.add("The original fault did not measurably increase p95 latency. Reset and repeat the experiment.");
        }
        if (postMitigation.p95LatencyMs() > rules.mitigationMaxP95Ms()) {
            issues.add("Post-mitigation p95 latency is still above the target.");
        }
        if (postMitigation.successRate() < rules.mitigationMinSuccessRate()) {
            issues.add("Too many post-mitigation requests failed.");
        }
        double improvementPercent = experiment.p95LatencyMs() == 0 ? 0
                : 100.0 * (experiment.p95LatencyMs() - postMitigation.p95LatencyMs())
                        / experiment.p95LatencyMs();
        if (improvementPercent < rules.minimumP95ImprovementPercent()) {
            issues.add("Post-mitigation p95 latency did not improve enough over the failure run.");
        }
        if (rules.mitigationRequiresFallback() && postMitigation.fallbackCount() == 0) {
            issues.add("No request used the graceful stock-information fallback.");
        }
        return List.copyOf(issues);
    }

    private static boolean filled(String value) {
        return value != null && !value.isBlank();
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new ChallengeStateException(message);
        }
    }

    public record Hypothesis(String expectedBehavior, String reason) {
    }

    public record Observation(String whatChanged, String metricChangedMost,
            String hypothesisConfirmed, String why) {
    }

    public record ChallengeView(String id, String title, String scenario,
            List<Challenge1Definition.Instruction> instructions, List<String> hints,
            List<Challenge1Definition.MitigationOption> mitigationOptions,
            int latencyMs, int minimumSamples, int currentWindowSamples,
            Step step, boolean experimentActive, boolean validationActive,
            MeasurementSummary baseline, Hypothesis hypothesis,
            MeasurementSummary experiment, Observation observation,
            String mitigationId, MeasurementSummary validation,
            List<String> validationFeedback, boolean completed,
            List<String> steadyStateMetrics, String testedDependency,
            String mitigationReason, String expectedEvidence, String conclusion) {
    }
}
