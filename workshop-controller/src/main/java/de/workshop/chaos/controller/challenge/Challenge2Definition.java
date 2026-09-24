package de.workshop.chaos.controller.challenge;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Challenge2Definition(String id, String title, String scenario, String objective,
        String difficulty, int estimatedMinutes, String guidanceLevel, List<String> hints,
        Traffic traffic, Settings defaultResilience, List<FailureControl> failureControls,
        List<MitigationOption> resilienceOptions, Evaluation evaluation) {

    public record Traffic(String endpoint, int ratePerSecond) {
    }

    public record Settings(int shippingTimeoutMs, boolean shippingFallbackEnabled,
            int shippingRetries) {
    }

    public record FailureControl(String id, String type, String target) {
    }

    public record MitigationOption(String id, String label, String description,
            Settings settings) {
    }

    public record Evaluation(TechnicalRules technical, ConceptualRules conceptual) {
    }

    public record TechnicalRules(int minimumSamplesPerSnapshot,
            double baselineMinSuccessRate, double failureMaxSuccessRate,
            double mitigationMinSuccessRate, int mitigationMaxP95Ms,
            boolean mitigationRequiresFallback) {
    }

    public record ConceptualRules(Map<String, ConceptField> fields) {
    }

    public record ConceptField(List<String> requiredConcepts,
            Map<String, List<String>> conceptGroups) {
    }
}
