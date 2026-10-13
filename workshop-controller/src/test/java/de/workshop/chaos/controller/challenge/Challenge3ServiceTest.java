package de.workshop.chaos.controller.challenge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.workshop.chaos.controller.slice.ExperimentMetricsStore;
import de.workshop.chaos.controller.slice.ExperimentTrafficGenerator;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Challenge3ServiceTest {
    private final ToxiproxyClient proxy = mock(ToxiproxyClient.class);
    private final ExperimentTrafficGenerator traffic = mock(ExperimentTrafficGenerator.class);
    private final TrafficGenerator challenge1Traffic = mock(TrafficGenerator.class);
    private final ShippingTrafficGenerator challenge2Traffic = mock(ShippingTrafficGenerator.class);
    private final ExperimentSettingsClient storefront = mock(ExperimentSettingsClient.class);
    private final ExperimentMetricsStore metrics = new ExperimentMetricsStore();
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicLong windows = new AtomicLong();
    private final AtomicReference<ToxiproxyClient.ExperimentProxyState> proxyState =
            new AtomicReference<>(new ToxiproxyClient.ExperimentProxyState(true, null, 0));
    private Challenge3Service challenge;

    @BeforeEach
    void setUp() throws IOException {
        Path config = Path.of("..", "challenges", "challenge-3.json");
        if (!Files.exists(config)) config = Path.of("challenges", "challenge-3.json");
        var definition = new ObjectMapper().readValue(config.toFile(), Challenge3Definition.class);
        challenge = new Challenge3Service(definition, proxy, traffic, challenge1Traffic,
                challenge2Traffic, metrics, storefront);
        when(traffic.beginWindow()).thenAnswer(ignored -> windows.incrementAndGet());
        when(traffic.isRunning()).thenAnswer(ignored -> running.get());
        doAnswer(ignored -> { running.set(true); return null; }).when(traffic).start();
        doAnswer(ignored -> { running.set(false); return null; }).when(traffic).stop();
        doAnswer(ignored -> { metrics.reset(); return null; }).when(traffic).resetMetrics();
        when(proxy.experimentState()).thenAnswer(ignored -> proxyState.get());
        doAnswer(invocation -> {
            proxyState.set(new ToxiproxyClient.ExperimentProxyState(true,
                    invocation.getArgument(0), 1));
            return null;
        }).when(proxy).injectExperimentLatency(org.mockito.ArgumentMatchers.anyInt());
        doAnswer(ignored -> {
            proxyState.set(new ToxiproxyClient.ExperimentProxyState(false, null, 0));
            return null;
        }).when(proxy).disconnectExperiment();
        doAnswer(ignored -> {
            proxyState.set(new ToxiproxyClient.ExperimentProxyState(true, null, 0));
            return null;
        }).when(proxy).restoreExperiment();
    }

    @Test
    void experimentPlanRequiresBlastRadiusAndAbortCondition() {
        baseline();
        assertThatThrownBy(() -> challenge.saveExperimentPlan(
                "Stock delay will raise user-facing p95.", "latency-1000", null,
                "Latency above 3000 ms")).isInstanceOf(ChallengeStateException.class);
        assertThatThrownBy(() -> challenge.saveExperimentPlan(
                "Stock delay will raise user-facing p95.", "latency-1000",
                "Entire product page", null)).isInstanceOf(ChallengeStateException.class);
        challenge.saveExperimentPlan("Stock delay will raise user-facing p95.",
                "latency-1000", "Entire product page", "Latency above 3000 ms");
        assertThat(challenge.view().blastRadius()).isEqualTo("Entire product page");
        assertThat(challenge.view().abortCondition()).isEqualTo("Latency above 3000 ms");
        challenge.reset();
        assertThat(challenge.view().blastRadius()).isNull();
        assertThat(challenge.view().abortCondition()).isNull();
    }

    @Test
    void requiresBaselineIndicatorsHypothesisAndSupportedFaultBeforeInjection() {
        assertThatThrownBy(() -> challenge.captureBaseline(List.of("p95Latency")))
                .isInstanceOf(ChallengeStateException.class);
        assertThatThrownBy(challenge::startExperiment)
                .isInstanceOf(ChallengeStateException.class);
        challenge.startTraffic();
        record(1, 12, 10, true, false);
        assertThatThrownBy(() -> challenge.captureBaseline(List.of()))
                .isInstanceOf(ChallengeStateException.class);
        challenge.captureBaseline(List.of("p95Latency"));
        assertThatThrownBy(() -> challenge.saveHypothesis("too short", "latency-1000"))
                .isInstanceOf(ChallengeStateException.class);
        assertThatThrownBy(() -> challenge.saveHypothesis(
                "A stock fault will change response outcomes.", "unknown"))
                .isInstanceOf(ChallengeStateException.class);
        assertThat(challenge.view().selectedFaultId()).isNull();
        assertThatThrownBy(challenge::startExperiment)
                .isInstanceOf(ChallengeStateException.class);
    }

    @Test
    void latencyExperimentRequiresSameFaultAndReflection() {
        baseline();
        challenge.saveHypothesis("P95 latency will rise while stock still succeeds.", "latency-1000");
        challenge.startExperiment();
        record(2, 12, 1010, true, false);
        challenge.captureFailure();
        assertThat(challenge.view().failure().dependencyStatus()).isEqualTo("DELAYED_1000_MS");
        observe();
        var settings = new Challenge3Service.Settings(400, true, 0, false);
        challenge.applySettings(settings, "Use a shorter wait and fallback for stock.");
        challenge.startValidation();
        proxyState.set(new ToxiproxyClient.ExperimentProxyState(true, 500, 1));
        assertThatThrownBy(challenge::captureValidation).isInstanceOf(ChallengeStateException.class)
                .hasMessageContaining("original fault");
        proxyState.set(new ToxiproxyClient.ExperimentProxyState(true, 1000, 1));
        record(3, 12, 405, true, true);
        challenge.captureValidation();
        assertThat(challenge.view().step()).isEqualTo(Challenge3Service.Step.REFLECT);
        assertThat(challenge.view().completed()).isFalse();
        challenge.saveReflection(new Challenge3Service.Reflection(
                "The stock dependency delayed the product page.",
                "The timeout bounded the wait and fallback kept the page usable.",
                "The page now responds quickly even when stock is slow."));
        assertThat(challenge.view().completed()).isTrue();
        assertThat(challenge.view().validation().fallbackCount()).isEqualTo(12);
        verify(storefront).apply(settings);
    }

    @Test
    void unavailableExperimentCanRetryAfterWeakMitigationAndResetFully() {
        baseline();
        challenge.saveHypothesis("Without stock service the product page will fail.", "unavailable");
        challenge.startExperiment();
        record(2, 12, 20, false, false);
        challenge.captureFailure();
        assertThat(challenge.view().failure().successRate()).isZero();
        observe();
        challenge.applySettings(new Challenge3Service.Settings(400, false, 1, false),
                "Retry once to test whether the outage is transient.");
        challenge.startValidation();
        proxyState.set(new ToxiproxyClient.ExperimentProxyState(true, null, 0));
        assertThatThrownBy(challenge::captureValidation).isInstanceOf(ChallengeStateException.class)
                .hasMessageContaining("original fault");
        proxyState.set(new ToxiproxyClient.ExperimentProxyState(false, null, 0));
        record(3, 12, 30, false, false);
        challenge.captureValidation();
        assertThat(challenge.view().step()).isEqualTo(Challenge3Service.Step.IMPROVE);
        assertThat(challenge.view().validationFeedback()).isNotEmpty();
        challenge.applySettings(new Challenge3Service.Settings(400, true, 0, true),
                "Return the page without stock and avoid repeated failures.");
        challenge.startValidation();
        record(4, 12, 25, true, true);
        challenge.captureValidation();
        assertThat(challenge.view().step()).isEqualTo(Challenge3Service.Step.REFLECT);
        challenge.reset();
        var view = challenge.view();
        assertThat(running.get()).isFalse();
        assertThat(proxyState.get().enabled()).isTrue();
        assertThat(proxyState.get().toxicCount()).isZero();
        assertThat(view.step()).isEqualTo(Challenge3Service.Step.MEASURE);
        assertThat(view.steadyStateIndicators()).isEmpty();
        assertThat(view.baseline()).isNull();
        assertThat(view.hypothesis()).isNull();
        assertThat(view.selectedFaultId()).isNull();
        assertThat(view.failure()).isNull();
        assertThat(view.observation()).isNull();
        assertThat(view.validation()).isNull();
        assertThat(view.reflection()).isNull();
        assertThat(view.settings()).isEqualTo(Challenge3Service.Settings.defaults());
        assertThat(metrics.snapshot().samples()).isEmpty();
        assertThat(metrics.snapshot().events()).isEmpty();
        verify(storefront).apply(Challenge3Service.Settings.defaults());
        baseline();
        assertThat(challenge.view().baseline().successRate()).isEqualTo(1.0);
    }

    private void baseline() {
        challenge.startTraffic();
        verify(challenge1Traffic, atLeastOnce()).stop();
        verify(challenge2Traffic, atLeastOnce()).stop();
        record(windows.get(), 12, 10, true, false);
        challenge.captureBaseline(List.of("p95Latency", "successRate"));
    }

    private void observe() {
        challenge.saveObservation(new Challenge3Service.Observation(
                "The product response changed under the fault.",
                "The measured success rate or P95 changed.", "YES",
                "The stock dependency affects the product response."));
    }

    private void record(long window, int count, long duration, boolean success, boolean fallback) {
        for (int i = 0; i < count; i++) metrics.record(duration, success, fallback, window);
    }
}
