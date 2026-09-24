package de.workshop.chaos.controller.challenge;

import de.workshop.chaos.controller.slice.SliceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/challenge-1")
public class Challenge1Controller {

    private final Challenge1Service challenge;
    private final SliceService slice;

    public Challenge1Controller(Challenge1Service challenge, SliceService slice) {
        this.challenge = challenge;
        this.slice = slice;
    }

    @GetMapping
    public SliceService.SliceSnapshot state() {
        return slice.snapshot();
    }

    @PostMapping("/traffic/start")
    public SliceService.SliceSnapshot startTraffic() {
        challenge.startTraffic();
        return slice.snapshot();
    }

    @PostMapping("/traffic/stop")
    public SliceService.SliceSnapshot stopTraffic() {
        challenge.stopTraffic();
        return slice.snapshot();
    }

    @PostMapping("/baseline/capture")
    public SliceService.SliceSnapshot captureBaseline() {
        challenge.captureBaseline();
        return slice.snapshot();
    }

    @PostMapping("/hypothesis")
    public SliceService.SliceSnapshot hypothesis(@RequestBody Challenge1Service.Hypothesis input) {
        challenge.saveHypothesis(input);
        return slice.snapshot();
    }

    @PostMapping("/experiment/start")
    public SliceService.SliceSnapshot startExperiment() {
        challenge.startExperiment();
        return slice.snapshot();
    }

    @PostMapping("/experiment/capture")
    public SliceService.SliceSnapshot captureExperiment() {
        challenge.captureExperiment();
        return slice.snapshot();
    }

    @PostMapping("/observation")
    public SliceService.SliceSnapshot observation(@RequestBody Challenge1Service.Observation input) {
        challenge.saveObservation(input);
        return slice.snapshot();
    }

    @PostMapping("/mitigation/apply")
    public SliceService.SliceSnapshot mitigation(@RequestBody MitigationSelection input) {
        challenge.applyMitigation(input.optionId());
        return slice.snapshot();
    }

    @PostMapping("/validation/start")
    public SliceService.SliceSnapshot startValidation() {
        challenge.startValidation();
        return slice.snapshot();
    }

    @PostMapping("/validation/capture")
    public SliceService.SliceSnapshot captureValidation() {
        challenge.captureValidation();
        return slice.snapshot();
    }

    @PostMapping("/reset")
    public SliceService.SliceSnapshot reset() {
        challenge.reset();
        return slice.snapshot();
    }

    @ExceptionHandler(ChallengeStateException.class)
    public ResponseEntity<ErrorResponse> invalidTransition(ChallengeStateException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> serviceFailure(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse(exception.getMessage()));
    }

    public record MitigationSelection(String optionId) {
    }

    public record ErrorResponse(String message) {
    }
}
