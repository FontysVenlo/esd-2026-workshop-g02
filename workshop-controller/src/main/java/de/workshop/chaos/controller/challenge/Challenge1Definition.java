package de.workshop.chaos.controller.challenge;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Challenge1Definition(String id, String title, String scenario,
        List<Instruction> instructions, List<String> hints,
        List<FailureControl> failureControls,
        Settings defaultResilience,
        List<MitigationOption> resilienceOptions,
        Evaluation evaluation) {

    public int latencyMs() {
        return failureControls.stream()
                .filter(control -> "inventory-latency-1500".equals(control.id()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Challenge 1 latency control is missing"))
                .parameters().latencyMs();
    }

    public record Instruction(String step, String title, String body) {
    }

    public record FailureControl(String id, String type, String target, Parameters parameters) {
    }

    public record Parameters(int latencyMs, int jitterMs) {
    }

    public record Settings(int inventoryTimeoutMs, boolean inventoryFallbackEnabled,
            int inventoryRetries) {
    }

    public record MitigationOption(String id, String label, String description,
            Settings settings) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Evaluation(TechnicalRules technical) {
    }

    public record TechnicalRules(int minimumSamplesPerSnapshot,
            int failureMustIncreaseP95ByMs,
            int minimumP95ImprovementPercent,
            double mitigationMinSuccessRate,
            int mitigationMaxP95Ms,
            boolean mitigationRequiresFallback) {
    }
}

