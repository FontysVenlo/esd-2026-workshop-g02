package de.workshop.chaos.storefront;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProductControllerTest {

    @Test
    void callsConfiguredInventoryEndpointBeforeReturningProduct() throws IOException {
        AtomicReference<String> requestedPath = new AtomicReference<>();
        HttpServer inventory = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        inventory.createContext("/", exchange -> {
            requestedPath.set(exchange.getRequestURI().getPath());
            byte[] body = "{\"productId\":\"demo-product\",\"available\":true,\"quantity\":12}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        inventory.start();
        try {
            ProductController controller = new ProductController(
                    "http://127.0.0.1:" + inventory.getAddress().getPort(),
                    new InventoryResilienceService());
            var response = controller.product("demo-product");

            assertThat(requestedPath.get()).isEqualTo("/api/inventory/demo-product");
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).isEqualTo(new ProductController.Product(
                    "demo-product", "Workshop Backpack", "In stock", 12, false));
        } finally {
            inventory.stop(0);
        }
    }

    @Test
    void shortTimeoutReturnsUsableProductWithFallback() {
        InventoryResilienceService resilience = new InventoryResilienceService();
        resilience.apply(new InventoryResilienceSettings(100, true, 0));
        ProductController controller = new ProductController("http://127.0.0.1:1", resilience);

        var response = controller.product("demo-product");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("X-Workshop-Fallback")).isEqualTo("true");
        assertThat(response.getBody()).isEqualTo(new ProductController.Product(
                "demo-product", "Workshop Backpack",
                "Stock information currently unavailable.", null, true));
    }
}
