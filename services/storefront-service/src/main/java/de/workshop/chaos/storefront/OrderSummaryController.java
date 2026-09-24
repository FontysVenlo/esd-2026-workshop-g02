package de.workshop.chaos.storefront;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** The user-facing request remains independent of Inventory in Challenge 2. */
@RestController
@RequestMapping("/api/order-summary")
public class OrderSummaryController {

    private final String shippingBaseUrl;
    private final ShippingResilienceService resilience;

    public OrderSummaryController(@Value("${storefront.shipping-base-url}") String shippingBaseUrl,
            ShippingResilienceService resilience) {
        this.shippingBaseUrl = shippingBaseUrl;
        this.resilience = resilience;
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<?> summary(@PathVariable String orderId) {
        ShippingResilienceSettings settings = resilience.current();
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(Math.min(settings.timeoutMs(), 2000)));
        requestFactory.setReadTimeout(Duration.ofMillis(settings.timeoutMs()));
        RestClient shippingClient = RestClient.builder().baseUrl(shippingBaseUrl)
                .requestFactory(requestFactory).build();

        for (int attempt = 0; attempt <= settings.retries(); attempt++) {
            try {
                ShippingEstimate estimate = shippingClient.get()
                        .uri("/api/shipping/{orderId}", orderId)
                        .retrieve().body(ShippingEstimate.class);
                if (estimate == null) {
                    throw new IllegalStateException("Shipping returned no estimate");
                }
                return ResponseEntity.ok(new OrderSummary(orderId, "Workshop Backpack", 49.00,
                        estimate.message(), estimate.estimatedDays(), false));
            } catch (RestClientException | IllegalStateException exception) {
                if (attempt == settings.retries()) {
                    if (settings.fallbackEnabled()) {
                        return ResponseEntity.ok().header("X-Workshop-Fallback", "true")
                                .body(new OrderSummary(orderId, "Workshop Backpack", 49.00,
                                        "Shipping estimate currently unavailable.", null, true));
                    }
                    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                            .body(new ShippingError("Shipping estimate could not be reached"));
                }
            }
        }
        throw new IllegalStateException("Shipping retry loop ended unexpectedly");
    }

    public record ShippingEstimate(String orderId, int estimatedDays, String message) {
    }

    public record OrderSummary(String orderId, String item, double total,
            String shippingStatus, Integer estimatedDays, boolean shippingFallbackUsed) {
    }

    public record ShippingError(String error) {
    }
}
