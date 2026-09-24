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
public class ExperimentController {
    private final String inventoryBaseUrl;
    private final ExperimentResilienceService resilience;

    public ExperimentController(
            @Value("${storefront.experiment-inventory-base-url}") String inventoryBaseUrl,
            ExperimentResilienceService resilience) {
        this.inventoryBaseUrl = inventoryBaseUrl;
        this.resilience = resilience;
    }

    @GetMapping("/api/experiment/demo-product")
    public ResponseEntity<?> product() {
        ExperimentResilienceSettings settings = resilience.current();
        if (resilience.circuitOpen()) {
            return unavailable(settings, true);
        }
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(settings.timeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(settings.timeoutMs()));
        RestClient inventory = RestClient.builder().baseUrl(inventoryBaseUrl)
                .requestFactory(factory).build();
        for (int attempt = 0; attempt <= settings.retries(); attempt++) {
            try {
                ProductController.Availability availability = inventory.get()
                        .uri("/api/inventory/demo-product").retrieve()
                        .body(ProductController.Availability.class);
                if (availability == null) {
                    throw new IllegalStateException("No availability returned");
                }
                resilience.succeeded();
                return ResponseEntity.ok(new ProductController.Product("demo-product",
                        "Workshop Backpack", availability.available() ? "In stock" : "Out of stock",
                        availability.quantity(), false));
            } catch (RestClientException | IllegalStateException exception) {
                resilience.failed();
            }
        }
        return unavailable(settings, false);
    }

    private ResponseEntity<?> unavailable(ExperimentResilienceSettings settings, boolean circuitOpen) {
        if (settings.fallbackEnabled()) {
            return ResponseEntity.ok().header("X-Workshop-Fallback", "true")
                    .header("X-Workshop-Circuit-Open", Boolean.toString(circuitOpen))
                    .body(new ProductController.Product("demo-product", "Workshop Backpack",
                            "Stock information currently unavailable.", null, true));
        }
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ProductController.InventoryError("Inventory could not be reached"));
    }

    @PutMapping("/internal/resilience/experiment")
    public ExperimentResilienceSettings settings(@RequestBody ExperimentResilienceSettings next) {
        return resilience.apply(next);
    }
}
