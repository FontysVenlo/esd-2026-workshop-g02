package de.workshop.chaos.controller.challenge;

import java.util.List;

public record Challenge3Definition(String id, String title, String scenario,
        String guidanceLevel, Traffic traffic, List<Fault> faults, Controls controls,
        Evaluation evaluation) {
    public record Traffic(String endpoint, int ratePerSecond) {}
    public record Fault(String id, String label, String type, int latencyMs) {}
    public record Controls(List<Integer> timeoutMs, List<Integer> retries,
            boolean fallback, boolean circuitBreaker) {}
    public record Evaluation(int minimumSamplesPerSnapshot, double baselineMinSuccessRate,
            int latencyMinimumIncreaseMs, double unavailableMaximumSuccessRate,
            double validationMinimumSuccessRate, int latencyMinimumP95ImprovementPercent,
            int unavailableMaximumP95Ms, boolean unavailableRequiresFallback) {}
}
