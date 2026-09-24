FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY . .

RUN mvn --projects workshop-controller --also-make clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /workspace/workshop-controller/target/workshop-controller-*.jar /app/app.jar
COPY challenges /app/challenges

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]