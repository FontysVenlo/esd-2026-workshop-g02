package de.workshop.chaos.controller.challenge;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import de.workshop.chaos.controller.slice.ExperimentMetricsStore;
import de.workshop.chaos.controller.slice.ExperimentTrafficGenerator;
import de.workshop.chaos.controller.slice.MetricsStore.MeasurementSummary;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class Challenge3Service {
    public enum Step { MEASURE, HYPOTHESIS, EXPERIMENT, OBSERVE, IMPROVE, REFLECT, COMPLETED }
    public record Settings(int timeoutMs, boolean fallbackEnabled, int retries,
            boolean circuitBreakerEnabled) {
        public static Settings defaults() { return new Settings(4000, false, 0, false); }
    }
    public record Observation(String whatChanged, String strongestEvidence,
            String hypothesisConfirmed, String explanation) {}
    public record Reflection(String failureRevealed, String mitigationAddressed,
            String whyMoreResilient) {}
    public record Measurement(long averageLatencyMs, long p95LatencyMs,
            double successRate, double errorRate, int requestCount, long fallbackCount,
            String dependencyStatus) {}
    public record View(String id, String title, String scenario, String guidanceLevel,
            List<Challenge3Definition.Fault> faults, Challenge3Definition.Controls controls,
            int minimumSamples, int currentWindowSamples, Step step,
            List<String> steadyStateIndicators, Measurement baseline,
            String hypothesis, String selectedFaultId, Measurement failure,
            Observation observation, Settings settings, String mitigationReason,
            Measurement validation, List<String> validationFeedback,
            Reflection reflection, boolean experimentActive, boolean validationActive,
            boolean completed, String blastRadius, String abortCondition,
            String expectedEvidence) {}

    private final Challenge3Definition definition;
    private final ToxiproxyClient toxiproxy;
    private final ExperimentTrafficGenerator traffic;
    private final TrafficGenerator challenge1Traffic;
    private GameDayTrafficGenerator gameDayTraffic;
    private final ShippingTrafficGenerator challenge2Traffic;
    private final ExperimentMetricsStore metrics;
    private final ExperimentSettingsClient storefront;

    private Step step = Step.MEASURE;
    private long baselineWindow;
    private long failureWindow;
    private long validationWindow;
    private boolean experimentActive;
    private boolean validationActive;
    private List<String> steadyStateIndicators = List.of();
    private Measurement baseline;
    private String hypothesis;
    private Challenge3Definition.Fault selectedFault;
    private Measurement failure;
    private Observation observation;
    private Settings settings = Settings.defaults();
    private String mitigationReason;
    private String blastRadius;
    private String abortCondition;
    private String expectedEvidence;
    private Measurement validation;
    private List<String> validationFeedback = List.of();
    private Reflection reflection;

    public Challenge3Service(Challenge3Definition definition, ToxiproxyClient toxiproxy,
            ExperimentTrafficGenerator traffic, TrafficGenerator challenge1Traffic,
            ShippingTrafficGenerator challenge2Traffic, ExperimentMetricsStore metrics,
            ExperimentSettingsClient storefront) {
        this.definition = definition;
        this.toxiproxy = toxiproxy;
        this.traffic = traffic;
        this.challenge1Traffic = challenge1Traffic;
        this.challenge2Traffic = challenge2Traffic;
        this.metrics = metrics;
        this.storefront = storefront;
    }

    public synchronized View view() {
        long activeWindow = switch (step) {
            case MEASURE -> baselineWindow;
            case EXPERIMENT -> experimentActive ? failureWindow : 0;
            case IMPROVE -> validationActive ? validationWindow : 0;
            default -> 0;
        };
        int samples = activeWindow == 0 ? 0 : metrics.summaryForWindow(activeWindow).requestCount();
        return new View(definition.id(), definition.title(), definition.scenario(),
                definition.guidanceLevel(), definition.faults(), definition.controls(),
                definition.evaluation().minimumSamplesPerSnapshot(), samples, step,
                steadyStateIndicators, baseline, hypothesis,
                selectedFault == null ? null : selectedFault.id(), failure, observation,
                settings, mitigationReason, validation, validationFeedback, reflection,
                experimentActive, validationActive, step == Step.COMPLETED,
                blastRadius, abortCondition, expectedEvidence);
    }

    public synchronized void startTraffic() {
        require(step != Step.COMPLETED, "Reset this challenge before starting a new run.");
        challenge1Traffic.stop();
        challenge2Traffic.stop();
        if (gameDayTraffic != null) gameDayTraffic.stop();
        if (step == Step.MEASURE && baselineWindow == 0) {
            baselineWindow = traffic.beginWindow();
        }
        traffic.start();
        metrics.addEvent("TRAFFIC_STARTED", "Product requests started");
    }

    @Autowired
    void gameDayTraffic(GameDayTrafficGenerator generator) {
        this.gameDayTraffic = generator;
    }

    public synchronized void stopTraffic() { traffic.stop(); }

    public synchronized void captureBaseline(List<String> indicators) {
        require(step == Step.MEASURE && baselineWindow != 0 && traffic.isRunning(),
                "Start product requests before capturing a baseline.");
        require(indicators != null && !indicators.isEmpty()
                && indicators.stream().allMatch(Set.of("averageLatency", "p95Latency",
                        "successRate", "errorRate", "fallbackCount")::contains),
                "Choose at least one steady-state indicator.");
        require(matchesNormal(), "Restore the stock connection before capturing a baseline.");
        Measurement captured = measure(baselineWindow, "AVAILABLE");
        require(captured.successRate() >= definition.evaluation().baselineMinSuccessRate(),
                "Normal product requests are failing. Check the service before continuing.");
        steadyStateIndicators = List.copyOf(indicators);
        baseline = captured;
        step = Step.HYPOTHESIS;
        metrics.addEvent("BASELINE_CAPTURED", "Normal behavior captured");
    }

    public synchronized void saveHypothesis(String text, String faultId) {
        require(step == Step.HYPOTHESIS, "Capture a baseline first.");
        require(meaningful(text), "Write a testable hypothesis before injecting a fault.");
        selectedFault = definition.faults().stream().filter(f -> f.id().equals(faultId))
                .findFirst().orElseThrow(() -> new ChallengeStateException("Choose a fault."));
        hypothesis = text.trim();
        step = Step.EXPERIMENT;
    }

    public synchronized void saveExperimentPlan(String text, String faultId,
            String radius, String abort) {
        require(radius != null && Set.of("Stock information only", "Entire product page",
                "Entire Storefront", "Unclear from current evidence").contains(radius),
                "Choose the expected blast radius before the experiment.");
        require(abort != null && Set.of("Error rate above 50%", "Success rate below 50%",
                "Latency above 3000 ms", "Service completely unusable").contains(abort),
                "Choose an abort condition before the experiment.");
        saveHypothesis(text, faultId);
        blastRadius = radius;
        abortCondition = abort;
    }

    public synchronized void startExperiment() {
        require(step == Step.EXPERIMENT && !experimentActive,
                "Save a hypothesis and fault choice first.");
        require(traffic.isRunning(), "Start product requests before injecting the fault.");
        require(matchesNormal(), "Restore the stock connection before this experiment.");
        injectSelectedFault();
        require(matchesSelectedFault(), "The selected fault was not applied.");
        failureWindow = traffic.beginWindow();
        experimentActive = true;
        metrics.addEvent("FAULT_INJECTED", selectedFault.label());
    }

    public synchronized void captureFailure() {
        require(step == Step.EXPERIMENT && experimentActive,
                "Inject the chosen fault before capturing the result.");
        require(matchesSelectedFault(), "The fault changed. Repeat the experiment.");
        Measurement captured = measure(failureWindow, dependencyStatus());
        if ("LATENCY".equals(selectedFault.type())) {
            require(captured.p95LatencyMs() - baseline.p95LatencyMs()
                    >= definition.evaluation().latencyMinimumIncreaseMs(),
                    "The delay has not measurably affected requests. Collect more samples.");
        } else {
            require(captured.successRate() <= definition.evaluation().unavailableMaximumSuccessRate(),
                    "The outage has not measurably affected requests. Collect more samples.");
        }
        failure = captured;
        experimentActive = false;
        toxiproxy.restoreExperiment();
        step = Step.OBSERVE;
        metrics.addEvent("FAILURE_CAPTURED", "Fault result captured");
    }

    public synchronized void saveObservation(Observation input) {
        require(step == Step.OBSERVE, "Capture the fault result first.");
        require(input != null && meaningful(input.whatChanged())
                && meaningful(input.strongestEvidence()) && meaningful(input.explanation())
                && input.hypothesisConfirmed() != null
                && Set.of("YES", "PARTIALLY", "NO").contains(input.hypothesisConfirmed()),
                "Describe what changed, your strongest metric, and whether the hypothesis held.");
        observation = input;
        step = Step.IMPROVE;
    }

    public synchronized void applySettings(Settings chosen, String reason) {
        require(step == Step.IMPROVE && !validationActive,
                "Record an observation before changing resilience settings.");
        require(meaningful(reason), "Explain why you chose these settings.");
        require(chosen != null && definition.controls().timeoutMs().contains(chosen.timeoutMs())
                && definition.controls().retries().contains(chosen.retries()),
                "Choose supported timeout and retry values.");
        storefront.apply(chosen);
        settings = chosen;
        mitigationReason = reason.trim();
        validation = null;
        validationFeedback = List.of();
        metrics.addEvent("MITIGATION_APPLIED", "Resilience settings changed");
    }

    public synchronized void applySettings(Settings chosen, String reason, String evidence) {
        require(meaningful(evidence), "State what evidence would show improvement.");
        applySettings(chosen, reason);
        expectedEvidence = evidence.trim();
    }

    public synchronized void startValidation() {
        require(step == Step.IMPROVE && mitigationReason != null && !validationActive,
                "Apply your resilience settings first.");
        require(traffic.isRunning(), "Start product requests before validating.");
        require(matchesNormal(), "Restore the stock connection before validating.");
        injectSelectedFault();
        require(matchesSelectedFault(), "The original fault was not restored.");
        validationWindow = traffic.beginWindow();
        validationActive = true;
        metrics.addEvent("VALIDATION_STARTED", "Same fault rerun");
    }

    public synchronized void captureValidation() {
        require(step == Step.IMPROVE && validationActive,
                "Rerun the original fault before capturing validation.");
        require(matchesSelectedFault(), "The fault changed. Validation must use the original fault.");
        validation = measure(validationWindow, dependencyStatus());
        validationActive = false;
        validationFeedback = evaluate(validation);
        toxiproxy.restoreExperiment();
        metrics.addEvent("VALIDATION_CAPTURED", "Validation result captured");
        if (validationFeedback.isEmpty()) {
            step = Step.REFLECT;
            traffic.stop();
        }
    }

    public synchronized void saveReflection(Reflection input) {
        require(step == Step.REFLECT, "First validate an improvement under the same fault.");
        require(input != null && meaningful(input.failureRevealed())
                && meaningful(input.mitigationAddressed()) && meaningful(input.whyMoreResilient()),
                "Complete all three reflection answers.");
        reflection = input;
        step = Step.COMPLETED;
        metrics.addEvent("CHALLENGE_COMPLETED", "Independent experiment completed");
    }

    public synchronized void reset() {
        traffic.stop();
        toxiproxy.restoreExperiment();
        storefront.apply(Settings.defaults());
        traffic.resetMetrics();
        step = Step.MEASURE;
        baselineWindow = failureWindow = validationWindow = 0;
        experimentActive = validationActive = false;
        steadyStateIndicators = List.of();
        baseline = failure = validation = null;
        hypothesis = mitigationReason = null;
        selectedFault = null;
        observation = null;
        settings = Settings.defaults();
        validationFeedback = List.of();
        reflection = null;
        blastRadius = abortCondition = expectedEvidence = null;
    }

    private List<String> evaluate(Measurement result) {
        var rules = definition.evaluation();
        List<String> feedback = new ArrayList<>();
        if (result.successRate() < rules.validationMinimumSuccessRate()) {
            feedback.add("The product page still fails too often.");
        }
        if ("LATENCY".equals(selectedFault.type())) {
            double limit = failure.p95LatencyMs()
                    * (1 - rules.latencyMinimumP95ImprovementPercent() / 100.0);
            if (result.p95LatencyMs() > limit) {
                feedback.add("P95 response time has not improved enough under the same delay.");
            }
        } else {
            if (result.p95LatencyMs() > rules.unavailableMaximumP95Ms()) {
                feedback.add("Responses remain too slow during the outage.");
            }
            if (rules.unavailableRequiresFallback() && result.fallbackCount() == 0) {
                feedback.add("No request returned a useful response without stock data.");
            }
        }
        return List.copyOf(feedback);
    }

    private Measurement measure(long window, String status) {
        MeasurementSummary summary = metrics.summaryForWindow(window);
        require(summary.requestCount() >= definition.evaluation().minimumSamplesPerSnapshot(),
                "Keep requests running until enough results are collected.");
        return new Measurement(summary.averageLatencyMs(), summary.p95LatencyMs(),
                summary.successRate(), 1 - summary.successRate(), summary.requestCount(),
                summary.fallbackCount(), status);
    }

    private boolean matchesNormal() {
        var state = toxiproxy.experimentState();
        return state.enabled() && state.toxicCount() == 0;
    }

    private boolean matchesSelectedFault() {
        var state = toxiproxy.experimentState();
        return "UNAVAILABLE".equals(selectedFault.type())
                ? !state.enabled() && state.toxicCount() == 0
                : state.enabled() && state.toxicCount() == 1
                        && state.latencyMs() != null
                        && state.latencyMs() == selectedFault.latencyMs();
    }

    private String dependencyStatus() {
        return "UNAVAILABLE".equals(selectedFault.type()) ? "UNAVAILABLE"
                : "DELAYED_" + selectedFault.latencyMs() + "_MS";
    }

    private void injectSelectedFault() {
        if ("UNAVAILABLE".equals(selectedFault.type())) {
            toxiproxy.disconnectExperiment();
        } else {
            toxiproxy.injectExperimentLatency(selectedFault.latencyMs());
        }
    }

    private static boolean meaningful(String text) {
        return text != null && text.trim().length() >= 10;
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new ChallengeStateException(message);
    }
}
