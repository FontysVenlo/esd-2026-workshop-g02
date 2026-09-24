package de.workshop.chaos.storefront;

import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ExperimentResilienceService {
    private final AtomicReference<ExperimentResilienceSettings> settings =
            new AtomicReference<>(ExperimentResilienceSettings.defaults());
    private int consecutiveFailures;
    private long openUntilNanos;

    public ExperimentResilienceSettings current() {
        return settings.get();
    }

    public synchronized ExperimentResilienceSettings apply(ExperimentResilienceSettings next) {
        if (next == null || (next.timeoutMs() != 4000 && next.timeoutMs() != 250
                && next.timeoutMs() != 400 && next.timeoutMs() != 750)
                || next.retries() < 0 || next.retries() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a supported timeout and zero or one retry");
        }
        settings.set(next);
        consecutiveFailures = 0;
        openUntilNanos = 0;
        return next;
    }

    public synchronized boolean circuitOpen() {
        return settings.get().circuitBreakerEnabled()
                && System.nanoTime() < openUntilNanos;
    }

    public synchronized void succeeded() {
        consecutiveFailures = 0;
        openUntilNanos = 0;
    }

    public synchronized void failed() {
        if (settings.get().circuitBreakerEnabled() && ++consecutiveFailures >= 3) {
            openUntilNanos = System.nanoTime() + 5_000_000_000L;
        }
    }
}
