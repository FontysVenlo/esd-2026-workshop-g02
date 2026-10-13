package de.workshop.chaos.controller.slice;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import de.workshop.chaos.controller.challenge.Challenge4Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class GameDaySliceService {
    private final GameDayTrafficGenerator traffic;
    private final GameDayMetricsStore metrics;
    private final Challenge4Service challenge;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public GameDaySliceService(GameDayTrafficGenerator traffic, GameDayMetricsStore metrics,
            Challenge4Service challenge) {
        this.traffic = traffic;
        this.metrics = metrics;
        this.challenge = challenge;
    }

    public Snapshot snapshot() {
        return new Snapshot(traffic.isRunning(), metrics.snapshot(), challenge.view());
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
        if (emitters.isEmpty()) return;
        Snapshot current = snapshot();
        for (SseEmitter emitter : emitters) send(emitter, current);
    }

    private void send(SseEmitter emitter, Snapshot snapshot) {
        try {
            emitter.send(SseEmitter.event().name("snapshot").data(snapshot));
        } catch (Exception exception) {
            emitters.remove(emitter);
        }
    }

    public record Snapshot(boolean trafficRunning,
            MetricsStore.MetricsSnapshot metrics, Challenge4Service.View challenge) {}
}
