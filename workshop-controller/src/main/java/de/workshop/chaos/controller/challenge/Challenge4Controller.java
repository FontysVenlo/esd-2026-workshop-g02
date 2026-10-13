package de.workshop.chaos.controller.challenge;

import java.util.List;
import de.workshop.chaos.controller.slice.GameDaySliceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/challenge-4")
public class Challenge4Controller {
    private static final Logger log = LoggerFactory.getLogger(Challenge4Controller.class);
    private final Challenge4Service challenge;
    private final GameDaySliceService slice;

    public Challenge4Controller(Challenge4Service challenge, GameDaySliceService slice) {
        this.challenge = challenge;
        this.slice = slice;
    }

    @GetMapping
    public GameDaySliceService.Snapshot state() { return slice.snapshot(); }
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() { return slice.subscribe(); }
    @PostMapping("/traffic/start")
    public GameDaySliceService.Snapshot startTraffic() {
        challenge.startTraffic(); return slice.snapshot();
    }
    @PostMapping("/traffic/stop")
    public GameDaySliceService.Snapshot stopTraffic() {
        challenge.stopTraffic(); return slice.snapshot();
    }
    @PostMapping("/grafana/opened")
    public GameDaySliceService.Snapshot grafanaOpened() {
        challenge.markGrafanaOpened(); return slice.snapshot();
    }
    @PostMapping("/baseline/capture")
    public GameDaySliceService.Snapshot baseline(@RequestBody BaselineInput input) {
        challenge.captureBaseline(input.signals(), input.note()); return slice.snapshot();
    }
    @PostMapping("/incident/start")
    public GameDaySliceService.Snapshot startIncident() {
        challenge.beginIncident(); return slice.snapshot();
    }
    @PostMapping("/incident/capture")
    public GameDaySliceService.Snapshot captureIncident() {
        challenge.captureIncident(); return slice.snapshot();
    }
    @PostMapping("/plan")
    public GameDaySliceService.Snapshot plan(@RequestBody Challenge4Service.Plan input) {
        challenge.savePlan(input); return slice.snapshot();
    }
    @PostMapping("/experiment/start")
    public GameDaySliceService.Snapshot startExperiment() {
        challenge.startExperiment(); return slice.snapshot();
    }
    @PostMapping("/experiment/capture")
    public GameDaySliceService.Snapshot captureExperiment() {
        challenge.captureExperiment(); return slice.snapshot();
    }
    @PostMapping("/analysis")
    public GameDaySliceService.Snapshot analysis(@RequestBody Challenge4Service.Analysis input) {
        challenge.saveAnalysis(input); return slice.snapshot();
    }
    @PostMapping("/mitigation/apply")
    public GameDaySliceService.Snapshot mitigation(@RequestBody MitigationInput input) {
        challenge.applyMitigation(input.settings(), input.reason(), input.expectedEvidence());
        return slice.snapshot();
    }
    @PostMapping("/validation/start")
    public GameDaySliceService.Snapshot startValidation() {
        challenge.startValidation(); return slice.snapshot();
    }
    @PostMapping("/validation/capture")
    public GameDaySliceService.Snapshot captureValidation() {
        challenge.captureValidation(); return slice.snapshot();
    }
    @PostMapping("/conclusion")
    public GameDaySliceService.Snapshot conclusion(@RequestBody ConclusionInput input) {
        challenge.saveConclusion(input.text()); return slice.snapshot();
    }
    @PostMapping("/reset")
    public GameDaySliceService.Snapshot reset() {
        challenge.reset(); return slice.snapshot();
    }

    @ExceptionHandler(ChallengeStateException.class)
    public ResponseEntity<ErrorResponse> invalid(ChallengeStateException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(exception.getMessage()));
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> unavailable(IllegalStateException exception) {
        log.error("GameDay action failed", exception);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse("A local workshop service could not complete this action. "
                        + "Check Docker Desktop and try again."));
    }
    public record BaselineInput(List<String> signals, String note) {}
    public record MitigationInput(Challenge4Service.Settings settings,
            String reason, String expectedEvidence) {}
    public record ConclusionInput(String text) {}
    public record ErrorResponse(String message) {}
}
