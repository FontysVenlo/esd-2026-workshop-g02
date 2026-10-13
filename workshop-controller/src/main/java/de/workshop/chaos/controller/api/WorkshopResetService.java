package de.workshop.chaos.controller.api;

import java.util.ArrayList;
import java.util.List;
import de.workshop.chaos.controller.challenge.Challenge1Service;
import de.workshop.chaos.controller.challenge.Challenge2Service;
import de.workshop.chaos.controller.challenge.Challenge3Service;
import de.workshop.chaos.controller.challenge.Challenge4Service;
import de.workshop.chaos.controller.slice.ExperimentTrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class WorkshopResetService {
    private static final Logger log = LoggerFactory.getLogger(WorkshopResetService.class);
    private final Challenge1Service first;
    private final Challenge2Service second;
    private final Challenge3Service third;
    private final Challenge4Service fourth;
    private final TrafficGenerator traffic1;
    private final ShippingTrafficGenerator traffic2;
    private final ExperimentTrafficGenerator traffic3;
    private final GameDayTrafficGenerator traffic4;
    private final ToxiproxyClient toxiproxy;

    public WorkshopResetService(Challenge1Service first, Challenge2Service second,
            Challenge3Service third, Challenge4Service fourth,
            TrafficGenerator traffic1, ShippingTrafficGenerator traffic2,
            ExperimentTrafficGenerator traffic3, GameDayTrafficGenerator traffic4,
            ToxiproxyClient toxiproxy) {
        this.first = first;
        this.second = second;
        this.third = third;
        this.fourth = fourth;
        this.traffic1 = traffic1;
        this.traffic2 = traffic2;
        this.traffic3 = traffic3;
        this.traffic4 = traffic4;
        this.toxiproxy = toxiproxy;
    }

    public synchronized void reset() {
        traffic1.stop();
        traffic2.stop();
        traffic3.stop();
        traffic4.stop();
        List<RuntimeException> failures = new ArrayList<>();
        attempt("Challenge 1", first::reset, failures);
        attempt("Challenge 2", second::reset, failures);
        attempt("Challenge 3", third::reset, failures);
        attempt("Challenge 4", fourth::reset, failures);
        attempt("Inventory connection", toxiproxy::restoreInventory, failures);
        attempt("Shipping connection", toxiproxy::restoreShipping, failures);
        attempt("Experiment connection", toxiproxy::restoreExperiment, failures);
        attempt("GameDay connections", toxiproxy::restoreGameDay, failures);
        if (!failures.isEmpty()) {
            throw new IllegalStateException("Workshop reset could not finish. Check that the "
                    + "local services are running, then try again.", failures.get(0));
        }
    }

    private void attempt(String step, Runnable action, List<RuntimeException> failures) {
        try {
            action.run();
        } catch (RuntimeException exception) {
            log.error("Workshop reset failed during {}", step, exception);
            failures.add(exception);
        }
    }
}
