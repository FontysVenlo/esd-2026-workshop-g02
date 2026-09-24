package de.workshop.chaos.controller.challenge;

import java.io.IOException;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Challenge1Configuration {

    @Bean
    Challenge1Definition challenge1Definition(
            @Value("${workshop.challenge-directory}") String challengeDirectory,
            ObjectMapper objectMapper) throws IOException {
        Challenge1Definition definition = objectMapper.readValue(
                Path.of(challengeDirectory, "challenge-1.json").toFile(),
                Challenge1Definition.class);
        if (definition.latencyMs() <= 0 || definition.resilienceOptions().isEmpty()
                || definition.evaluation().technical().minimumSamplesPerSnapshot() < 1) {
            throw new IllegalStateException("Challenge 1 configuration is incomplete");
        }
        return definition;
    }
}

