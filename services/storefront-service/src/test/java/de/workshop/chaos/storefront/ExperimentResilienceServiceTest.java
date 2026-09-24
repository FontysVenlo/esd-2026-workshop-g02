package de.workshop.chaos.storefront;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ExperimentResilienceServiceTest {
    @Test
    void appliesIndependentSettingsAndOpensCircuitAfterFailures() {
        var service = new ExperimentResilienceService();
        var selected = new ExperimentResilienceSettings(400, true, 1, true);
        service.apply(selected);
        service.failed(); service.failed();
        assertThat(service.circuitOpen()).isFalse();
        service.failed();
        assertThat(service.circuitOpen()).isTrue();
        service.apply(ExperimentResilienceSettings.defaults());
        assertThat(service.circuitOpen()).isFalse();
        assertThat(service.current()).isEqualTo(ExperimentResilienceSettings.defaults());
        assertThatThrownBy(() -> service.apply(new ExperimentResilienceSettings(300, true, 0, false)))
                .isInstanceOf(ResponseStatusException.class);
    }
}
