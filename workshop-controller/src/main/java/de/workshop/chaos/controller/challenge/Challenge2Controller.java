package de.workshop.chaos.controller.challenge;

import de.workshop.chaos.controller.slice.ShippingSliceService;
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
@RequestMapping("/api/challenge-2")
public class Challenge2Controller {

    private final Challenge2Service challenge;
    private final ShippingSliceService slice;

    public Challenge2Controller(Challenge2Service challenge, ShippingSliceService slice) {
        this.challenge = challenge;
        this.slice = slice;
    }

    @GetMapping
    public ShippingSliceService.ShippingSnapshot state() {
        return slice.snapshot();
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return slice.subscribe();
    }

    @PostMapping("/traffic/start")
    public ShippingSliceService.ShippingSnapshot startTraffic() {
        challenge.startTraffic();
        return slice.snapshot();
    }

    @PostMapping("/traffic/stop")
    public ShippingSliceService.ShippingSnapshot stopTraffic() {
        challenge.stopTraffic();
        return slice.snapshot();
    }

    @PostMapping("/baseline/capture")
    public ShippingSliceService.ShippingSnapshot captureBaseline(@RequestBody BaselineInput input) {
        challenge.captureBaseline(input.indicators());
        return slice.snapshot();
    }

    @PostMapping("/hypothesis")
    public ShippingSliceService.ShippingSnapshot hypothesis(@RequestBody HypothesisInput input) {
        challenge.saveHypothesis(input.text());
        return slice.snapshot();
    }

    @PostMapping("/experiment/start")
    public ShippingSliceService.ShippingSnapshot startExperiment() {
        challenge.startExperiment();
        return slice.snapshot();
    }

    @PostMapping("/experiment/capture")
    public ShippingSliceService.ShippingSnapshot captureExperiment() {
        challenge.captureExperiment();
        return slice.snapshot();
    }

    @PostMapping("/observation")
    public ShippingSliceService.ShippingSnapshot observation(
            @RequestBody Challenge2Service.Observation input) {
        challenge.saveObservation(input);
        return slice.snapshot();
    }

    @PostMapping("/mitigation/apply")
    public ShippingSliceService.ShippingSnapshot mitigation(@RequestBody MitigationInput input) {
        challenge.applyMitigation(input.optionId(), input.reason());
        return slice.snapshot();
    }

    @PostMapping("/validation/start")
    public ShippingSliceService.ShippingSnapshot startValidation() {
        challenge.startValidation();
        return slice.snapshot();
    }

    @PostMapping("/validation/capture")
    public ShippingSliceService.ShippingSnapshot captureValidation() {
        challenge.captureValidation();
        return slice.snapshot();
    }

    @PostMapping("/reflection")
    public ShippingSliceService.ShippingSnapshot reflection(@RequestBody ReflectionInput input) {
        challenge.saveBlastRadiusConclusion(input.answer());
        return slice.snapshot();
    }

    @PostMapping("/reset")
    public ShippingSliceService.ShippingSnapshot reset() {
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

    public record HypothesisInput(String text) {
    }

    public record BaselineInput(java.util.List<String> indicators) {
    }

    public record ReflectionInput(String answer) {
    }

    public record MitigationInput(String optionId, String reason) {
    }

    public record ErrorResponse(String message) {
    }
}
