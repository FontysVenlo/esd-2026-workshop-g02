package de.workshop.chaos.controller.challenge;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import de.workshop.chaos.controller.slice.ExperimentTrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayMetricsStore;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import de.workshop.chaos.controller.slice.MetricsStore.MeasurementSummary;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** A reproducible incident and participant-designed GameDay reproduction. */
@Service
public class Challenge4Service {
    public enum Step { INVESTIGATE, PLAN, EXPERIMENT, ANALYZE, IMPROVE, VALIDATE, CONCLUDE, COMPLETED }
    public record Settings(int inventoryTimeoutMs, boolean inventoryFallbackEnabled,
            int shippingTimeoutMs, boolean shippingFallbackEnabled, int retries) {
        public static Settings defaults() { return new Settings(4000, false, 4000, false, 0); }
    }
    public record Plan(String diagnosisTarget, String metricEvidence, String hypothesis,
            String faultId, String blastRadius, String abortCondition) {}
    public record Analysis(String whatChanged, String strongestMetric,
            String blastRadiusObserved, String interpretation) {}
    public record Measurement(long averageLatencyMs, long p95LatencyMs,
            double successRate, double errorRate, int requestCount, long fallbackCount) {}
    public record View(String id, String title, String difficulty, String scenario,
            String objective, List<Challenge4Definition.Fault> availableFaults,
            int minimumSamples, int currentWindowSamples, Step step,
            boolean grafanaOpened, List<String> steadyStateSignals, String baselineNote,
            Measurement baseline, Measurement incident, Plan plan,
            Measurement reproduction, Analysis analysis, Settings settings,
            String mitigationReason, String expectedEvidence, Measurement validation,
            List<String> validationFeedback, String conclusion,
            boolean incidentActive, boolean experimentActive, boolean validationActive,
            boolean completed) {}

    private final Challenge4Definition definition;
    private final Challenge4Definition.Fault hiddenScenario;
    private final ToxiproxyClient toxiproxy;
    private final GameDayTrafficGenerator traffic;
    private final TrafficGenerator challenge1Traffic;
    private final ShippingTrafficGenerator challenge2Traffic;
    private final ExperimentTrafficGenerator challenge3Traffic;
    private final GameDayMetricsStore metrics;
    private final GameDaySettingsClient storefront;

    private Step step = Step.INVESTIGATE;
    private long baselineWindow;
    private long incidentWindow;
    private long reproductionWindow;
    private long validationWindow;
    private boolean grafanaOpened;
    private boolean incidentActive;
    private boolean experimentActive;
    private boolean validationActive;
    private List<String> steadyStateSignals = List.of();
    private String baselineNote;
    private Measurement baseline;
    private Measurement incident;
    private Plan plan;
    private Challenge4Definition.Fault chosenFault;
    private Measurement reproduction;
    private Analysis analysis;
    private Settings settings = Settings.defaults();
    private String mitigationReason;
    private String expectedEvidence;
    private Measurement validation;
    private List<String> validationFeedback = List.of();
    private String conclusion;

    public Challenge4Service(Challenge4Definition definition,
            @Value("${workshop.gameday-scenario:inventory-latency}") String scenarioId,
            ToxiproxyClient toxiproxy, GameDayTrafficGenerator traffic,
            TrafficGenerator challenge1Traffic, ShippingTrafficGenerator challenge2Traffic,
            ExperimentTrafficGenerator challenge3Traffic, GameDayMetricsStore metrics,
            GameDaySettingsClient storefront) {
        this.definition = definition;
        hiddenScenario = definition.scenarios().stream().filter(f -> f.id().equals(scenarioId))
                .findFirst().orElseThrow(() -> new IllegalStateException(
                        "Unknown configured GameDay scenario: " + scenarioId));
        this.toxiproxy = toxiproxy;
        this.traffic = traffic;
        this.challenge1Traffic = challenge1Traffic;
        this.challenge2Traffic = challenge2Traffic;
        this.challenge3Traffic = challenge3Traffic;
        this.metrics = metrics;
        this.storefront = storefront;
    }

    public synchronized View view() {
        long window = switch (step) {
            case INVESTIGATE -> incidentActive ? incidentWindow : baselineWindow;
            case EXPERIMENT -> experimentActive ? reproductionWindow : 0;
            case VALIDATE -> validationActive ? validationWindow : 0;
            default -> 0;
        };
        int samples = window == 0 ? 0 : metrics.summaryForWindow(window).requestCount();
        return new View(definition.id(), definition.title(), definition.difficulty(),
                definition.scenario(), definition.objective(), definition.faults(),
                definition.evaluation().minimumSamplesPerWindow(), samples, step,
                grafanaOpened, steadyStateSignals, baselineNote, baseline, incident,
                plan, reproduction, analysis, settings, mitigationReason, expectedEvidence,
                validation, validationFeedback, conclusion, incidentActive,
                experimentActive, validationActive, step == Step.COMPLETED);
    }

    public synchronized void startTraffic() {
        require(step != Step.COMPLETED, "Reset the GameDay before starting new traffic.");
        challenge1Traffic.stop();
        challenge2Traffic.stop();
        challenge3Traffic.stop();
        if (step == Step.INVESTIGATE && baselineWindow == 0) {
            baselineWindow = traffic.beginWindow();
        }
        traffic.start();
        metrics.addEvent("TRAFFIC_STARTED", "GameDay requests started");
    }

    public synchronized void stopTraffic() { traffic.stop(); }

    public synchronized void markGrafanaOpened() {
        require(step != Step.COMPLETED, "The GameDay is already complete.");
        grafanaOpened = true;
    }

    public synchronized void captureBaseline(List<String> signals, String note) {
        require(step == Step.INVESTIGATE && baseline == null && baselineWindow != 0
                && traffic.isRunning(), "Start normal traffic before capturing a baseline.");
        require(grafanaOpened, "Open the monitoring dashboard before capturing a baseline.");
        require(signals != null && !signals.isEmpty()
                && signals.stream().allMatch(Set.of("latency", "successRate", "errorRate",
                        "requestRate", "dependencyCalls", "fallbacks")::contains),
                "Select the monitoring signals that define healthy behavior.");
        require(meaningful(note), "Record a short baseline observation from the dashboard.");
        require(normal(), "Restore the GameDay connections before measuring normal behavior.");
        Measurement captured = measure(baselineWindow);
        require(captured.successRate() >= definition.evaluation().baselineMinimumSuccessRate(),
                "Normal requests are failing. Ask the facilitator to check the local services.");
        steadyStateSignals = List.copyOf(signals);
        baselineNote = note.trim();
        baseline = captured;
        metrics.addEvent("BASELINE_CAPTURED", "Normal GameDay behavior captured");
    }

    public synchronized void beginIncident() {
        require(step == Step.INVESTIGATE && baseline != null && !incidentActive,
                "Capture normal behavior before starting the incident.");
        require(traffic.isRunning(), "Start GameDay traffic before the incident.");
        require(normal(), "Restore the GameDay connections before starting the incident.");
        inject(hiddenScenario);
        require(matches(hiddenScenario), "The controlled incident did not start.");
        incidentWindow = traffic.beginWindow();
        incidentActive = true;
        metrics.addEvent("INCIDENT_STARTED", "Controlled incident started");
    }

    public synchronized void captureIncident() {
        require(step == Step.INVESTIGATE && incidentActive,
                "Start the controlled incident first.");
        require(matches(hiddenScenario), "The incident changed. Reset and try again.");
        Measurement captured = measure(incidentWindow);
        require(impact(captured, hiddenScenario),
                "The incident impact is not clear yet. Collect more results.");
        incident = captured;
        incidentActive = false;
        toxiproxy.restoreGameDay();
        step = Step.PLAN;
        metrics.addEvent("INCIDENT_CAPTURED", "Incident evidence captured");
    }

    public synchronized void savePlan(Plan input) {
        require(step == Step.PLAN, "Investigate the incident first.");
        require(input != null && meaningful(input.metricEvidence())
                && meaningful(input.hypothesis()) && meaningful(input.blastRadius())
                && input.abortCondition() != null
                && Set.of("ERROR_RATE_50", "SUCCESS_RATE_50", "LATENCY_3000",
                        "UNUSABLE").contains(input.abortCondition()),
                "Record your diagnosis, evidence, hypothesis, blast radius, and abort condition.");
        require(input.diagnosisTarget() != null
                && Set.of("inventory", "shipping").contains(input.diagnosisTarget()),
                "Choose the dependency your monitoring evidence points to.");
        Challenge4Definition.Fault selected = definition.faults().stream()
                .filter(f -> f.id().equals(input.faultId())).findFirst()
                .orElseThrow(() -> new ChallengeStateException("Choose a supported fault."));
        require(selected.target().equals(input.diagnosisTarget()),
                "Choose a fault on the dependency named in your diagnosis.");
        require(hiddenScenario.target().equals(input.diagnosisTarget()),
                "The dependency-specific monitoring signals do not support that diagnosis. Recheck Grafana.");
        plan = input;
        chosenFault = selected;
        step = Step.EXPERIMENT;
    }

    public synchronized void startExperiment() {
        require(step == Step.EXPERIMENT && !experimentActive && plan != null,
                "Save your investigation plan before reproducing a fault.");
        require(traffic.isRunning(), "Start GameDay traffic before injecting the fault.");
        require(normal(), "Restore the GameDay connections before reproducing the fault.");
        inject(chosenFault);
        require(matches(chosenFault), "The chosen fault did not start.");
        reproductionWindow = traffic.beginWindow();
        experimentActive = true;
        metrics.addEvent("FAULT_INJECTED", "Chosen GameDay fault injected");
    }

    public synchronized void captureExperiment() {
        require(step == Step.EXPERIMENT && experimentActive,
                "Inject your selected fault before capturing the experiment.");
        require(matches(chosenFault), "The chosen fault changed. Repeat this run.");
        Measurement captured = measure(reproductionWindow);
        require(impact(captured, chosenFault),
                "This fault has not produced a measurable impact. Collect more results.");
        reproduction = captured;
        experimentActive = false;
        toxiproxy.restoreGameDay();
        step = Step.ANALYZE;
        metrics.addEvent("EXPERIMENT_CAPTURED", "Reproduction evidence captured");
    }

    public synchronized void saveAnalysis(Analysis input) {
        require(step == Step.ANALYZE, "Capture your controlled experiment first.");
        require(input != null && meaningful(input.whatChanged())
                && meaningful(input.strongestMetric())
                && meaningful(input.blastRadiusObserved())
                && meaningful(input.interpretation()),
                "Record the observed impact and what you conclude from it.");
        analysis = input;
        step = Step.IMPROVE;
    }

    public synchronized void applyMitigation(Settings chosen, String reason,
            String evidence) {
        require(step == Step.IMPROVE && !validationActive,
                "Analyze the fault before applying a mitigation.");
        require(chosen != null && validTimeout(chosen.inventoryTimeoutMs())
                && validTimeout(chosen.shippingTimeoutMs())
                && chosen.retries() >= 0 && chosen.retries() <= 1,
                "Choose supported timeout and retry values.");
        require(meaningful(reason) && meaningful(evidence),
                "Explain the mitigation and what evidence would show it worked.");
        storefront.apply(chosen);
        settings = chosen;
        mitigationReason = reason.trim();
        expectedEvidence = evidence.trim();
        validation = null;
        validationFeedback = List.of();
        metrics.addEvent("MITIGATION_APPLIED", "GameDay resilience settings applied");
    }

    public synchronized void startValidation() {
        require(step == Step.IMPROVE && mitigationReason != null && !validationActive,
                "Apply a mitigation before validation.");
        require(traffic.isRunning(), "Start GameDay traffic before validation.");
        require(normal(), "Restore GameDay connections before validation.");
        inject(chosenFault);
        require(matches(chosenFault), "The original fault did not start.");
        validationWindow = traffic.beginWindow();
        validationActive = true;
        step = Step.VALIDATE;
        metrics.addEvent("VALIDATION_STARTED", "Same GameDay fault rerun");
    }

    public synchronized void captureValidation() {
        require(step == Step.VALIDATE && validationActive,
                "Rerun the selected fault before capturing validation.");
        require(matches(chosenFault), "The fault changed. Validation requires the same fault.");
        validation = measure(validationWindow);
        validationActive = false;
        validationFeedback = evaluate(validation);
        toxiproxy.restoreGameDay();
        metrics.addEvent("VALIDATION_CAPTURED", "GameDay validation captured");
        if (validationFeedback.isEmpty()) {
            step = Step.CONCLUDE;
            traffic.stop();
        } else {
            step = Step.IMPROVE;
        }
    }

    public synchronized void saveConclusion(String text) {
        require(step == Step.CONCLUDE, "First validate an improvement under the same fault.");
        require(meaningful(text), "Record a short evidence-based conclusion.");
        conclusion = text.trim();
        step = Step.COMPLETED;
        metrics.addEvent("CHALLENGE_COMPLETED", "Mini GameDay completed");
    }

    public synchronized void reset() {
        traffic.stop();
        toxiproxy.restoreGameDay();
        storefront.apply(Settings.defaults());
        traffic.resetMetrics();
        step = Step.INVESTIGATE;
        baselineWindow = incidentWindow = reproductionWindow = validationWindow = 0;
        grafanaOpened = incidentActive = experimentActive = validationActive = false;
        steadyStateSignals = List.of();
        baselineNote = conclusion = mitigationReason = expectedEvidence = null;
        baseline = incident = reproduction = validation = null;
        plan = null;
        chosenFault = null;
        analysis = null;
        settings = Settings.defaults();
        validationFeedback = List.of();
    }

    private Measurement measure(long window) {
        MeasurementSummary summary = metrics.summaryForWindow(window);
        require(summary.requestCount() >= definition.evaluation().minimumSamplesPerWindow(),
                "Keep traffic running until enough requests finish in this window.");
        return new Measurement(summary.averageLatencyMs(), summary.p95LatencyMs(),
                summary.successRate(), 1 - summary.successRate(), summary.requestCount(),
                summary.fallbackCount());
    }

    private boolean impact(Measurement result, Challenge4Definition.Fault fault) {
        return "LATENCY".equals(fault.type())
                ? result.p95LatencyMs() - baseline.p95LatencyMs()
                        >= definition.evaluation().incidentMinimumP95IncreaseMs()
                : result.successRate() <= definition.evaluation().incidentMaximumOutageSuccessRate();
    }

    private List<String> evaluate(Measurement result) {
        var rules = definition.evaluation();
        List<String> feedback = new ArrayList<>();
        if (result.successRate() < rules.validationMinimumSuccessRate()) {
            feedback.add("The user-facing summary still fails too often.");
        }
        if ("LATENCY".equals(chosenFault.type())) {
            double limit = reproduction.p95LatencyMs()
                    * (1 - rules.validationMinimumP95ImprovementPercent() / 100.0);
            if (result.p95LatencyMs() > limit) {
                feedback.add("P95 latency has not improved enough under the same fault.");
            }
        } else {
            if (result.p95LatencyMs() > rules.validationMaximumOutageP95Ms()) {
                feedback.add("Responses remain too slow under the same fault.");
            }
            if (result.fallbackCount() == 0) {
                feedback.add("No response stayed useful without the failed dependency.");
            }
        }
        return List.copyOf(feedback);
    }

    private boolean normal() {
        var state = toxiproxy.gameDayState();
        return state.inventory().enabled() && state.inventory().toxicCount() == 0
                && state.shipping().enabled() && state.shipping().toxicCount() == 0;
    }

    private boolean matches(Challenge4Definition.Fault fault) {
        var state = toxiproxy.gameDayState();
        var target = "inventory".equals(fault.target()) ? state.inventory() : state.shipping();
        var other = "inventory".equals(fault.target()) ? state.shipping() : state.inventory();
        if (!other.enabled() || other.toxicCount() != 0) return false;
        return switch (fault.type()) {
            case "UNAVAILABLE" -> !target.enabled() && target.toxicCount() == 0;
            case "LATENCY" -> target.enabled() && target.toxicCount() == 1
                    && "latency".equals(target.toxicType())
                    && target.latencyMs() == fault.latencyMs();
            case "TIMEOUT" -> target.enabled() && target.toxicCount() == 1
                    && "timeout".equals(target.toxicType());
            default -> false;
        };
    }

    private void inject(Challenge4Definition.Fault fault) {
        toxiproxy.injectGameDayFault(fault.target(), fault.type(), fault.latencyMs());
    }

    private static boolean validTimeout(int value) {
        return value == 4000 || value == 250 || value == 400 || value == 750;
    }
    private static boolean meaningful(String text) {
        return text != null && text.trim().length() >= 10;
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new ChallengeStateException(message);
    }
}
