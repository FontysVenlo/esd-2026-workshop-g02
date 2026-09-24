package de.workshop.chaos.shipping;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A deterministic dependency for the order-summary experiment. */
@RestController
@RequestMapping("/api/shipping")
public class ShippingController {

    @GetMapping("/{orderId}")
    public ShippingEstimate estimate(@PathVariable String orderId) {
        return new ShippingEstimate(orderId, 3, "Estimated delivery in 3 days");
    }

    public record ShippingEstimate(String orderId, int estimatedDays, String message) {
    }
}
