# Phase 6 changed files

This manifest lists the source, configuration, documentation, and test files changed or added for Phase 6. Build outputs and dependency caches are not included.

## Workshop and documentation

- `README.md`
- `docker-compose.yml`
- `challenges/challenge-4.json`
- `docs/api-contracts.md`
- `docs/architecture.md`
- `docs/participant-guide.md`
- `docs/phase-6-facilitator.md`
- `scripts/start-workshop.bat`
- `scripts/stop-workshop.bat`

## Observability

- `observability/prometheus.yml`
- `observability/grafana/provisioning/datasources/prometheus.yml`
- `observability/grafana/provisioning/dashboards/workshop.yml`
- `observability/grafana/dashboards/workshop.json`

## Frontend

- `frontend/src/App.tsx`
- `frontend/src/AssignmentCard.tsx`
- `frontend/src/Challenge2App.tsx`
- `frontend/src/Challenge3App.tsx`
- `frontend/src/Challenge4App.tsx`
- `frontend/src/WorkshopGuide.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`

## Storefront

- `services/storefront-service/pom.xml`
- `services/storefront-service/src/main/resources/application.yml`
- `services/storefront-service/src/main/java/de/workshop/chaos/storefront/GameDayController.java`
- `services/storefront-service/src/main/java/de/workshop/chaos/storefront/GameDayDependencyMetrics.java`
- `services/storefront-service/src/main/java/de/workshop/chaos/storefront/GameDaySettings.java`
- `services/storefront-service/src/main/java/de/workshop/chaos/storefront/GameDaySettingsService.java`

## Workshop Controller

- `workshop-controller/pom.xml`
- `workshop-controller/src/main/resources/application.yml`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/api/WorkshopResetController.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/api/WorkshopResetService.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/api/WorkshopStatusController.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge1Controller.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge1Service.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge2Controller.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge2Service.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge3Controller.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge3Service.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge4Configuration.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge4Controller.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge4Definition.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/Challenge4Service.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/challenge/GameDaySettingsClient.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/ExperimentTrafficGenerator.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/GameDayMetricsStore.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/GameDaySliceService.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/GameDayTrafficGenerator.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/ShippingTrafficGenerator.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/SliceService.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/ToxiproxyClient.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/TrafficGenerator.java`
- `workshop-controller/src/main/java/de/workshop/chaos/controller/slice/WorkshopMetricsRecorder.java`

## Tests

- `workshop-controller/src/test/java/de/workshop/chaos/controller/api/WorkshopResetServiceTest.java`
- `workshop-controller/src/test/java/de/workshop/chaos/controller/api/WorkshopStatusControllerTest.java`
- `workshop-controller/src/test/java/de/workshop/chaos/controller/challenge/Challenge1ServiceTest.java`
- `workshop-controller/src/test/java/de/workshop/chaos/controller/challenge/Challenge2ServiceTest.java`
- `workshop-controller/src/test/java/de/workshop/chaos/controller/challenge/Challenge3ServiceTest.java`
- `workshop-controller/src/test/java/de/workshop/chaos/controller/challenge/Challenge4ServiceTest.java`
- `workshop-controller/src/test/java/de/workshop/chaos/controller/slice/WorkshopMetricsRecorderTest.java`
- `docs/phase-6-changed-files.md`
