package de.workshop.chaos.storefront;

import java.time.Duration;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

@Component
public class GameDayDependencyMetrics {
    private final MeterRegistry registry;

    public GameDayDependencyMetrics(MeterRegistry registry) { this.registry = registry; }

    public void record(String dependency, long elapsedMs, boolean success) {
        String outcome = success ? "success" : "error";
        Counter.builder("workshop_dependency_calls")
                .description("GameDay downstream call attempts")
                .tag("dependency", dependency).tag("outcome", outcome)
                .register(registry).increment();
        Timer.builder("workshop_dependency_call_duration")
                .description("GameDay downstream call response time")
                .tag("dependency", dependency).tag("outcome", outcome)
                .publishPercentileHistogram()
                .minimumExpectedValue(Duration.ofMillis(1))
                .maximumExpectedValue(Duration.ofSeconds(10))
                .register(registry).record(Duration.ofMillis(elapsedMs));
    }
}
