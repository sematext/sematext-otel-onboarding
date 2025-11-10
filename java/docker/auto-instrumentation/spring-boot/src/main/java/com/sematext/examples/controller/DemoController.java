package com.sematext.examples.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class DemoController {

    private static final Logger logger = LoggerFactory.getLogger(DemoController.class);

    @GetMapping("/")
    public Map<String, String> root() {
        logger.info("Root endpoint called");
        Map<String, String> response = new HashMap<>();
        response.put("message", "Hello from Spring Boot with OpenTelemetry!");
        response.put("instrumentation", "auto");
        return response;
    }

    @GetMapping("/users/{id}")
    public Map<String, Object> getUser(@PathVariable String id) {
        logger.info("Fetching user with id: {}", id);

        // Simulate some processing
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        Map<String, Object> user = new HashMap<>();
        user.put("id", id);
        user.put("name", "User " + id);
        user.put("email", "user" + id + "@example.com");

        logger.info("User fetched successfully: {}", id);
        return user;
    }

    @GetMapping("/slow")
    public Map<String, String> slow() {
        logger.info("Slow endpoint called");

        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "Slow operation completed");
        return response;
    }

    @GetMapping("/error")
    public ResponseEntity<Map<String, String>> error() {
        logger.error("Error endpoint called - simulating error");

        Map<String, String> response = new HashMap<>();
        response.put("error", "Something went wrong!");

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
