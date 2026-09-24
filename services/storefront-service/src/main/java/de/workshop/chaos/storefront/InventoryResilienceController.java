package de.workshop.chaos.storefront;

import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Internal Docker-network endpoint; it is not proxied by the workshop UI. */
@RestController
@RequestMapping("/internal/resilience/inventory")
public class InventoryResilienceController {

    private final InventoryResilienceService resilience;

    public InventoryResilienceController(InventoryResilienceService resilience) {
        this.resilience = resilience;
    }

    @PutMapping
    public InventoryResilienceSettings apply(@RequestBody InventoryResilienceSettings settings) {
        return resilience.apply(settings);
    }
}

