package de.workshop.chaos.controller.challenge;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Applies real Inventory behavior inside Storefront over the Docker network. */
@Component
public class StorefrontSettingsClient {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI settingsUri;
    private final ObjectMapper objectMapper;

    public StorefrontSettingsClient(@Value("${workshop.storefront-base-url}") String storefrontBaseUrl,
            ObjectMapper objectMapper) {
        this.settingsUri = URI.create(storefrontBaseUrl
                + "/internal/resilience/inventory");
        this.objectMapper = objectMapper;
    }

    public void apply(Challenge1Definition.Settings settings) {
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "timeoutMs", settings.inventoryTimeoutMs(),
                    "fallbackEnabled", settings.inventoryFallbackEnabled(),
                    "retries", settings.inventoryRetries()));
            HttpRequest request = HttpRequest.newBuilder(settingsUri)
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Storefront rejected resilience settings: HTTP "
                        + response.statusCode());
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Storefront settings request interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not apply Storefront resilience settings", exception);
        }
    }
}

