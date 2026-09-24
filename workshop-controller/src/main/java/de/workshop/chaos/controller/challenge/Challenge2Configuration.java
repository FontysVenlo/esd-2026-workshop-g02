package de.workshop.chaos.controller.challenge;

import java.io.IOException;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Challenge2Configuration {

    @Bean
    Challenge2Definition challenge2Definition(
            @Value("${workshop.challenge-directory}") String challengeDirectory,
            ObjectMapper objectMapper) throws IOException {
        Challenge2Definition definition = objectMapper.readValue(
                Path.of(challengeDirectory, "challenge-2.json").toFile(),
                Challenge2Definition.class);
        if (definition.traffic() == null || definition.traffic().endpoint() == null
                || definition.defaultResilience() == null
                || definition.resilienceOptions() == null
                || definition.resilienceOptions().isEmpty()
                || definition.failureControls() == null
                || definition.failureControls().stream().noneMatch(control ->
                        "UNAVAILABLE".equals(control.type())
                                && "shipping".equals(control.target()))
                || definition.evaluation() == null
                || definition.evaluation().technical() == null
                || definition.evaluation().technical().minimumSamplesPerSnapshot() < 1
                || definition.evaluation().conceptual() == null) {
            throw new IllegalStateException("Challenge 2 configuration is incomplete");
        }
        return definition;
    }
}
