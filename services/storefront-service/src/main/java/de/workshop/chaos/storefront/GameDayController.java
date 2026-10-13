package de.workshop.chaos.storefront;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@RestController
public class GameDayController {
    private final String inventoryUrl;
    private final String shippingUrl;
    private final GameDaySettingsService settings;
    private final GameDayDependencyMetrics metrics;

    public GameDayController(
            @Value("${storefront.gameday-inventory-base-url}") String inventoryUrl,
            @Value("${storefront.gameday-shipping-base-url}") String shippingUrl,
            GameDaySettingsService settings, GameDayDependencyMetrics metrics) {
        this.inventoryUrl = inventoryUrl;
        this.shippingUrl = shippingUrl;
        this.settings = settings;
        this.metrics = metrics;
    }

    @GetMapping("/api/gameday/summary")
    public ResponseEntity<?> summary() {
        GameDaySettings active = settings.current();
        Result<ProductController.Availability> stock = call("inventory", inventoryUrl,
                "/api/inventory/demo-product", ProductController.Availability.class,
                active.inventoryTimeoutMs(), active.retries());
        Result<OrderSummaryController.ShippingEstimate> delivery = call("shipping", shippingUrl,
                "/api/shipping/demo-order", OrderSummaryController.ShippingEstimate.class,
                active.shippingTimeoutMs(), active.retries());
        boolean stockFallback = stock.value() == null && active.inventoryFallbackEnabled();
        boolean shippingFallback = delivery.value() == null && active.shippingFallbackEnabled();
        if ((stock.value() == null && !stockFallback)
                || (delivery.value() == null && !shippingFallback)) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(new GameDayError("The summary could not be completed"));
        }
        GameDaySummary body = new GameDaySummary("Workshop Backpack",
                stockFallback ? "Stock information unavailable" :
                        stock.value().available() ? "In stock" : "Out of stock",
                shippingFallback ? "Delivery estimate unavailable" : delivery.value().message(),
                stockFallback, shippingFallback);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok();
        if (stockFallback || shippingFallback) response.header("X-Workshop-Fallback", "true");
        return response.body(body);
    }

    private <T> Result<T> call(String dependency, String base, String path,
            Class<T> type, int timeoutMs, int retries) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));
        RestClient client = RestClient.builder().baseUrl(base).requestFactory(factory).build();
        for (int attempt = 0; attempt <= retries; attempt++) {
            long started = System.nanoTime();
            try {
                T value = client.get().uri(path).retrieve().body(type);
                if (value == null) throw new IllegalStateException("Empty dependency response");
                metrics.record(dependency, elapsed(started), true);
                return new Result<>(value);
            } catch (RestClientException | IllegalStateException exception) {
                metrics.record(dependency, elapsed(started), false);
            }
        }
        return new Result<>(null);
    }

    private static long elapsed(long started) {
        return Math.round((System.nanoTime() - started) / 1_000_000.0);
    }

    @PutMapping("/internal/resilience/gameday")
    public GameDaySettings apply(@RequestBody GameDaySettings next) {
        return settings.apply(next);
    }

    public record GameDaySummary(String item, String stockStatus, String shippingStatus,
            boolean stockFallbackUsed, boolean shippingFallbackUsed) {}
    public record GameDayError(String error) {}
    private record Result<T>(T value) {}
}
