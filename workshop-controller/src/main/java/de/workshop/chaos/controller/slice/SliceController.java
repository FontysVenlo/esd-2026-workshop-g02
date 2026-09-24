package de.workshop.chaos.controller.slice;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/slice")
public class SliceController {

    private final SliceService slice;

    public SliceController(SliceService slice) {
        this.slice = slice;
    }

    @GetMapping("/state")
    public SliceService.SliceSnapshot state() {
        return slice.snapshot();
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return slice.subscribe();
    }

}
