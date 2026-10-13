package de.workshop.chaos.controller.challenge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
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
import java.util.concurrent.atomic.AtomicReference;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.workshop.chaos.controller.slice.ExperimentTrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayMetricsStore;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Challenge4ServiceTest {
    private final ToxiproxyClient proxy = mock(ToxiproxyClient.class);
    private final GameDayTrafficGenerator traffic = mock(GameDayTrafficGenerator.class);
    private final TrafficGenerator firstTraffic = mock(TrafficGenerator.class);
    private final ShippingTrafficGenerator secondTraffic = mock(ShippingTrafficGenerator.class);
    private final ExperimentTrafficGenerator thirdTraffic = mock(ExperimentTrafficGenerator.class);
    private final GameDaySettingsClient storefront = mock(GameDaySettingsClient.class);
    private final GameDayMetricsStore metrics = new GameDayMetricsStore();
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicLong windows = new AtomicLong();
    private final AtomicReference<ToxiproxyClient.GameDayState> proxyState = new AtomicReference<>();
    private Challenge4Definition definition;

    @BeforeEach
    void setUp() throws IOException {
        Path file = Path.of("..", "challenges", "challenge-4.json");
        if (!Files.exists(file)) file = Path.of("challenges", "challenge-4.json");
        definition = new ObjectMapper().readValue(file.toFile(), Challenge4Definition.class);
        proxyState.set(normal());
        when(traffic.beginWindow()).thenAnswer(ignored -> windows.incrementAndGet());
        when(traffic.isRunning()).thenAnswer(ignored -> running.get());
        doAnswer(ignored -> { running.set(true); return null; }).when(traffic).start();
        doAnswer(ignored -> { running.set(false); return null; }).when(traffic).stop();
        doAnswer(ignored -> { metrics.reset(); return null; }).when(traffic).resetMetrics();
        when(proxy.gameDayState()).thenAnswer(ignored -> proxyState.get());
        doAnswer(invocation -> {
            String target = invocation.getArgument(0);
            String type = invocation.getArgument(1);
            int latency = invocation.getArgument(2);
            var faulty = new ToxiproxyClient.GameDayProxyState(!"UNAVAILABLE".equals(type),
                    "UNAVAILABLE".equals(type) ? null : type.toLowerCase(),
                    latency, "UNAVAILABLE".equals(type) ? 0 : 1);
            proxyState.set("inventory".equals(target)
                    ? new ToxiproxyClient.GameDayState(faulty, normalProxy())
                    : new ToxiproxyClient.GameDayState(normalProxy(), faulty));
            return null;
        }).when(proxy).injectGameDayFault(anyString(), anyString(), anyInt());
        doAnswer(ignored -> { proxyState.set(normal()); return null; })
                .when(proxy).restoreGameDay();
    }

    @Test
    void inventoryScenarioRequiresMonitoringPlanAndSameFaultValidation() {
        var challenge = create("inventory-latency");
        challenge.startTraffic();
        record(1, 12, 25, true, false);
        assertThatThrownBy(() -> challenge.captureBaseline(List.of("latency"),
                "Healthy responses are fast."))
                .isInstanceOf(ChallengeStateException.class).hasMessageContaining("monitoring");
        challenge.markGrafanaOpened();
        challenge.captureBaseline(List.of("latency", "dependencyCalls"),
                "Healthy responses are fast.");
        challenge.beginIncident();
        assertThat(challenge.view().incidentActive()).isTrue();
        assertThat(challenge.view().scenario()).doesNotContain("inventory-latency");
        record(2, 12, 1025, true, false);
        challenge.captureIncident();
        var wrong = new Challenge4Service.Plan("shipping", "Inventory calls slowed in Grafana.",
                "I expect dependency latency to rise.", "shipping-unavailable",
                "Entire page or summary", "LATENCY_3000");
        assertThatThrownBy(() -> challenge.savePlan(wrong))
                .isInstanceOf(ChallengeStateException.class).hasMessageContaining("diagnosis");
        var plan = new Challenge4Service.Plan("inventory", "Inventory calls slowed in Grafana.",
                "I expect dependency latency to rise.", "inventory-latency-1000",
                "Entire page or summary", "LATENCY_3000");
        challenge.savePlan(plan);
        challenge.startExperiment();
        record(3, 12, 1020, true, false);
        challenge.captureExperiment();
        challenge.saveAnalysis(new Challenge4Service.Analysis("Responses became slower.",
                "Inventory p95 call duration.", "Entire page or summary",
                "The page waits for stock."));
        var settings = new Challenge4Service.Settings(400, true, 4000, false, 0);
        challenge.applyMitigation(settings, "Bound the stock wait with fallback.",
                "P95 should fall and success stay high.");
        challenge.startValidation();
        proxyState.set(normal());
        assertThatThrownBy(challenge::captureValidation)
                .isInstanceOf(ChallengeStateException.class).hasMessageContaining("fault changed");
        proxyState.set(new ToxiproxyClient.GameDayState(
                new ToxiproxyClient.GameDayProxyState(true, "latency", 1000, 1),
                normalProxy()));
        record(4, 12, 405, true, true);
        challenge.captureValidation();
        assertThat(challenge.view().step()).isEqualTo(Challenge4Service.Step.CONCLUDE);
        challenge.saveConclusion("P95 dropped under the identical fault, with fallback responses.");
        assertThat(challenge.view().completed()).isTrue();
        verify(storefront).apply(settings);
        challenge.reset();
        assertThat(challenge.view().step()).isEqualTo(Challenge4Service.Step.INVESTIGATE);
        assertThat(challenge.view().baseline()).isNull();
        assertThat(challenge.view().plan()).isNull();
        assertThat(challenge.view().grafanaOpened()).isFalse();
        assertThat(proxyState.get()).isEqualTo(normal());
        verify(storefront).apply(Challenge4Service.Settings.defaults());
    }

    @Test
    void shippingScenarioIsDeterministicAndRequiresFallback() {
        var challenge = create("shipping-unavailable");
        challenge.startTraffic();
        challenge.markGrafanaOpened();
        record(1, 12, 20, true, false);
        challenge.captureBaseline(List.of("errorRate"), "Normal requests all succeed.");
        challenge.beginIncident();
        assertThat(proxyState.get().shipping().enabled()).isFalse();
        record(2, 12, 20, false, false);
        challenge.captureIncident();
        challenge.savePlan(new Challenge4Service.Plan("shipping",
                "Shipping failures rose in Grafana.",
                "The whole summary may fail during outage.", "shipping-unavailable",
                "Entire page or summary", "ERROR_RATE_50"));
        challenge.startExperiment();
        record(3, 12, 20, false, false);
        challenge.captureExperiment();
        challenge.saveAnalysis(new Challenge4Service.Analysis("All summaries failed.",
                "Request error rate rose.", "Entire page or summary",
                "Shipping is a blocking dependency."));
        challenge.applyMitigation(new Challenge4Service.Settings(4000, false, 250, true, 0),
                "Allow summary without estimate.", "Success and fallback should rise.");
        challenge.startValidation();
        record(4, 12, 100, true, true);
        challenge.captureValidation();
        assertThat(challenge.view().step()).isEqualTo(Challenge4Service.Step.CONCLUDE);
    }

    private Challenge4Service create(String scenario) {
        return new Challenge4Service(definition, scenario, proxy, traffic, firstTraffic,
                secondTraffic, thirdTraffic, metrics, storefront);
    }

    private void record(long window, int count, long duration, boolean success,
            boolean fallback) {
        for (int i = 0; i < count; i++) metrics.record(duration, success, fallback, window);
    }

    private static ToxiproxyClient.GameDayProxyState normalProxy() {
        return new ToxiproxyClient.GameDayProxyState(true, null, 0, 0);
    }

    private static ToxiproxyClient.GameDayState normal() {
        return new ToxiproxyClient.GameDayState(normalProxy(), normalProxy());
    }
}
