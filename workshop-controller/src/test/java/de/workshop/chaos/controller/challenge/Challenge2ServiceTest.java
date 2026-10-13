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
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.workshop.chaos.controller.slice.ShippingMetricsStore;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Challenge2ServiceTest {

    private final ToxiproxyClient toxiproxy = mock(ToxiproxyClient.class);
    private final ShippingTrafficGenerator traffic = mock(ShippingTrafficGenerator.class);
    private final TrafficGenerator inventoryTraffic = mock(TrafficGenerator.class);
    private final ShippingSettingsClient storefront = mock(ShippingSettingsClient.class);
    private final ShippingMetricsStore metrics = new ShippingMetricsStore();
    private final AtomicBoolean trafficRunning = new AtomicBoolean();
    private final AtomicBoolean shippingAvailable = new AtomicBoolean(true);
    private final AtomicLong nextWindow = new AtomicLong();
    private Challenge2Definition definition;
    private Challenge2Service challenge;

    @BeforeEach
    void setUp() throws IOException {
        Path config = Path.of("..", "challenges", "challenge-2.json");
        if (!Files.exists(config)) {
            config = Path.of("challenges", "challenge-2.json");
        }
        definition = new ObjectMapper().readValue(config.toFile(), Challenge2Definition.class);
        challenge = new Challenge2Service(definition, toxiproxy, traffic, inventoryTraffic,
                metrics, storefront);
        when(traffic.beginWindow()).thenAnswer(ignored -> nextWindow.incrementAndGet());
        when(traffic.isRunning()).thenAnswer(ignored -> trafficRunning.get());
        doAnswer(ignored -> { trafficRunning.set(true); return null; }).when(traffic).start();
        doAnswer(ignored -> { trafficRunning.set(false); return null; }).when(traffic).stop();
        when(toxiproxy.shippingAvailable()).thenAnswer(ignored -> shippingAvailable.get());
        doAnswer(ignored -> { shippingAvailable.set(false); return null; })
                .when(toxiproxy).disconnectShipping();
        doAnswer(ignored -> { shippingAvailable.set(true); return null; })
                .when(toxiproxy).restoreShipping();
        doAnswer(ignored -> { metrics.reset(); return null; }).when(traffic).resetMetrics();
    }

    @Test
    void capturesChosenHealthMetricAndBlastRadiusConclusion() {
        challenge.startTraffic();
        record(1, 15, 8, true, false);
        assertThatThrownBy(() -> challenge.captureBaseline(List.of()))
                .isInstanceOf(ChallengeStateException.class);
        challenge.captureBaseline(List.of("success", "errors"));
        assertThat(challenge.view().steadyStateMetrics()).containsExactly("success", "errors");
        challenge.saveHypothesis("The order summary will fail without Shipping.");
        challenge.startExperiment();
        record(2, 15, 6, false, false);
        challenge.captureExperiment();
        challenge.saveObservation(new Challenge2Service.Observation(
                "The whole order summary failed during the outage.",
                "Success rate dropped to zero.", true, "YES",
                "Shipping was unreachable and blocked the request.",
                "Entire order summary"));
        challenge.applyMitigation("fallback", "A fallback keeps the summary usable.");
        challenge.startValidation();
        record(3, 15, 5, true, true);
        challenge.captureValidation();
        challenge.saveBlastRadiusConclusion("Yes");
        assertThat(challenge.view().blastRadiusReduced()).isEqualTo("Yes");
        challenge.reset();
        assertThat(challenge.view().steadyStateMetrics()).isEmpty();
        assertThat(challenge.view().blastRadiusReduced()).isNull();
    }

    @Test
    void requiresNormalBaselineAndMeaningfulHypothesisBeforeDisconnect() {
        assertThatThrownBy(challenge::captureBaseline).isInstanceOf(ChallengeStateException.class);
        assertThatThrownBy(challenge::startExperiment).isInstanceOf(ChallengeStateException.class);
        challenge.startTraffic();
        verify(inventoryTraffic).stop();
        record(1, 14, 8, true, false);
        assertThatThrownBy(challenge::captureBaseline).isInstanceOf(ChallengeStateException.class);
        record(1, 1, 8, true, false);
        challenge.captureBaseline();
        assertThat(challenge.view().baseline().shippingAvailable()).isTrue();
        assertThat(challenge.view().baseline().errorRate()).isZero();
        assertThatThrownBy(() -> challenge.saveHypothesis("too short"))
                .isInstanceOf(ChallengeStateException.class);
        challenge.saveHypothesis("The order summary will fail without Shipping.");
        challenge.startExperiment();
        assertThat(shippingAvailable.get()).isFalse();
        assertThat(challenge.view().experimentActive()).isTrue();
        record(2, 15, 6, false, false);
        challenge.captureExperiment();
        assertThat(challenge.view().experiment().successRate()).isZero();
        assertThat(challenge.view().experiment().errorRate()).isEqualTo(1.0);
        assertThat(challenge.view().experiment().shippingAvailable()).isFalse();
        assertThat(shippingAvailable.get()).isFalse();
    }

    @Test
    void sameOutageWithFallbackCompletesAndEvaluatesConceptSynonyms() {
        reachImproveStep();
        challenge.applyMitigation("fallback", "Use fallback so the order summary stays usable.");
        verify(storefront).apply(new Challenge2Definition.Settings(400, true, 0));
        challenge.startValidation();
        assertThat(shippingAvailable.get()).isFalse();
        record(3, 15, 12, true, true);
        challenge.captureValidation();
        assertThat(challenge.view().step()).isEqualTo(Challenge2Service.Step.CONCLUDE);
        challenge.saveBlastRadiusConclusion("Yes");
        assertThat(challenge.view().completed()).isTrue();
        assertThat(challenge.view().validation().fallbackCount()).isEqualTo(15);
        assertThat(challenge.view().validation().shippingAvailable()).isFalse();
        assertThat(challenge.view().validationFeedback()).isEmpty();
        assertThat(challenge.view().conceptFeedback()).isEmpty();
        assertThat(trafficRunning.get()).isFalse();
        assertThat(shippingAvailable.get()).isFalse();

        challenge.reset();
        assertThat(challenge.view().step()).isEqualTo(Challenge2Service.Step.MEASURE);
        assertThat(challenge.view().completed()).isFalse();
        assertThat(challenge.view().validation()).isNull();
        assertThat(shippingAvailable.get()).isTrue();
    }

    @Test
    void cannotValidateByReconnectingShipping() {
        reachImproveStep();
        challenge.applyMitigation("fallback", "Use fallback to continue without an estimate.");
        shippingAvailable.set(true);
        assertThatThrownBy(challenge::startValidation)
                .isInstanceOf(ChallengeStateException.class)
                .hasMessageContaining("stay disconnected");
        shippingAvailable.set(false);
        challenge.startValidation();
        record(3, 15, 12, true, true);
        shippingAvailable.set(true);
        assertThatThrownBy(challenge::captureValidation)
                .isInstanceOf(ChallengeStateException.class)
                .hasMessageContaining("reconnected");
        assertThat(challenge.view().completed()).isFalse();
    }

    @Test
    void ineffectiveRetryCanBeReplacedWithFallback() {
        reachImproveStep();
        challenge.applyMitigation("retry-only", "Try one more time before reporting failure.");
        challenge.startValidation();
        record(3, 15, 15, false, false);
        challenge.captureValidation();
        assertThat(challenge.view().completed()).isFalse();
        assertThat(challenge.view().validationFeedback()).isNotEmpty();

        challenge.applyMitigation("fallback", "Use fallback and continue without an estimate.");
        challenge.startValidation();
        record(4, 15, 12, true, true);
        challenge.captureValidation();
        challenge.saveBlastRadiusConclusion("Yes");
        assertThat(challenge.view().completed()).isTrue();
    }

    @Test
    void resetDuringOutageRestoresEverythingAndAllowsFreshBaseline() {
        reachImproveStep();
        challenge.applyMitigation("fallback", "Use fallback and continue without an estimate.");
        challenge.startValidation();
        record(3, 4, 12, true, true);
        assertThat(shippingAvailable.get()).isFalse();
        assertThat(challenge.view().currentWindowSamples()).isEqualTo(4);

        challenge.reset();
        var view = challenge.view();
        var live = metrics.snapshot();
        assertThat(trafficRunning.get()).isFalse();
        assertThat(shippingAvailable.get()).isTrue();
        assertThat(view.step()).isEqualTo(Challenge2Service.Step.MEASURE);
        assertThat(view.currentWindowSamples()).isZero();
        assertThat(view.experimentActive()).isFalse();
        assertThat(view.validationActive()).isFalse();
        assertThat(view.baseline()).isNull();
        assertThat(view.hypothesis()).isNull();
        assertThat(view.experiment()).isNull();
        assertThat(view.observation()).isNull();
        assertThat(view.mitigationId()).isNull();
        assertThat(view.mitigationReason()).isNull();
        assertThat(view.validation()).isNull();
        assertThat(view.validationFeedback()).isEmpty();
        assertThat(view.conceptFeedback()).isEmpty();
        assertThat(view.completed()).isFalse();
        assertThat(live.samples()).isEmpty();
        assertThat(live.events()).isEmpty();
        assertThat(live.averageLatencyMs()).isNull();
        verify(storefront).apply(definition.defaultResilience());

        challenge.startTraffic();
        record(nextWindow.get(), 15, 8, true, false);
        challenge.captureBaseline();
        assertThat(challenge.view().baseline().shippingAvailable()).isTrue();
        assertThat(challenge.view().baseline().fallbackCount()).isZero();
    }

    private void reachImproveStep() {
        challenge.startTraffic();
        record(1, 15, 8, true, false);
        challenge.captureBaseline();
        challenge.saveHypothesis("The order summary will fail without Shipping.");
        challenge.startExperiment();
        record(2, 15, 6, false, false);
        challenge.captureExperiment();
        challenge.saveObservation(new Challenge2Service.Observation(
                "Shipping was offline and the order summary failed.",
                "The success rate dropped and errors increased.", true, "YES",
                "The Shipping dependency was unreachable."));
        assertThat(challenge.view().step()).isEqualTo(Challenge2Service.Step.IMPROVE);
    }

    private void record(long window, int count, long latency, boolean success,
            boolean fallback) {
        for (int i = 0; i < count; i++) {
            metrics.record(latency, success, fallback, window);
        }
    }
}
