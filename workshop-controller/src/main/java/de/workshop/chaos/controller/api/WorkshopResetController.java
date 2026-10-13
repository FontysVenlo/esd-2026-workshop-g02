package de.workshop.chaos.controller.api;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workshop")
public class WorkshopResetController {
    private final WorkshopResetService reset;

    public WorkshopResetController(WorkshopResetService reset) { this.reset = reset; }

    @PostMapping("/reset")
    public Map<String, String> reset() {
        reset.reset();
        return Map.of("message", "The entire workshop is back at its starting state.");
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> failure(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", exception.getMessage()));
    }
}
