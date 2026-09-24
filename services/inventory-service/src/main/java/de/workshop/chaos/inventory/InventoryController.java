package de.workshop.chaos.inventory;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    @GetMapping("/{productId}")
    public Availability availability(@PathVariable String productId) {
        return new Availability(productId, true, 12);
    }

    public record Availability(String productId, boolean available, int quantity) {
    }
}

