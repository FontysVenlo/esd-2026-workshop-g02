package de.workshop.chaos.controller.slice;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ToxiproxyClientTest {

    private HttpServer server;
    private final List<String> requests = new ArrayList<>();
    private String toxicPayload;
    private boolean latencyActive;
    private boolean shippingEnabled = true;
    private final List<String> shippingToxics = new ArrayList<>();
    private boolean experimentEnabled = true;
    private Integer experimentLatency;

    @BeforeEach
    void startFakeToxiproxy() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::respond);
        server.start();
    }

    @AfterEach
    void stopFakeToxiproxy() {
        server.stop(0);
    }

    @Test
    void initializesInventoryProxyAndControlsNamedLatencyToxic() {
        ToxiproxyClient client = new ToxiproxyClient(HttpClient.newHttpClient(),
                new ObjectMapper(), URI.create("http://127.0.0.1:" + server.getAddress().getPort()));

        client.initialize();
        assertThat(requests).contains("POST /populate", "POST /proxies/inventory-proxy",
                "DELETE /proxies/inventory-proxy/toxics/workshop-latency");
        assertThat(client.latencyActive()).isFalse();

        client.injectLatency(1500);
        assertThat(client.latencyActive()).isTrue();
        assertThat(toxicPayload).contains("\"type\":\"latency\"")
                .contains("\"stream\":\"downstream\"")
                .contains("\"latency\":1500");

        client.removeLatency();
        assertThat(client.latencyActive()).isFalse();
    }

    @Test
    void disconnectsAndRestoresShippingWithoutChangingInventory() {
        ToxiproxyClient client = new ToxiproxyClient(HttpClient.newHttpClient(),
                new ObjectMapper(), URI.create("http://127.0.0.1:" + server.getAddress().getPort()));

        client.initialize();
        assertThat(client.shippingAvailable()).isTrue();
        client.disconnectShipping();
        assertThat(client.shippingAvailable()).isFalse();
        shippingToxics.add("shipping-test-toxic");

        client.restoreShipping();
        assertThat(client.shippingAvailable()).isTrue();
        assertThat(shippingToxics).isEmpty();
        assertThat(requests).contains("DELETE /proxies/shipping-proxy/toxics/shipping-test-toxic");
        assertThat(client.latencyActive()).isFalse();
    }

    @Test
    void initializesDedicatedExperimentProxyAndRestoresEitherFault() {
        ToxiproxyClient client = new ToxiproxyClient(HttpClient.newHttpClient(),
                new ObjectMapper(), URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
        client.initialize();
        assertThat(client.experimentState())
                .isEqualTo(new ToxiproxyClient.ExperimentProxyState(true, null, 0));
        client.injectExperimentLatency(1000);
        assertThat(client.experimentState())
                .isEqualTo(new ToxiproxyClient.ExperimentProxyState(true, 1000, 1));
        client.disconnectExperiment();
        assertThat(client.experimentState())
                .isEqualTo(new ToxiproxyClient.ExperimentProxyState(false, null, 0));
        client.restoreExperiment();
        assertThat(client.experimentState())
                .isEqualTo(new ToxiproxyClient.ExperimentProxyState(true, null, 0));
        assertThat(requests).contains("POST /proxies/experiment-inventory-proxy/toxics",
                "DELETE /proxies/experiment-inventory-proxy/toxics/experiment-latency");
    }

    private void respond(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        requests.add(method + " " + path);

        int status = 200;
        String response = "{}";
        if ("POST".equals(method) && "/populate".equals(path)) {
            assertThat(body).contains("0.0.0.0:8666", "inventory-service:8080",
                    "0.0.0.0:8667", "shipping-service:8080", "0.0.0.0:8668");
        } else if ("GET".equals(method) && "/proxies/inventory-proxy".equals(path)) {
            response = "{\"toxics\":[" + (latencyActive
                    ? "{\"name\":\"workshop-latency\"}" : "") + "]}";
        } else if ("POST".equals(method)
                && "/proxies/inventory-proxy/toxics".equals(path)) {
            toxicPayload = body;
            latencyActive = true;
        } else if ("DELETE".equals(method)
                && "/proxies/inventory-proxy/toxics/workshop-latency".equals(path)) {
            status = latencyActive ? 204 : 404;
            latencyActive = false;
        } else if ("GET".equals(method) && "/proxies/shipping-proxy".equals(path)) {
            response = "{\"enabled\":" + shippingEnabled + ",\"toxics\":["
                    + (shippingToxics.isEmpty() ? "" : "{\"name\":\"shipping-test-toxic\"}") + "]}";
        } else if ("POST".equals(method) && "/proxies/shipping-proxy".equals(path)) {
            shippingEnabled = body.contains("\"enabled\":true");
        } else if ("DELETE".equals(method)
                && "/proxies/shipping-proxy/toxics/shipping-test-toxic".equals(path)) {
            status = shippingToxics.remove("shipping-test-toxic") ? 204 : 404;
        } else if ("GET".equals(method)
                && "/proxies/experiment-inventory-proxy".equals(path)) {
            response = "{\"enabled\":" + experimentEnabled + ",\"toxics\":["
                    + (experimentLatency == null ? "" : "{\"name\":\"experiment-latency\","
                            + "\"type\":\"latency\",\"attributes\":{\"latency\":"
                            + experimentLatency + "}}") + "]}";
        } else if ("POST".equals(method)
                && "/proxies/experiment-inventory-proxy/toxics".equals(path)) {
            experimentLatency = new ObjectMapper().readTree(body)
                    .path("attributes").path("latency").asInt();
        } else if ("DELETE".equals(method)
                && "/proxies/experiment-inventory-proxy/toxics/experiment-latency".equals(path)) {
            status = experimentLatency == null ? 404 : 204;
            experimentLatency = null;
        } else if ("POST".equals(method)
                && "/proxies/experiment-inventory-proxy".equals(path)) {
            experimentEnabled = body.contains("\"enabled\":true");
        }

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        if (status == 204) {
            exchange.sendResponseHeaders(status, -1);
        } else {
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
        }
        exchange.close();
    }
}
