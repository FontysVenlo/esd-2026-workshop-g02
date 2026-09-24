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
public class ExperimentSettingsClient {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private final URI uri;
    private final ObjectMapper mapper;

    public ExperimentSettingsClient(@Value("${workshop.storefront-base-url}") String base,
            ObjectMapper mapper) {
        uri = URI.create(base + "/internal/resilience/experiment");
        this.mapper = mapper;
    }

    public void apply(Challenge3Service.Settings settings) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(settings)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Storefront rejected experiment settings: HTTP "
                        + response.statusCode());
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Experiment settings interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not apply experiment settings", exception);
        }
    }
}
