package de.workshop.chaos.controller.slice;

import org.springframework.stereotype.Component;

/** Independent live and captured measurements for Challenge 2. */
@Component
public class ShippingMetricsStore {

    private final MetricsStore delegate = new MetricsStore();

    public void record(long durationMs, boolean success, boolean fallbackUsed, long windowId) {
        delegate.record(durationMs, success, fallbackUsed, windowId);
    }

    public void addEvent(String type, String label) {
        delegate.addEvent(type, label);
    }

    public void reset() {
        delegate.reset();
    }

    public MetricsStore.MetricsSnapshot snapshot() {
        return delegate.snapshot();
    }

    public MetricsStore.MeasurementSummary summaryForWindow(long windowId) {
        return delegate.summaryForWindow(windowId);
    }
}
