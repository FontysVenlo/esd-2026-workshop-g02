package de.workshop.chaos.storefront;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class OrderSummaryControllerTest {

    @Test
    void callsConfiguredShippingEndpointForNormalOrderSummary() throws IOException {
        AtomicReference<String> requestedPath = new AtomicReference<>();
        HttpServer shipping = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        shipping.createContext("/", exchange -> {
            requestedPath.set(exchange.getRequestURI().getPath());
            byte[] body = "{\"orderId\":\"demo-order\",\"estimatedDays\":3,\"message\":\"Estimated delivery in 3 days\"}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        shipping.start();
        try {
            OrderSummaryController controller = new OrderSummaryController(
                    "http://127.0.0.1:" + shipping.getAddress().getPort(),
                    new ShippingResilienceService());
            var response = controller.summary("demo-order");
            assertThat(requestedPath.get()).isEqualTo("/api/shipping/demo-order");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isEqualTo(new OrderSummaryController.OrderSummary(
                    "demo-order", "Workshop Backpack", 49.00,
                    "Estimated delivery in 3 days", 3, false));
        } finally {
            shipping.stop(0);
        }
    }

    @Test
    void unavailableShippingBreaksDefaultRequestButFallbackKeepsSummaryUsable() {
        ShippingResilienceService resilience = new ShippingResilienceService();
        OrderSummaryController controller = new OrderSummaryController("http://127.0.0.1:1",
                resilience);

        assertThat(controller.summary("demo-order").getStatusCode())
                .isEqualTo(HttpStatus.BAD_GATEWAY);
        resilience.apply(new ShippingResilienceSettings(400, true, 0));
        var response = controller.summary("demo-order");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("X-Workshop-Fallback")).isEqualTo("true");
        assertThat(response.getBody()).isEqualTo(new OrderSummaryController.OrderSummary(
                "demo-order", "Workshop Backpack", 49.00,
                "Shipping estimate currently unavailable.", null, true));
    }

    @Test
    void retryOptionMakesOnlyOneAdditionalAttempt() throws IOException {
        AtomicInteger attempts = new AtomicInteger();
        HttpServer shipping = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        shipping.createContext("/", exchange -> {
            attempts.incrementAndGet();
            exchange.sendResponseHeaders(503, -1);
            exchange.close();
        });
        shipping.start();
        try {
            ShippingResilienceService resilience = new ShippingResilienceService();
            resilience.apply(new ShippingResilienceSettings(400, false, 1));
            OrderSummaryController controller = new OrderSummaryController(
                    "http://127.0.0.1:" + shipping.getAddress().getPort(), resilience);
            assertThat(controller.summary("demo-order").getStatusCode())
                    .isEqualTo(HttpStatus.BAD_GATEWAY);
            assertThat(attempts.get()).isEqualTo(2);
        } finally {
            shipping.stop(0);
        }
    }
}
