FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

# Copy the complete Maven multi-module project
COPY . .

# Build the inventory service and required reactor modules
RUN mvn --projects services/inventory-service --also-make clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /workspace/services/inventory-service/target/inventory-service-*.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]