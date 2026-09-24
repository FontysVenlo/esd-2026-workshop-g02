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

/** Applies only Shipping resilience settings to Storefront. */
@Component
public class ShippingSettingsClient {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI settingsUri;
    private final ObjectMapper objectMapper;

    public ShippingSettingsClient(
            @Value("${workshop.storefront-base-url}") String storefrontBaseUrl,
            ObjectMapper objectMapper) {
        this.settingsUri = URI.create(storefrontBaseUrl + "/internal/resilience/shipping");
        this.objectMapper = objectMapper;
    }

    public void apply(Challenge2Definition.Settings settings) {
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "timeoutMs", settings.shippingTimeoutMs(),
                    "fallbackEnabled", settings.shippingFallbackEnabled(),
                    "retries", settings.shippingRetries()));
            HttpRequest request = HttpRequest.newBuilder(settingsUri)
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Storefront rejected Shipping settings: HTTP "
                        + response.statusCode());
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Shipping settings request interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not apply Shipping resilience settings", exception);
        }
    }
}
