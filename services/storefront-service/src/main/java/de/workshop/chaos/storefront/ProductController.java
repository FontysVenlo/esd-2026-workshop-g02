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

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final String inventoryBaseUrl;
    private final InventoryResilienceService resilience;

    public ProductController(@Value("${storefront.inventory-base-url}") String inventoryBaseUrl,
            InventoryResilienceService resilience) {
        this.inventoryBaseUrl = inventoryBaseUrl;
        this.resilience = resilience;
    }

    @GetMapping("/{productId}")
    public ResponseEntity<?> product(@PathVariable String productId) {
        InventoryResilienceSettings settings = resilience.current();
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(Math.min(settings.timeoutMs(), 2000)));
        requestFactory.setReadTimeout(Duration.ofMillis(settings.timeoutMs()));
        RestClient inventoryClient = RestClient.builder().baseUrl(inventoryBaseUrl)
                .requestFactory(requestFactory).build();

        for (int attempt = 0; attempt <= settings.retries(); attempt++) {
            try {
                Availability availability = inventoryClient.get()
                        .uri("/api/inventory/{productId}", productId)
                        .retrieve()
                        .body(Availability.class);
                if (availability == null) {
                    throw new IllegalStateException("Inventory returned no availability data");
                }
                return ResponseEntity.ok(new Product(productId, "Workshop Backpack",
                        availability.available() ? "In stock" : "Out of stock",
                        availability.quantity(), false));
            } catch (RestClientException | IllegalStateException exception) {
                if (attempt == settings.retries()) {
                    if (settings.fallbackEnabled()) {
                        return ResponseEntity.ok()
                                .header("X-Workshop-Fallback", "true")
                                .body(new Product(productId, "Workshop Backpack",
                                        "Stock information currently unavailable.", null, true));
                    }
                    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                            .body(new InventoryError("Inventory could not be reached"));
                }
            }
        }
        throw new IllegalStateException("Inventory retry loop ended unexpectedly");
    }

    public record Availability(String productId, boolean available, int quantity) {
    }

    public record Product(String productId, String name, String stockStatus,
            Integer quantity, boolean stockFallbackUsed) {
    }

    public record InventoryError(String error) {
    }
}
