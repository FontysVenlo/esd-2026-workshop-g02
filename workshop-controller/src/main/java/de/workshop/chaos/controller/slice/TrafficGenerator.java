package de.workshop.chaos.controller.slice;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Sends about three real Storefront requests per second while traffic is on. */
@Component
public class TrafficGenerator {

    private static final int MAX_IN_FLIGHT = 8;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI productUri;
    private final MetricsStore metrics;
    private final WorkshopMetricsRecorder observability;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicInteger inFlight = new AtomicInteger();
    private final AtomicLong windowId = new AtomicLong();
    private final AtomicLong resetGeneration = new AtomicLong();

    public TrafficGenerator(@Value("${workshop.storefront-base-url}") String storefrontBaseUrl,
            MetricsStore metrics, WorkshopMetricsRecorder observability) {
        this.productUri = URI.create(storefrontBaseUrl + "/api/products/demo-product");
        this.metrics = metrics;
        this.observability = observability;
    }

    public void start() {
        running.set(true);
    }

    public void stop() {
        running.set(false);
    }

    public boolean isRunning() {
        return running.get();
    }

    public void resetMetrics() {
        resetGeneration.incrementAndGet();
        windowId.incrementAndGet();
        metrics.reset();
    }

    public long beginWindow() {
        return windowId.incrementAndGet();
    }

    @Scheduled(fixedRate = 333)
    void sendRequest() {
        if (!running.get() || inFlight.incrementAndGet() > MAX_IN_FLIGHT) {
            inFlight.decrementAndGet();
            return;
        }

        long requestWindow = windowId.get();
        long generation = resetGeneration.get();
        long started = System.nanoTime();
        HttpRequest request = HttpRequest.newBuilder(productUri)
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        try {
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .whenComplete((response, error) -> {
                        long elapsedMs = Math.round((System.nanoTime() - started) / 1_000_000.0);
                        boolean success = error == null && response.statusCode() >= 200
                                && response.statusCode() < 300;
                        boolean fallback = success && response.headers()
                                .firstValue("X-Workshop-Fallback")
                                .map("true"::equalsIgnoreCase).orElse(false);
                        if (generation == resetGeneration.get()) {
                            metrics.record(elapsedMs, success, fallback, requestWindow);
                        }
                        observability.record("challenge-1", elapsedMs, success, fallback);
                        inFlight.decrementAndGet();
                    });
        } catch (RuntimeException exception) {
            if (generation == resetGeneration.get()) {
                metrics.record(Math.round((System.nanoTime() - started) / 1_000_000.0),
                        false, false, requestWindow);
            }
            observability.record("challenge-1",
                    Math.round((System.nanoTime() - started) / 1_000_000.0), false, false);
            inFlight.decrementAndGet();
        }
    }
}
