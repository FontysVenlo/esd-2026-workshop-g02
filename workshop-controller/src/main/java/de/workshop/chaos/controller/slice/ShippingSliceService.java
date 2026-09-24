package de.workshop.chaos.controller.slice;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import de.workshop.chaos.controller.challenge.Challenge2Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class ShippingSliceService {

    private final ToxiproxyClient toxiproxy;
    private final ShippingTrafficGenerator traffic;
    private final ShippingMetricsStore metrics;
    private final Challenge2Service challenge;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public ShippingSliceService(ToxiproxyClient toxiproxy, ShippingTrafficGenerator traffic,
            ShippingMetricsStore metrics, Challenge2Service challenge) {
        this.toxiproxy = toxiproxy;
        this.traffic = traffic;
        this.metrics = metrics;
        this.challenge = challenge;
    }

    public ShippingSnapshot snapshot() {
        try {
            return new ShippingSnapshot(traffic.isRunning(), toxiproxy.shippingAvailable(),
                    metrics.snapshot(), challenge.view());
        } catch (IllegalStateException exception) {
            return new ShippingSnapshot(traffic.isRunning(), null,
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
        ShippingSnapshot current = snapshot();
        for (SseEmitter emitter : emitters) {
            send(emitter, current);
        }
    }

    private void send(SseEmitter emitter, ShippingSnapshot snapshot) {
        try {
            emitter.send(SseEmitter.event().name("snapshot").data(snapshot));
        } catch (Exception exception) {
            emitters.remove(emitter);
        }
    }

    public record ShippingSnapshot(boolean trafficRunning, Boolean shippingAvailable,
            MetricsStore.MetricsSnapshot metrics, Challenge2Service.ChallengeView challenge) {
    }
}
