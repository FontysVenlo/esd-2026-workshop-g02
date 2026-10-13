package de.workshop.chaos.controller.challenge;

import java.io.IOException;
import java.nio.file.Path;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Challenge4Configuration {
    @Bean
    Challenge4Definition challenge4Definition(
            @Value("${workshop.challenge-directory}") String directory,
            ObjectMapper mapper) throws IOException {
        Challenge4Definition definition = mapper.readValue(
                Path.of(directory, "challenge-4.json").toFile(), Challenge4Definition.class);
        if (definition.scenarios() == null || definition.scenarios().isEmpty()
                || definition.faults() == null || definition.faults().isEmpty()
                || definition.evaluation() == null
                || definition.evaluation().minimumSamplesPerWindow() < 1) {
            throw new IllegalStateException("Challenge 4 configuration is incomplete");
        }
        return definition;
    }
}
