package de.workshop.chaos.controller.slice;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import de.workshop.chaos.controller.challenge.Challenge3Definition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ExperimentTrafficGenerator {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI uri;
    private final ExperimentMetricsStore metrics;
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicInteger inFlight = new AtomicInteger();
    private final AtomicLong window = new AtomicLong();
    private final AtomicLong generation = new AtomicLong();

    public ExperimentTrafficGenerator(@Value("${workshop.storefront-base-url}") String base,
            ExperimentMetricsStore metrics, Challenge3Definition definition) {
        uri = URI.create(base + definition.traffic().endpoint());
        this.metrics = metrics;
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
                        long elapsed = Math.round((System.nanoTime() - started) / 1_000_000.0);
                        boolean success = error == null && response.statusCode() >= 200
                                && response.statusCode() < 300;
                        boolean fallback = success && response.headers()
                                .firstValue("X-Workshop-Fallback")
                                .map("true"::equalsIgnoreCase).orElse(false);
                        if (requestGeneration == generation.get()) {
                            metrics.record(elapsed, success, fallback, requestWindow);
                        }
                        inFlight.decrementAndGet();
                    });
        } catch (RuntimeException exception) {
            if (requestGeneration == generation.get()) {
                metrics.record(Math.round((System.nanoTime() - started) / 1_000_000.0),
                        false, false, requestWindow);
            }
            inFlight.decrementAndGet();
        }
    }
}
