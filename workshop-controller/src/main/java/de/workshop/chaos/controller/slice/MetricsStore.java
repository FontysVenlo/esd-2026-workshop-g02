package de.workshop.chaos.controller.slice;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Comparator;

import org.springframework.stereotype.Component;

/** A bounded, in-memory view of real completed Storefront requests. */
@Component
public class MetricsStore {

    private static final int WINDOW_SECONDS = 90;
    private static final int MAX_SAMPLES = 500;

    private final Deque<RequestSample> samples = new ArrayDeque<>();
    private final Deque<MetricEvent> events = new ArrayDeque<>();

    public synchronized void record(long durationMs, boolean success,
            boolean fallbackUsed, long windowId) {
        samples.addLast(new RequestSample(Instant.now(), durationMs, success,
                fallbackUsed, windowId));
        prune();
    }

    public synchronized void addEvent(String type, String label) {
        events.addLast(new MetricEvent(Instant.now(), type, label));
        prune();
    }

    public synchronized void reset() {
        samples.clear();
        events.clear();
    }

    public synchronized MetricsSnapshot snapshot() {
        prune();
        List<RequestSample> points = new ArrayList<>(samples);
        long totalLatency = points.stream().mapToLong(RequestSample::durationMs).sum();
        long successes = points.stream().filter(RequestSample::success).count();
        long failures = points.size() - successes;
        RequestSample latest = points.isEmpty() ? null : points.get(points.size() - 1);
        return new MetricsSnapshot(latest == null ? null : latest.durationMs(),
                latest == null ? null : latest.success(),
                points.isEmpty() ? null : Math.round((double) totalLatency / points.size()),
                successes, failures, points, new ArrayList<>(events));
    }

    public synchronized MeasurementSummary summaryForWindow(long windowId) {
        prune();
        List<RequestSample> window = samples.stream()
                .filter(sample -> sample.windowId() == windowId).toList();
        if (window.isEmpty()) {
            return new MeasurementSummary(0, 0, 0, 0, 0);
        }
        List<Long> latencies = window.stream().map(RequestSample::durationMs)
                .sorted(Comparator.naturalOrder()).toList();
        long successes = window.stream().filter(RequestSample::success).count();
        long fallbacks = window.stream().filter(RequestSample::fallbackUsed).count();
        long totalLatency = window.stream().mapToLong(RequestSample::durationMs).sum();
        int p95Index = (int) Math.ceil(window.size() * 0.95) - 1;
        return new MeasurementSummary(Math.round((double) totalLatency / window.size()),
                latencies.get(p95Index), (double) successes / window.size(),
                window.size(), fallbacks);
    }

    private void prune() {
        Instant cutoff = Instant.now().minusSeconds(WINDOW_SECONDS);
        while (!samples.isEmpty() && (samples.peekFirst().timestamp().isBefore(cutoff)
                || samples.size() > MAX_SAMPLES)) {
            samples.removeFirst();
        }
        while (!events.isEmpty() && events.peekFirst().timestamp().isBefore(cutoff)) {
            events.removeFirst();
        }
    }

    public record RequestSample(Instant timestamp, long durationMs, boolean success,
            boolean fallbackUsed, long windowId) {
    }

    public record MetricEvent(Instant timestamp, String type, String label) {
    }

    public record MeasurementSummary(long averageLatencyMs, long p95LatencyMs,
            double successRate, int requestCount, long fallbackCount) {
    }

    public record MetricsSnapshot(Long currentLatencyMs, Boolean lastRequestSucceeded,
            Long averageLatencyMs, long successes, long failures,
            List<RequestSample> samples, List<MetricEvent> events) {
    }
}
