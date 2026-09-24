package de.workshop.chaos.storefront;

import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/resilience/shipping")
public class ShippingResilienceController {

    private final ShippingResilienceService resilience;

    public ShippingResilienceController(ShippingResilienceService resilience) {
        this.resilience = resilience;
    }

    @PutMapping
    public ShippingResilienceSettings apply(@RequestBody ShippingResilienceSettings settings) {
        return resilience.apply(settings);
    }
}
