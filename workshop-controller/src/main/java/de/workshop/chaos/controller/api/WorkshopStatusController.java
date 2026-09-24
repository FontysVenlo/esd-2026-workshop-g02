package de.workshop.chaos.controller.api;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A small connectivity endpoint separate from challenge controls.
 */
@RestController
@RequestMapping("/api/workshop")
public class WorkshopStatusController {

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of(
                "phase", "phase-5",
                "message", "Challenges 1, 2, and 3 are available.",
                "trafficImplemented", true
        );
    }
}
