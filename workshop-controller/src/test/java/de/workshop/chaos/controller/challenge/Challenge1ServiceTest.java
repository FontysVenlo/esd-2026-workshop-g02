package de.workshop.chaos.controller.challenge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.workshop.chaos.controller.slice.MetricsStore;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Challenge1ServiceTest {

    private final ToxiproxyClient toxiproxy = mock(ToxiproxyClient.class);
    private final TrafficGenerator traffic = mock(TrafficGenerator.class);
    private final ShippingTrafficGenerator shippingTraffic = mock(ShippingTrafficGenerator.class);
    private final StorefrontSettingsClient storefront = mock(StorefrontSettingsClient.class);
    private final MetricsStore metrics = new MetricsStore();
    private final AtomicBoolean trafficRunning = new AtomicBoolean();
    private final AtomicBoolean faultActive = new AtomicBoolean();
    private final AtomicLong nextWindow = new AtomicLong();
    private Challenge1Definition definition;
    private Challenge1Service challenge;

    @BeforeEach
    void setUp() throws IOException {
        Path config = Path.of("..", "challenges", "challenge-1.json");
        if (!Files.exists(config)) {
            config = Path.of("challenges", "challenge-1.json");
        }
        definition = new ObjectMapper().readValue(config.toFile(), Challenge1Definition.class);
        challenge = new Challenge1Service(definition, toxiproxy, traffic, metrics, storefront,
                shippingTraffic);
        when(traffic.beginWindow()).thenAnswer(ignored -> nextWindow.incrementAndGet());
        when(traffic.isRunning()).thenAnswer(ignored -> trafficRunning.get());
        doAnswer(ignored -> { trafficRunning.set(true); return null; }).when(traffic).start();
        doAnswer(ignored -> { trafficRunning.set(false); return null; }).when(traffic).stop();
        when(toxiproxy.latencyActive()).thenAnswer(ignored -> faultActive.get());
        doAnswer(ignored -> { faultActive.set(true); return null; })
                .when(toxiproxy).injectLatency(definition.latencyMs());
        doAnswer(ignored -> { faultActive.set(false); return null; })
                .when(toxiproxy).removeLatency();
        doAnswer(ignored -> { metrics.reset(); return null; }).when(traffic).resetMetrics();
    }

    @Test
    void gatesBaselineHypothesisAndExperimentInOrder() {
        assertThatThrownBy(challenge::captureBaseline)
                .isInstanceOf(ChallengeStateException.class);
        assertThatThrownBy(challenge::startExperiment)
                .isInstanceOf(ChallengeStateException.class);

        challenge.startTraffic();
        recordRequests(1, 14, 7, false);
        assertThatThrownBy(challenge::captureBaseline)
                .isInstanceOf(ChallengeStateException.class)
                .hasMessageContaining("15 requests");
        recordRequests(1, 1, 7, false);
        challenge.captureBaseline();

        assertThat(challenge.view().step()).isEqualTo(Challenge1Service.Step.HYPOTHESIS);
        assertThat(challenge.view().baseline().requestCount()).isEqualTo(15);
        assertThatThrownBy(challenge::startExperiment)
                .isInstanceOf(ChallengeStateException.class);
        assertThatThrownBy(() -> challenge.saveHypothesis(
                new Challenge1Service.Hypothesis("", "Inventory waits")))
                .isInstanceOf(ChallengeStateException.class);

        challenge.saveHypothesis(new Challenge1Service.Hypothesis(
                "latency will increase", "Storefront waits for Inventory"));
        challenge.startExperiment();
        assertThat(challenge.view().experimentActive()).isTrue();
        assertThat(faultActive.get()).isTrue();
        assertThatThrownBy(challenge::captureExperiment)
                .isInstanceOf(ChallengeStateException.class);
    }

    @Test
    void guidedMitigationRerunsSameFaultAndCompletesOnlyAfterMeasuredImprovement() {
        reachImproveStep();

        challenge.applyMitigation("short-timeout-fallback");
        verify(storefront).apply(new Challenge1Definition.Settings(400, true, 0));
        challenge.startValidation();
        assertThat(challenge.view().validationActive()).isTrue();
        assertThat(faultActive.get()).isTrue();
        assertThat(challenge.view().completed()).isFalse();
        recordRequests(3, 15, 420, true);
        challenge.captureValidation();

        assertThat(challenge.view().step()).isEqualTo(Challenge1Service.Step.COMPLETED);
        assertThat(challenge.view().validation().fallbackCount()).isEqualTo(15);
        assertThat(challenge.view().validation().p95LatencyMs()).isEqualTo(420);
        assertThat(challenge.view().validationFeedback()).isEmpty();
        assertThat(faultActive.get()).isFalse();
        assertThat(trafficRunning.get()).isFalse();

        challenge.reset();
        assertInitialStateAfterReset();
        verify(storefront).apply(definition.defaultResilience());
    }

    @Test
    void resetDuringActiveValidationClearsAllEvidenceAndAllowsFreshBaseline() {
        reachImproveStep();
        challenge.applyMitigation("short-timeout-fallback");
        challenge.startValidation();
        recordRequests(3, 4, 420, true);
        assertThat(trafficRunning.get()).isTrue();
        assertThat(faultActive.get()).isTrue();
        assertThat(challenge.view().currentWindowSamples()).isEqualTo(4);

        challenge.reset();
        assertInitialStateAfterReset();
        verify(storefront).apply(definition.defaultResilience());

        challenge.startTraffic();
        recordRequests(nextWindow.get(), 15, 8, false);
        challenge.captureBaseline();
        assertThat(challenge.view().step()).isEqualTo(Challenge1Service.Step.HYPOTHESIS);
        assertThat(challenge.view().baseline().averageLatencyMs()).isEqualTo(8);
        assertThat(challenge.view().baseline().fallbackCount()).isZero();
    }

    @Test
    void ineffectiveMitigationCanBeReplacedAndValidatedAgain() {
        reachImproveStep();

        challenge.applyMitigation("long-timeout");
        challenge.startValidation();
        recordRequests(3, 15, 1510, false);
        challenge.captureValidation();
        assertThat(challenge.view().completed()).isFalse();
        assertThat(challenge.view().validationFeedback()).isNotEmpty();

        challenge.applyMitigation("short-timeout-fallback");
        challenge.startValidation();
        recordRequests(4, 15, 420, true);
        challenge.captureValidation();
        assertThat(challenge.view().completed()).isTrue();
    }

    private void reachImproveStep() {
        challenge.startTraffic();
        recordRequests(1, 15, 7, false);
        challenge.captureBaseline();
        challenge.saveHypothesis(new Challenge1Service.Hypothesis(
                "response time will rise", "Inventory is a downstream dependency"));
        challenge.startExperiment();
        recordRequests(2, 15, 1510, false);
        challenge.captureExperiment();
        assertThat(faultActive.get()).isFalse();
        challenge.saveObservation(new Challenge1Service.Observation(
                "Latency increased", "P95_LATENCY", "YES",
                "The Inventory delay affected the Storefront request"));
        assertThat(challenge.view().step()).isEqualTo(Challenge1Service.Step.IMPROVE);
    }

    private void recordRequests(long window, int count, long durationMs, boolean fallback) {
        for (int i = 0; i < count; i++) {
            metrics.record(durationMs, true, fallback, window);
        }
    }

    private void assertInitialStateAfterReset() {
        var view = challenge.view();
        var live = metrics.snapshot();
        assertThat(trafficRunning.get()).isFalse();
        assertThat(faultActive.get()).isFalse();
        assertThat(view.step()).isEqualTo(Challenge1Service.Step.MEASURE);
        assertThat(view.currentWindowSamples()).isZero();
        assertThat(view.experimentActive()).isFalse();
        assertThat(view.validationActive()).isFalse();
        assertThat(view.baseline()).isNull();
        assertThat(view.hypothesis()).isNull();
        assertThat(view.experiment()).isNull();
        assertThat(view.observation()).isNull();
        assertThat(view.mitigationId()).isNull();
        assertThat(view.validation()).isNull();
        assertThat(view.validationFeedback()).isEmpty();
        assertThat(view.completed()).isFalse();
        assertThat(live.currentLatencyMs()).isNull();
        assertThat(live.averageLatencyMs()).isNull();
        assertThat(live.lastRequestSucceeded()).isNull();
        assertThat(live.successes()).isZero();
        assertThat(live.failures()).isZero();
        assertThat(live.samples()).isEmpty();
        assertThat(live.events()).isEmpty();
    }
}
