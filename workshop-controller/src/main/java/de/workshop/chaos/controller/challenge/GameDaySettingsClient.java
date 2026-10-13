package de.workshop.chaos.controller.challenge;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class GameDaySettingsClient {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI uri;
    private final ObjectMapper mapper;

    public GameDaySettingsClient(@Value("${workshop.storefront-base-url}") String base,
            ObjectMapper mapper) {
        uri = URI.create(base + "/internal/resilience/gameday");
        this.mapper = mapper;
    }

    public void apply(Challenge4Service.Settings settings) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(settings)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Storefront rejected GameDay settings");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("GameDay settings interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not apply GameDay settings", exception);
        }
    }
}
