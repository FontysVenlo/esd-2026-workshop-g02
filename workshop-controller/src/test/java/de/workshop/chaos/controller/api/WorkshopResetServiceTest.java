package de.workshop.chaos.controller.api;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import de.workshop.chaos.controller.challenge.Challenge1Service;
import de.workshop.chaos.controller.challenge.Challenge2Service;
import de.workshop.chaos.controller.challenge.Challenge3Service;
import de.workshop.chaos.controller.challenge.Challenge4Service;
import de.workshop.chaos.controller.slice.ExperimentTrafficGenerator;
import de.workshop.chaos.controller.slice.GameDayTrafficGenerator;
import de.workshop.chaos.controller.slice.ShippingTrafficGenerator;
import de.workshop.chaos.controller.slice.ToxiproxyClient;
import de.workshop.chaos.controller.slice.TrafficGenerator;
import org.junit.jupiter.api.Test;

class WorkshopResetServiceTest {
    private final Challenge1Service first = mock(Challenge1Service.class);
    private final Challenge2Service second = mock(Challenge2Service.class);
    private final Challenge3Service third = mock(Challenge3Service.class);
    private final Challenge4Service fourth = mock(Challenge4Service.class);
    private final TrafficGenerator traffic1 = mock(TrafficGenerator.class);
    private final ShippingTrafficGenerator traffic2 = mock(ShippingTrafficGenerator.class);
    private final ExperimentTrafficGenerator traffic3 = mock(ExperimentTrafficGenerator.class);
    private final GameDayTrafficGenerator traffic4 = mock(GameDayTrafficGenerator.class);
    private final ToxiproxyClient proxy = mock(ToxiproxyClient.class);
    private final WorkshopResetService service = new WorkshopResetService(first, second,
            third, fourth, traffic1, traffic2, traffic3, traffic4, proxy);

    @Test
    void stopsAllTrafficResetsAllChallengesAndRestoresAllConnections() {
        service.reset();
        var ordered = inOrder(traffic1, traffic2, traffic3, traffic4,
                first, second, third, fourth, proxy);
        ordered.verify(traffic1).stop();
        ordered.verify(traffic2).stop();
        ordered.verify(traffic3).stop();
        ordered.verify(traffic4).stop();
        ordered.verify(first).reset();
        ordered.verify(second).reset();
        ordered.verify(third).reset();
        ordered.verify(fourth).reset();
        ordered.verify(proxy).restoreInventory();
        ordered.verify(proxy).restoreShipping();
        ordered.verify(proxy).restoreExperiment();
        ordered.verify(proxy).restoreGameDay();
    }

    @Test
    void keepsResettingOtherChallengesWhenOneFails() {
        doThrow(new IllegalStateException("proxy offline")).when(first).reset();
        assertThatThrownBy(service::reset).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("could not finish");
        verify(second).reset();
        verify(third).reset();
        verify(fourth).reset();
        verify(proxy).restoreInventory();
        verify(proxy).restoreShipping();
        verify(proxy).restoreExperiment();
        verify(proxy).restoreGameDay();
    }
}
