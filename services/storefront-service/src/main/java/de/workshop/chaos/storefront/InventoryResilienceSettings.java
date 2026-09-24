package de.workshop.chaos.storefront;

public record InventoryResilienceSettings(int timeoutMs, boolean fallbackEnabled, int retries) {

    public static InventoryResilienceSettings defaults() {
        return new InventoryResilienceSettings(4000, false, 0);
    }
}

