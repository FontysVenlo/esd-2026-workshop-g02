package de.workshop.chaos.controller.slice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MetricsStoreTest {

    @Test
    void measuresRealRecordedOutcomesAndClearsThem() {
        MetricsStore metrics = new MetricsStore();
        metrics.record(10, true, false, 1);
        metrics.record(30, false, false, 1);

        MetricsStore.MetricsSnapshot snapshot = metrics.snapshot();
        assertThat(snapshot.currentLatencyMs()).isEqualTo(30);
        assertThat(snapshot.averageLatencyMs()).isEqualTo(20);
        assertThat(snapshot.lastRequestSucceeded()).isFalse();
        assertThat(snapshot.successes()).isEqualTo(1);
        assertThat(snapshot.failures()).isEqualTo(1);
        assertThat(snapshot.samples()).hasSize(2);
        assertThat(metrics.summaryForWindow(1).p95LatencyMs()).isEqualTo(30);
        assertThat(metrics.summaryForWindow(1).successRate()).isEqualTo(0.5);

        metrics.reset();
        assertThat(metrics.snapshot().samples()).isEmpty();
        assertThat(metrics.snapshot().currentLatencyMs()).isNull();
    }
}
