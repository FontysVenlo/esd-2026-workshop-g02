package de.workshop.chaos.controller.challenge;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import de.workshop.chaos.controller.slice.MetricsStore.MeasurementSummary;
import de.workshop.chaos.controller.slice.ShippingMetricsStore;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** A separate, partially guided run for an unavailable Shipping dependency. */
@Service
public class Challenge2Service {

    public enum Step {
        MEASURE, HYPOTHESIS, EXPERIMENT, OBSERVE, IMPROVE, CONCLUDE, COMPLETED
    }

    private final Challenge2Definition definition;
    private final ToxiproxyClient toxiproxy;
    private final ShippingTrafficGenerator traffic;
    private final TrafficGenerator inventoryTraffic;
    private GameDayTrafficGenerator gameDayTraffic;
    private final ShippingMetricsStore metrics;
    private final ShippingSettingsClient storefront;

    private Step step = Step.MEASURE;
    private long baselineWindowId;
    private long experimentWindowId;
    private long validationWindowId;
    private boolean experimentActive;
    private boolean validationActive;
    private ShippingMeasurement baseline;
    private ShippingMeasurement experiment;
    private ShippingMeasurement validation;
    private String hypothesis;
    private Observation observation;
    private Challenge2Definition.MitigationOption mitigation;
    private String mitigationReason;
    private List<String> validationFeedback = List.of();
    private List<String> conceptFeedback = List.of();
    private List<String> steadyStateMetrics = List.of();
    private String blastRadiusReduced;

    public Challenge2Service(Challenge2Definition definition, ToxiproxyClient toxiproxy,
            ShippingTrafficGenerator traffic, TrafficGenerator inventoryTraffic,
            ShippingMetricsStore metrics, ShippingSettingsClient storefront) {
        this.definition = definition;
        this.toxiproxy = toxiproxy;
        this.traffic = traffic;
        this.inventoryTraffic = inventoryTraffic;
        this.metrics = metrics;
        this.storefront = storefront;
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
                definition.objective(), definition.hints(), definition.difficulty(),
                definition.estimatedMinutes(), definition.guidanceLevel(),
                definition.resilienceOptions(),
                definition.evaluation().technical().minimumSamplesPerSnapshot(),
                currentWindowSamples, step, experimentActive, validationActive,
                baseline, hypothesis, experiment, observation,
                mitigation == null ? null : mitigation.id(), mitigationReason,
                validation, validationFeedback, conceptFeedback, step == Step.COMPLETED,
                steadyStateMetrics, blastRadiusReduced);
    }

    public synchronized void startTraffic() {
        require(step != Step.COMPLETED, "Reset Challenge 2 before starting new traffic.");
        inventoryTraffic.stop();
        if (gameDayTraffic != null) gameDayTraffic.stop();
        if (step == Step.MEASURE && baselineWindowId == 0) {
            baselineWindowId = traffic.beginWindow();
            metrics.addEvent("TRAFFIC_STARTED", "Normal order traffic started");
        }
        traffic.start();
    }

    public synchronized void stopTraffic() {
        traffic.stop();
    }

    public synchronized void captureBaseline() {
        require(step == Step.MEASURE && baselineWindowId != 0 && traffic.isRunning(),
                "Start normal traffic before capturing a baseline.");
        require(toxiproxy.shippingAvailable(),
                "Reconnect Shipping before measuring the normal baseline.");
        ShippingMeasurement captured = measure(baselineWindowId, true);
        require(captured.successRate()
                        >= definition.evaluation().technical().baselineMinSuccessRate(),
                "Normal requests are failing. Check Shipping before capturing a baseline.");
        baseline = captured;
        step = Step.HYPOTHESIS;
        metrics.addEvent("BASELINE_CAPTURED", "Baseline captured");
    }

    @Autowired
    void gameDayTraffic(GameDayTrafficGenerator generator) {
        this.gameDayTraffic = generator;
    }

    public synchronized void captureBaseline(List<String> indicators) {
        require(indicators != null && !indicators.isEmpty()
                && indicators.stream().allMatch(Set.of("latency", "success", "errors")::contains),
                "Choose at least one health metric before measuring normal behavior.");
        captureBaseline();
        steadyStateMetrics = List.copyOf(indicators);
    }

    public synchronized void saveHypothesis(String input) {
        require(step == Step.HYPOTHESIS, "Capture a baseline first.");
        require(meaningful(input), "Write a specific hypothesis before the experiment.");
        hypothesis = input.trim();
        step = Step.EXPERIMENT;
    }

    public synchronized void startExperiment() {
        require(step == Step.EXPERIMENT && !experimentActive,
                "Record a hypothesis before disconnecting Shipping.");
        require(traffic.isRunning(), "Start traffic before the experiment.");
        require(toxiproxy.shippingAvailable(), "Shipping is already unavailable.");
        toxiproxy.disconnectShipping();
        experimentWindowId = traffic.beginWindow();
        experimentActive = true;
        metrics.addEvent("FAILURE_INJECTED", "Shipping disconnected");
    }

    public synchronized void captureExperiment() {
        require(step == Step.EXPERIMENT && experimentActive,
                "Disconnect Shipping before capturing the failure.");
        require(!toxiproxy.shippingAvailable(),
                "Shipping was reconnected. Repeat the unavailable-service experiment.");
        ShippingMeasurement captured = measure(experimentWindowId, false);
        require(captured.successRate()
                        <= definition.evaluation().technical().failureMaxSuccessRate(),
                "The failure did not measurably affect the order summary. Reset and retry.");
        experiment = captured;
        experimentActive = false;
        step = Step.OBSERVE;
        metrics.addEvent("FAILURE_CAPTURED", "Unavailable-service result captured");
    }

    public synchronized void saveObservation(Observation input) {
        require(step == Step.OBSERVE, "Capture the failure before recording observations.");
        require(input != null && meaningful(input.whatChanged())
                        && meaningful(input.metricsAffected()) && meaningful(input.why())
                        && input.completeRequestFailed() != null,
                "Record what changed, the affected metrics, and why.");
        require(input.hypothesisConfirmed() != null
                        && Set.of("YES", "PARTIALLY", "NO")
                                .contains(input.hypothesisConfirmed()),
                "Choose whether your hypothesis was confirmed.");
        require(input.blastRadius() != null && Set.of("Only Shipping functionality",
                "Entire order summary", "Entire Storefront",
                "Unclear from current evidence").contains(input.blastRadius()),
                "Use your evidence to choose the observed blast radius.");
        observation = new Observation(input.whatChanged().trim(),
                input.metricsAffected().trim(), input.completeRequestFailed(),
                input.hypothesisConfirmed(), input.why().trim(), input.blastRadius());
        step = Step.IMPROVE;
    }

    public synchronized void applyMitigation(String optionId, String reason) {
        require(step == Step.IMPROVE && !validationActive,
                "Record your observation before applying a mitigation.");
        require(meaningful(reason), "Explain why you chose this approach.");
        Challenge2Definition.MitigationOption selected = definition.resilienceOptions().stream()
                .filter(option -> option.id().equals(optionId)).findFirst()
                .orElseThrow(() -> new ChallengeStateException("Choose an available approach."));
        storefront.apply(selected.settings());
        mitigation = selected;
        mitigationReason = reason.trim();
        validation = null;
        validationFeedback = List.of();
        conceptFeedback = List.of();
        metrics.addEvent("MITIGATION_APPLIED", selected.label());
    }

    public synchronized void startValidation() {
        require(step == Step.IMPROVE && mitigation != null && !validationActive,
                "Apply an approach before rerunning the experiment.");
        require(traffic.isRunning(), "Start traffic before validating.");
        require(!toxiproxy.shippingAvailable(),
                "Shipping must stay disconnected for the same failure experiment.");
        toxiproxy.disconnectShipping();
        validationWindowId = traffic.beginWindow();
        validationActive = true;
        metrics.addEvent("VALIDATION_STARTED", "Shipping outage rerun");
    }

    public synchronized void captureValidation() {
        require(step == Step.IMPROVE && validationActive,
                "Rerun the Shipping outage before capturing post-mitigation results.");
        require(!toxiproxy.shippingAvailable(),
                "Shipping was reconnected. Validation requires the same outage.");
        ShippingMeasurement captured = measure(validationWindowId, false);
        validation = captured;
        validationActive = false;
        validationFeedback = evaluateTechnical(captured);
        conceptFeedback = evaluateConcepts();
        metrics.addEvent("VALIDATION_CAPTURED", "Post-mitigation result captured");
        if (validationFeedback.isEmpty()) {
            step = Step.CONCLUDE;
            traffic.stop();
            metrics.addEvent("VALIDATION_PASSED", "Challenge 2 validation passed");
        }
    }

    public synchronized void saveBlastRadiusConclusion(String answer) {
        require(step == Step.CONCLUDE, "Capture a successful validation first.");
        require(answer != null && Set.of("Yes", "Partly", "No").contains(answer),
                "Choose whether the mitigation reduced the blast radius.");
        blastRadiusReduced = answer;
        step = Step.COMPLETED;
        metrics.addEvent("CHALLENGE_COMPLETED", "Challenge 2 completed");
    }

    public synchronized void reset() {
        traffic.stop();
        toxiproxy.restoreShipping();
        storefront.apply(definition.defaultResilience());
        traffic.resetMetrics();
        step = Step.MEASURE;
        baselineWindowId = 0;
        experimentWindowId = 0;
        validationWindowId = 0;
        experimentActive = false;
        validationActive = false;
        baseline = null;
        hypothesis = null;
        experiment = null;
        observation = null;
        mitigation = null;
        mitigationReason = null;
        validation = null;
        validationFeedback = List.of();
        conceptFeedback = List.of();
        steadyStateMetrics = List.of();
        blastRadiusReduced = null;
    }

    private ShippingMeasurement measure(long windowId, boolean shippingAvailable) {
        MeasurementSummary summary = metrics.summaryForWindow(windowId);
        require(summary.requestCount()
                        >= definition.evaluation().technical().minimumSamplesPerSnapshot(),
                "Keep traffic running until enough requests complete in this step.");
        return new ShippingMeasurement(summary.averageLatencyMs(), summary.p95LatencyMs(),
                summary.successRate(), 1.0 - summary.successRate(),
                summary.requestCount(), summary.fallbackCount(), shippingAvailable);
    }

    private List<String> evaluateTechnical(ShippingMeasurement result) {
        var rules = definition.evaluation().technical();
        List<String> issues = new ArrayList<>();
        if (result.shippingAvailable()) {
            issues.add("Shipping must remain unavailable during validation.");
        }
        if (result.successRate() < rules.mitigationMinSuccessRate()) {
            issues.add("The order summary still fails too often.");
        }
        if (result.p95LatencyMs() > rules.mitigationMaxP95Ms()) {
            issues.add("The order summary is still too slow.");
        }
        if (rules.mitigationRequiresFallback() && result.fallbackCount() == 0) {
            issues.add("No response continued without a Shipping estimate.");
        }
        return List.copyOf(issues);
    }

    private List<String> evaluateConcepts() {
        Map<String, Challenge2Definition.ConceptField> fields =
                definition.evaluation().conceptual().fields();
        List<String> suggestions = new ArrayList<>();
        checkConcept(fields.get("dependencyFailure"),
                observation.whatChanged() + " " + observation.why(),
                "Explain that Shipping was unavailable or unreachable.", suggestions);
        checkConcept(fields.get("impact"),
                observation.whatChanged() + " " + observation.metricsAffected(),
                "Describe how errors or request success changed.", suggestions);
        checkConcept(fields.get("mitigation"), mitigationReason,
                "Explain how the main request stays usable without an estimate.", suggestions);
        return List.copyOf(suggestions);
    }

    private static void checkConcept(Challenge2Definition.ConceptField field,
            String answer, String suggestion, List<String> suggestions) {
        if (field == null) {
            return;
        }
        String normalized = " " + normalize(answer) + " ";
        for (String concept : field.requiredConcepts()) {
            List<String> synonyms = field.conceptGroups().getOrDefault(concept, List.of());
            if (synonyms.stream().noneMatch(word ->
                    normalized.contains(" " + normalize(word) + " "))) {
                suggestions.add(suggestion);
                return;
            }
        }
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFKC)
                .replaceAll("[^\\p{L}\\p{N}]+", " ").trim().replaceAll("\\s+", " ");
    }

    private static boolean meaningful(String value) {
        return value != null && value.trim().length() >= 10;
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new ChallengeStateException(message);
        }
    }

    public record Observation(String whatChanged, String metricsAffected,
            Boolean completeRequestFailed, String hypothesisConfirmed, String why,
            String blastRadius) {
        public Observation(String whatChanged, String metricsAffected,
                Boolean completeRequestFailed, String hypothesisConfirmed, String why) {
            this(whatChanged, metricsAffected, completeRequestFailed,
                    hypothesisConfirmed, why, "Entire order summary");
        }
    }

    public record ShippingMeasurement(long averageLatencyMs, long p95LatencyMs,
            double successRate, double errorRate, int requestCount,
            long fallbackCount, boolean shippingAvailable) {
    }

    public record ChallengeView(String id, String title, String scenario, String objective,
            List<String> hints, String difficulty, int estimatedMinutes, String guidanceLevel,
            List<Challenge2Definition.MitigationOption> mitigationOptions,
            int minimumSamples, int currentWindowSamples, Step step,
            boolean experimentActive, boolean validationActive,
            ShippingMeasurement baseline, String hypothesis,
            ShippingMeasurement experiment, Observation observation,
            String mitigationId, String mitigationReason, ShippingMeasurement validation,
            List<String> validationFeedback, List<String> conceptFeedback,
            boolean completed, List<String> steadyStateMetrics,
            String blastRadiusReduced) {
    }
}
