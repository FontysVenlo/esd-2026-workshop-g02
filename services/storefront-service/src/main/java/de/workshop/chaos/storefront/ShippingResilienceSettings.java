package de.workshop.chaos.storefront;

public record ShippingResilienceSettings(int timeoutMs, boolean fallbackEnabled, int retries) {

    public static ShippingResilienceSettings defaults() {
        return new ShippingResilienceSettings(1000, false, 0);
    }
}
