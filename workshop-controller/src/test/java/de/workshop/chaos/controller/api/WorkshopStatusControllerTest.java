package de.workshop.chaos.controller.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WorkshopStatusController.class)
class WorkshopStatusControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exposesPhaseFiveStatus() throws Exception {
        mockMvc.perform(get("/api/workshop/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phase").value("phase-5"))
                .andExpect(jsonPath("$.trafficImplemented").value(true));
    }
}
