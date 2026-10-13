package de.workshop.chaos.controller.slice;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import de.workshop.chaos.controller.challenge.Challenge4Definition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class GameDayTrafficGenerator {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI uri;
    private final GameDayMetricsStore metrics;
    private final WorkshopMetricsRecorder observability;
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicInteger inFlight = new AtomicInteger();
    private final AtomicLong window = new AtomicLong();
    private final AtomicLong generation = new AtomicLong();

    public GameDayTrafficGenerator(@Value("${workshop.storefront-base-url}") String base,
            GameDayMetricsStore metrics, Challenge4Definition definition,
            WorkshopMetricsRecorder observability) {
        uri = URI.create(base + definition.trafficEndpoint());
        this.metrics = metrics;
        this.observability = observability;
    }

    public void start() { running.set(true); }
    public void stop() { running.set(false); }
    public boolean isRunning() { return running.get(); }
    public long beginWindow() { return window.incrementAndGet(); }
    public void resetMetrics() {
        generation.incrementAndGet();
        window.incrementAndGet();
        metrics.reset();
    }

    @Scheduled(fixedRate = 333)
    void sendRequest() {
        if (!running.get() || inFlight.incrementAndGet() > 8) {
            inFlight.decrementAndGet();
            return;
        }
        long requestWindow = window.get();
        long requestGeneration = generation.get();
        long started = System.nanoTime();
        try {
            http.sendAsync(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10))
                    .GET().build(), HttpResponse.BodyHandlers.discarding())
                    .whenComplete((response, error) -> {
                        long elapsed = elapsed(started);
                        boolean success = error == null && response.statusCode() >= 200
                                && response.statusCode() < 300;
                        boolean fallback = success && response.headers()
                                .firstValue("X-Workshop-Fallback")
                                .map("true"::equalsIgnoreCase).orElse(false);
                        if (requestGeneration == generation.get()) {
                            metrics.record(elapsed, success, fallback, requestWindow);
                        }
                        observability.record("challenge-4", elapsed, success, fallback);
                        inFlight.decrementAndGet();
                    });
        } catch (RuntimeException exception) {
            long elapsed = elapsed(started);
            if (requestGeneration == generation.get()) {
                metrics.record(elapsed, false, false, requestWindow);
            }
            observability.record("challenge-4", elapsed, false, false);
            inFlight.decrementAndGet();
        }
    }

    private static long elapsed(long started) {
        return Math.round((System.nanoTime() - started) / 1_000_000.0);
    }
}
