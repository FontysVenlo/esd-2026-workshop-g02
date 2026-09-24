package de.workshop.chaos.storefront;

import java.util.concurrent.atomic.AtomicReference;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventoryResilienceService {

    private final AtomicReference<InventoryResilienceSettings> settings =
            new AtomicReference<>(InventoryResilienceSettings.defaults());

    public InventoryResilienceSettings current() {
        return settings.get();
    }

    public InventoryResilienceSettings apply(InventoryResilienceSettings next) {
        if (next == null || next.timeoutMs() < 100 || next.timeoutMs() > 10000
                || next.retries() < 0 || next.retries() > 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Inventory timeout must be 100–10000 ms and retries 0–2");
        }
        settings.set(next);
        return next;
    }
}

