package de.workshop.chaos.controller.challenge;

import java.util.List;
import de.workshop.chaos.controller.slice.ExperimentSliceService;
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
@RequestMapping("/api/challenge-3")
public class Challenge3Controller {
    private final Challenge3Service challenge;
    private final ExperimentSliceService slice;

    public Challenge3Controller(Challenge3Service challenge, ExperimentSliceService slice) {
        this.challenge = challenge;
        this.slice = slice;
    }

    @GetMapping
    public ExperimentSliceService.Snapshot state() { return slice.snapshot(); }
    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() { return slice.subscribe(); }
    @PostMapping("/traffic/start")
    public ExperimentSliceService.Snapshot startTraffic() {
        challenge.startTraffic(); return slice.snapshot();
    }
    @PostMapping("/traffic/stop")
    public ExperimentSliceService.Snapshot stopTraffic() {
        challenge.stopTraffic(); return slice.snapshot();
    }
    @PostMapping("/baseline/capture")
    public ExperimentSliceService.Snapshot captureBaseline(@RequestBody BaselineInput input) {
        challenge.captureBaseline(input.indicators()); return slice.snapshot();
    }
    @PostMapping("/hypothesis")
    public ExperimentSliceService.Snapshot hypothesis(@RequestBody HypothesisInput input) {
        challenge.saveExperimentPlan(input.text(), input.faultId(),
                input.blastRadius(), input.abortCondition()); return slice.snapshot();
    }
    @PostMapping("/experiment/start")
    public ExperimentSliceService.Snapshot startExperiment() {
        challenge.startExperiment(); return slice.snapshot();
    }
    @PostMapping("/experiment/capture")
    public ExperimentSliceService.Snapshot captureFailure() {
        challenge.captureFailure(); return slice.snapshot();
    }
    @PostMapping("/observation")
    public ExperimentSliceService.Snapshot observation(
            @RequestBody Challenge3Service.Observation input) {
        challenge.saveObservation(input); return slice.snapshot();
    }
    @PostMapping("/mitigation/apply")
    public ExperimentSliceService.Snapshot mitigation(@RequestBody MitigationInput input) {
        challenge.applySettings(input.settings(), input.reason(), input.expectedEvidence()); return slice.snapshot();
    }
    @PostMapping("/validation/start")
    public ExperimentSliceService.Snapshot startValidation() {
        challenge.startValidation(); return slice.snapshot();
    }
    @PostMapping("/validation/capture")
    public ExperimentSliceService.Snapshot captureValidation() {
        challenge.captureValidation(); return slice.snapshot();
    }
    @PostMapping("/reflection")
    public ExperimentSliceService.Snapshot reflection(@RequestBody Challenge3Service.Reflection input) {
        challenge.saveReflection(input); return slice.snapshot();
    }
    @PostMapping("/reset")
    public ExperimentSliceService.Snapshot reset() {
        challenge.reset(); return slice.snapshot();
    }

    @ExceptionHandler(ChallengeStateException.class)
    public ResponseEntity<ErrorResponse> invalid(ChallengeStateException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(exception.getMessage()));
    }
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> serviceFailure(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse(exception.getMessage()));
    }
    public record BaselineInput(List<String> indicators) {}
    public record HypothesisInput(String text, String faultId, String blastRadius,
            String abortCondition) {}
    public record MitigationInput(Challenge3Service.Settings settings, String reason,
            String expectedEvidence) {}
    public record ErrorResponse(String message) {}
}
