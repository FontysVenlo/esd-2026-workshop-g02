package de.workshop.chaos.controller;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WorkshopControllerApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkshopControllerApplication.class, args);
    }
}
