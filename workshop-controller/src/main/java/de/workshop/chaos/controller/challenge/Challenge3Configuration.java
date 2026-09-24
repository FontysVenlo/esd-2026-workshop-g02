package de.workshop.chaos.controller.challenge;

import java.io.IOException;
import java.nio.file.Path;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Challenge3Configuration {
    @Bean
    Challenge3Definition challenge3Definition(
            @Value("${workshop.challenge-directory}") String directory,
            ObjectMapper mapper) throws IOException {
        Challenge3Definition definition = mapper.readValue(
                Path.of(directory, "challenge-3.json").toFile(), Challenge3Definition.class);
        if (definition.traffic() == null || definition.traffic().endpoint() == null
                || definition.faults() == null || definition.faults().stream().noneMatch(f -> "LATENCY".equals(f.type()))
                || definition.faults().stream().noneMatch(f -> "UNAVAILABLE".equals(f.type()))
                || definition.controls() == null || definition.evaluation() == null
                || definition.evaluation().minimumSamplesPerSnapshot() < 1) {
            throw new IllegalStateException("Challenge 3 configuration is incomplete");
        }
        return definition;
    }
}
