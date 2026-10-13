package de.workshop.chaos.controller.challenge;

import java.util.List;

public record Challenge4Definition(String id, String title, String difficulty,
        String scenario, String objective, String trafficEndpoint,
        List<Fault> scenarios, List<Fault> faults, Evaluation evaluation) {
    public record Fault(String id, String label, String target, String type, int latencyMs) {}
    public record Evaluation(int minimumSamplesPerWindow, double baselineMinimumSuccessRate,
            int incidentMinimumP95IncreaseMs, double incidentMaximumOutageSuccessRate,
            double validationMinimumSuccessRate, int validationMinimumP95ImprovementPercent,
            int validationMaximumOutageP95Ms) {}
}
