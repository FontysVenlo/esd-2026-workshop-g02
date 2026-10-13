package de.workshop.chaos.storefront;

import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GameDaySettingsService {
    private final AtomicReference<GameDaySettings> current =
            new AtomicReference<>(GameDaySettings.defaults());

    public GameDaySettings current() { return current.get(); }

    public GameDaySettings apply(GameDaySettings next) {
        if (next == null || !validTimeout(next.inventoryTimeoutMs())
                || !validTimeout(next.shippingTimeoutMs())
                || next.retries() < 0 || next.retries() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a supported timeout and zero or one retry");
        }
        current.set(next);
        return next;
    }

    private static boolean validTimeout(int value) {
        return value == 250 || value == 400 || value == 750 || value == 4000;
    }
}
