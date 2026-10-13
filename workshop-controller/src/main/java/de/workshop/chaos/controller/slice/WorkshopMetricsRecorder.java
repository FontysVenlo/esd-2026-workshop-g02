package de.workshop.chaos.controller.slice;

import java.time.Duration;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/** Real completed Storefront request measurements exported to Prometheus. */
@Component
public class WorkshopMetricsRecorder {
    private final MeterRegistry registry;

    public WorkshopMetricsRecorder(MeterRegistry registry) {
        this.registry = registry;
    }

    public void record(String challenge, long durationMs, boolean success, boolean fallback) {
        String outcome = success ? "success" : "error";
        Counter.builder("workshop_requests").description("Completed user-facing requests")
                .tag("challenge", challenge).tag("outcome", outcome)
                .register(registry).increment();
        Timer.builder("workshop_request_duration")
                .description("User-facing response time")
                .tag("challenge", challenge).tag("outcome", outcome)
                .publishPercentileHistogram()
                .minimumExpectedValue(Duration.ofMillis(1))
                .maximumExpectedValue(Duration.ofSeconds(10))
                .register(registry).record(Duration.ofMillis(durationMs));
        if (fallback) {
            Counter.builder("workshop_fallbacks")
                    .description("User-facing responses using a fallback")
                    .tag("challenge", challenge).register(registry).increment();
        }
    }
}
