package de.workshop.chaos.controller.slice;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import de.workshop.chaos.controller.challenge.Challenge2Definition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Sends real order-summary requests without sharing Challenge 1 measurements. */
@Component
public class ShippingTrafficGenerator {

    private static final int MAX_IN_FLIGHT = 8;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI orderUri;
    private final ShippingMetricsStore metrics;
    private final WorkshopMetricsRecorder observability;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicInteger inFlight = new AtomicInteger();
    private final AtomicLong windowId = new AtomicLong();
    private final AtomicLong resetGeneration = new AtomicLong();

    public ShippingTrafficGenerator(
            @Value("${workshop.storefront-base-url}") String storefrontBaseUrl,
            ShippingMetricsStore metrics, Challenge2Definition definition,
            WorkshopMetricsRecorder observability) {
        this.orderUri = URI.create(storefrontBaseUrl + definition.traffic().endpoint());
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
        HttpRequest request = HttpRequest.newBuilder(orderUri)
                .timeout(Duration.ofSeconds(5)).GET().build();
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
                        observability.record("challenge-2", elapsedMs, success, fallback);
                        inFlight.decrementAndGet();
                    });
        } catch (RuntimeException exception) {
            if (generation == resetGeneration.get()) {
                metrics.record(Math.round((System.nanoTime() - started) / 1_000_000.0),
                        false, false, requestWindow);
            }
            observability.record("challenge-2",
                    Math.round((System.nanoTime() - started) / 1_000_000.0), false, false);
            inFlight.decrementAndGet();
        }
    }
}
