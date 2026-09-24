package de.workshop.chaos.storefront;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class InventoryResilienceServiceTest {

    @Test
    void appliesAndValidatesWorkshopSettings() {
        InventoryResilienceService service = new InventoryResilienceService();
        assertThat(service.current()).isEqualTo(InventoryResilienceSettings.defaults());

        InventoryResilienceSettings mitigation = new InventoryResilienceSettings(400, true, 0);
        assertThat(service.apply(mitigation)).isEqualTo(mitigation);
        assertThat(service.current()).isEqualTo(mitigation);

        assertThatThrownBy(() -> service.apply(new InventoryResilienceSettings(0, true, 0)))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(service.current()).isEqualTo(mitigation);
    }
}
