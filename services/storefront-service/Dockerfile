FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY . .

RUN mvn --projects services/storefront-service --also-make clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /workspace/services/storefront-service/target/storefront-service-*.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]