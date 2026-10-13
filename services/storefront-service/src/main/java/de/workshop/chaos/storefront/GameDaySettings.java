package de.workshop.chaos.storefront;

public record GameDaySettings(int inventoryTimeoutMs, boolean inventoryFallbackEnabled,
        int shippingTimeoutMs, boolean shippingFallbackEnabled, int retries) {
    public static GameDaySettings defaults() {
        return new GameDaySettings(4000, false, 4000, false, 0);
    }
}
