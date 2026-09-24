package de.workshop.chaos.controller.slice;

import org.springframework.stereotype.Component;

@Component
public class ExperimentMetricsStore {
    private final MetricsStore delegate = new MetricsStore();

    public void record(long durationMs, boolean success, boolean fallback, long windowId) {
        delegate.record(durationMs, success, fallback, windowId);
    }
    public void addEvent(String type, String label) { delegate.addEvent(type, label); }
    public void reset() { delegate.reset(); }
    public MetricsStore.MetricsSnapshot snapshot() { return delegate.snapshot(); }
    public MetricsStore.MeasurementSummary summaryForWindow(long id) {
        return delegate.summaryForWindow(id);
    }
}
