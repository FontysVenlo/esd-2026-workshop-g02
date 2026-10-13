package de.workshop.chaos.controller.slice;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Controls the local Inventory and Shipping proxies independently. */
@Component
public class ToxiproxyClient {

    static final String PROXY = "inventory-proxy";
    static final String LATENCY_TOXIC = "workshop-latency";
    static final String SHIPPING_PROXY = "shipping-proxy";
    static final String EXPERIMENT_PROXY = "experiment-inventory-proxy";
    static final String EXPERIMENT_LATENCY_TOXIC = "experiment-latency";
    static final String GAMEDAY_INVENTORY_PROXY = "gameday-inventory-proxy";
    static final String GAMEDAY_SHIPPING_PROXY = "gameday-shipping-proxy";
    static final String GAMEDAY_TOXIC = "gameday-fault";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI apiBase;

    @Autowired
    public ToxiproxyClient(@Value("${workshop.toxiproxy-api-url}") String apiBase,
            ObjectMapper objectMapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(),
                objectMapper, URI.create(apiBase));
    }

    ToxiproxyClient(HttpClient httpClient, ObjectMapper objectMapper, URI apiBase) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.apiBase = apiBase;
    }

    public synchronized void initialize() {
        send("POST", "/populate", List.of(Map.of(
                "name", PROXY,
                "listen", "0.0.0.0:8666",
                "upstream", "inventory-service:8080"), Map.of(
                "name", SHIPPING_PROXY,
                "listen", "0.0.0.0:8667",
                "upstream", "shipping-service:8080"), Map.of(
                "name", EXPERIMENT_PROXY,
                "listen", "0.0.0.0:8668",
                "upstream", "inventory-service:8080"), Map.of(
                "name", GAMEDAY_INVENTORY_PROXY,
                "listen", "0.0.0.0:8669",
                "upstream", "inventory-service:8080"), Map.of(
                "name", GAMEDAY_SHIPPING_PROXY,
                "listen", "0.0.0.0:8670",
                "upstream", "shipping-service:8080")), false);
        send("POST", "/proxies/" + PROXY, Map.of("enabled", true), false);
        removeLatency();
        restoreShipping();
        restoreExperiment();
        restoreGameDay();
    }

    public synchronized void injectLatency(int latencyMs) {
        if (latencyActive()) {
            return;
        }
        send("POST", "/proxies/" + PROXY + "/toxics", Map.of(
                "name", LATENCY_TOXIC,
                "type", "latency",
                "stream", "downstream",
                "toxicity", 1.0,
                "attributes", Map.of("latency", latencyMs, "jitter", 0)), false);
    }

    public synchronized void removeLatency() {
        send("DELETE", "/proxies/" + PROXY + "/toxics/" + LATENCY_TOXIC,
                null, true);
    }

    public synchronized void restoreInventory() {
        restoreProxy(PROXY);
    }

    public synchronized boolean latencyActive() {
        String body = send("GET", "/proxies/" + PROXY, null, false);
        try {
            JsonNode proxy = objectMapper.readTree(body);
            for (JsonNode toxic : proxy.path("toxics")) {
                if (LATENCY_TOXIC.equals(toxic.path("name").asText())) {
                    return true;
                }
            }
            return false;
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read Toxiproxy state", exception);
        }
    }

    public synchronized void disconnectShipping() {
        send("POST", "/proxies/" + SHIPPING_PROXY, Map.of("enabled", false), false);
    }

    public synchronized void restoreShipping() {
        JsonNode proxy = shippingProxy();
        for (JsonNode toxic : proxy.path("toxics")) {
            String name = toxic.path("name").asText();
            if (!name.isBlank()) {
                send("DELETE", "/proxies/" + SHIPPING_PROXY + "/toxics/" + name,
                        null, true);
            }
        }
        send("POST", "/proxies/" + SHIPPING_PROXY, Map.of("enabled", true), false);
    }

    public synchronized boolean shippingAvailable() {
        return shippingProxy().path("enabled").asBoolean(false);
    }

    public synchronized void injectExperimentLatency(int latencyMs) {
        restoreExperiment();
        send("POST", "/proxies/" + EXPERIMENT_PROXY + "/toxics", Map.of(
                "name", EXPERIMENT_LATENCY_TOXIC,
                "type", "latency",
                "stream", "downstream",
                "toxicity", 1.0,
                "attributes", Map.of("latency", latencyMs, "jitter", 0)), false);
    }

    public synchronized void disconnectExperiment() {
        restoreExperiment();
        send("POST", "/proxies/" + EXPERIMENT_PROXY, Map.of("enabled", false), false);
    }

    public synchronized void restoreExperiment() {
        JsonNode proxy = experimentProxy();
        for (JsonNode toxic : proxy.path("toxics")) {
            String name = toxic.path("name").asText();
            if (!name.isBlank()) {
                send("DELETE", "/proxies/" + EXPERIMENT_PROXY + "/toxics/" + name,
                        null, true);
            }
        }
        send("POST", "/proxies/" + EXPERIMENT_PROXY, Map.of("enabled", true), false);
    }

    public synchronized ExperimentProxyState experimentState() {
        JsonNode proxy = experimentProxy();
        Integer latency = null;
        int toxicCount = 0;
        for (JsonNode toxic : proxy.path("toxics")) {
            toxicCount++;
            if (EXPERIMENT_LATENCY_TOXIC.equals(toxic.path("name").asText())
                    && "latency".equals(toxic.path("type").asText())) {
                latency = toxic.path("attributes").path("latency").asInt();
            }
        }
        return new ExperimentProxyState(proxy.path("enabled").asBoolean(false),
                latency, toxicCount);
    }

    private JsonNode experimentProxy() {
        try {
            return objectMapper.readTree(send("GET", "/proxies/" + EXPERIMENT_PROXY,
                    null, false));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read experiment connection", exception);
        }
    }

    public record ExperimentProxyState(boolean enabled, Integer latencyMs, int toxicCount) {
    }

    public synchronized void injectGameDayFault(String target, String type, int latencyMs) {
        if (!"inventory".equals(target) && !"shipping".equals(target)) {
            throw new IllegalArgumentException("Unsupported GameDay dependency");
        }
        if (!"LATENCY".equals(type) && !"UNAVAILABLE".equals(type)
                && !"TIMEOUT".equals(type)) {
            throw new IllegalArgumentException("Unsupported GameDay fault");
        }
        restoreGameDay();
        String proxy = "inventory".equals(target)
                ? GAMEDAY_INVENTORY_PROXY : GAMEDAY_SHIPPING_PROXY;
        if ("UNAVAILABLE".equals(type)) {
            send("POST", "/proxies/" + proxy, Map.of("enabled", false), false);
        } else {
            send("POST", "/proxies/" + proxy + "/toxics", Map.of(
                    "name", GAMEDAY_TOXIC,
                    "type", "LATENCY".equals(type) ? "latency" : "timeout",
                    "stream", "downstream", "toxicity", 1.0,
                    "attributes", "LATENCY".equals(type)
                            ? Map.of("latency", latencyMs, "jitter", 0)
                            : Map.of("timeout", 5000)), false);
        }
    }

    public synchronized void restoreGameDay() {
        restoreProxy(GAMEDAY_INVENTORY_PROXY);
        restoreProxy(GAMEDAY_SHIPPING_PROXY);
    }

    public synchronized GameDayState gameDayState() {
        return new GameDayState(gameDayProxyState(GAMEDAY_INVENTORY_PROXY),
                gameDayProxyState(GAMEDAY_SHIPPING_PROXY));
    }

    private GameDayProxyState gameDayProxyState(String name) {
        JsonNode proxy = proxyState(name);
        String type = null;
        int latencyMs = 0;
        int toxics = 0;
        for (JsonNode toxic : proxy.path("toxics")) {
            toxics++;
            if (GAMEDAY_TOXIC.equals(toxic.path("name").asText())) {
                type = toxic.path("type").asText();
                latencyMs = toxic.path("attributes").path("latency").asInt(0);
            }
        }
        return new GameDayProxyState(proxy.path("enabled").asBoolean(false),
                type, latencyMs, toxics);
    }

    private void restoreProxy(String name) {
        JsonNode proxy = proxyState(name);
        for (JsonNode toxic : proxy.path("toxics")) {
            String toxicName = toxic.path("name").asText();
            if (!toxicName.isBlank()) {
                send("DELETE", "/proxies/" + name + "/toxics/" + toxicName, null, true);
            }
        }
        send("POST", "/proxies/" + name, Map.of("enabled", true), false);
    }

    private JsonNode proxyState(String name) {
        try {
            return objectMapper.readTree(send("GET", "/proxies/" + name, null, false));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read connection state", exception);
        }
    }

    public record GameDayProxyState(boolean enabled, String toxicType,
            int latencyMs, int toxicCount) {
    }
    public record GameDayState(GameDayProxyState inventory, GameDayProxyState shipping) {
    }

    private JsonNode shippingProxy() {
        try {
            return objectMapper.readTree(send("GET", "/proxies/" + SHIPPING_PROXY,
                    null, false));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read Shipping connection state", exception);
        }
    }

    private String send(String method, String path, Object body, boolean allowNotFound) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(apiBase.resolve(path))
                    .timeout(Duration.ofSeconds(3));
            if (body == null) {
                request.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                request.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(
                                objectMapper.writeValueAsString(body)));
            }
            HttpResponse<String> response = httpClient.send(request.build(),
                    HttpResponse.BodyHandlers.ofString());
            if (allowNotFound && response.statusCode() == 404) {
                return response.body();
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Toxiproxy " + method + " " + path
                        + " returned HTTP " + response.statusCode() + ": " + response.body());
            }
            return response.body();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Toxiproxy request interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not reach Toxiproxy at " + apiBase, exception);
        }
    }
}
