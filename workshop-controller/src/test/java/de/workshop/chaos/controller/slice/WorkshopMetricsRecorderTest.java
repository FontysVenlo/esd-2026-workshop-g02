package de.workshop.chaos.controller.slice;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class WorkshopMetricsRecorderTest {
    @Test
    void recordsRealOutcomeDurationAndFallbackByChallenge() {
        var registry = new SimpleMeterRegistry();
        var recorder = new WorkshopMetricsRecorder(registry);
        recorder.record("challenge-4", 405, true, true);
        recorder.record("challenge-4", 1008, false, false);

        assertThat(registry.get("workshop_requests").tags("challenge", "challenge-4",
                "outcome", "success").counter().count()).isEqualTo(1);
        assertThat(registry.get("workshop_requests").tags("challenge", "challenge-4",
                "outcome", "error").counter().count()).isEqualTo(1);
        assertThat(registry.get("workshop_request_duration").tags("challenge", "challenge-4",
                "outcome", "success").timer().totalTime(java.util.concurrent.TimeUnit.MILLISECONDS))
                .isEqualTo(405);
        assertThat(registry.get("workshop_fallbacks").tag("challenge", "challenge-4")
                .counter().count()).isEqualTo(1);
    }
}
