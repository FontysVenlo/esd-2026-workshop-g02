package de.workshop.chaos.storefront;

import java.util.concurrent.atomic.AtomicReference;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ShippingResilienceService {

    private final AtomicReference<ShippingResilienceSettings> settings =
            new AtomicReference<>(ShippingResilienceSettings.defaults());

    public ShippingResilienceSettings current() {
        return settings.get();
    }

    public ShippingResilienceSettings apply(ShippingResilienceSettings next) {
        if (next == null || next.timeoutMs() < 100 || next.timeoutMs() > 10000
                || next.retries() < 0 || next.retries() > 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Shipping timeout must be 100–10000 ms and retries 0–2");
        }
        settings.set(next);
        return next;
    }
}
