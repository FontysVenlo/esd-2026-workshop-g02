package de.workshop.chaos.controller.slice;

import org.springframework.stereotype.Component;

@Component
public class GameDayMetricsStore {
    private final MetricsStore delegate = new MetricsStore();
    public void record(long durationMs, boolean success, boolean fallback, long window) {
        delegate.record(durationMs, success, fallback, window);
    }
    public void addEvent(String type, String label) { delegate.addEvent(type, label); }
    public void reset() { delegate.reset(); }
    public MetricsStore.MetricsSnapshot snapshot() { return delegate.snapshot(); }
    public MetricsStore.MeasurementSummary summaryForWindow(long window) {
        return delegate.summaryForWindow(window);
    }
}
