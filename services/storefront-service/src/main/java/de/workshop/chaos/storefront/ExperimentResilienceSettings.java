package de.workshop.chaos.storefront;

public record ExperimentResilienceSettings(int timeoutMs, boolean fallbackEnabled,
        int retries, boolean circuitBreakerEnabled) {
    public static ExperimentResilienceSettings defaults() {
        return new ExperimentResilienceSettings(4000, false, 0, false);
    }
}
