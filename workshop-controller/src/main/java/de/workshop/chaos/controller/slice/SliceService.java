package de.workshop.chaos.controller.slice;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import de.workshop.chaos.controller.challenge.Challenge1Definition;
import de.workshop.chaos.controller.challenge.Challenge1Service;
import de.workshop.chaos.controller.challenge.Challenge2Definition;
import de.workshop.chaos.controller.challenge.Challenge3Service;
import de.workshop.chaos.controller.challenge.ExperimentSettingsClient;
import de.workshop.chaos.controller.challenge.Challenge4Service;
import de.workshop.chaos.controller.challenge.GameDaySettingsClient;
import de.workshop.chaos.controller.challenge.ShippingSettingsClient;
import de.workshop.chaos.controller.challenge.StorefrontSettingsClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class SliceService {

    private static final Logger log = LoggerFactory.getLogger(SliceService.class);

    private final ToxiproxyClient toxiproxy;
    private final TrafficGenerator traffic;
    private final MetricsStore metrics;
    private final Challenge1Service challenge;
    private final StorefrontSettingsClient storefront;
    private final Challenge1Definition definition;
    private final Challenge2Definition shippingDefinition;
    private final ShippingSettingsClient shippingSettings;
    private final ExperimentSettingsClient experimentSettings;
    private final GameDaySettingsClient gameDaySettings;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SliceService(ToxiproxyClient toxiproxy, TrafficGenerator traffic, MetricsStore metrics,
            Challenge1Service challenge, StorefrontSettingsClient storefront,
            Challenge1Definition definition, Challenge2Definition shippingDefinition,
            ShippingSettingsClient shippingSettings, ExperimentSettingsClient experimentSettings,
            GameDaySettingsClient gameDaySettings) {
        this.toxiproxy = toxiproxy;
        this.traffic = traffic;
        this.metrics = metrics;
        this.challenge = challenge;
        this.storefront = storefront;
        this.definition = definition;
        this.shippingDefinition = shippingDefinition;
        this.shippingSettings = shippingSettings;
        this.experimentSettings = experimentSettings;
        this.gameDaySettings = gameDaySettings;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeProxy() throws InterruptedException {
        for (int attempt = 1; attempt <= 30; attempt++) {
            try {
                toxiproxy.initialize();
                storefront.apply(definition.defaultResilience());
                shippingSettings.apply(shippingDefinition.defaultResilience());
                experimentSettings.apply(Challenge3Service.Settings.defaults());
                gameDaySettings.apply(Challenge4Service.Settings.defaults());
                log.info("Inventory and Shipping proxies are ready");
                return;
            } catch (IllegalStateException exception) {
                if (attempt == 30) {
                    throw new IllegalStateException("Inventory proxy could not be initialized", exception);
                }
                Thread.sleep(1000);
            }
        }
    }

    public SliceSnapshot snapshot() {
        try {
            return new SliceSnapshot(traffic.isRunning(), true, toxiproxy.latencyActive(),
                    metrics.snapshot(), challenge.view());
        } catch (IllegalStateException exception) {
            return new SliceSnapshot(traffic.isRunning(), false, null,
                    metrics.snapshot(), challenge.view());
        }
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        send(emitter, snapshot());
        return emitter;
    }

    @Scheduled(fixedRate = 1000)
    public void publishSnapshot() {
        if (emitters.isEmpty()) {
            return;
        }
        SliceSnapshot current = snapshot();
        for (SseEmitter emitter : emitters) {
            send(emitter, current);
        }
    }

    private void send(SseEmitter emitter, SliceSnapshot snapshot) {
        try {
            emitter.send(SseEmitter.event().name("snapshot").data(snapshot));
        } catch (Exception exception) {
            emitters.remove(emitter);
        }
    }

    public record SliceSnapshot(boolean trafficRunning, boolean proxyAvailable,
            Boolean latencyFaultActive, MetricsStore.MetricsSnapshot metrics,
            Challenge1Service.ChallengeView challenge) {
    }
}
