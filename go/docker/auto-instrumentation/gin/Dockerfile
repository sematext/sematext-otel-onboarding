# Build stage
FROM golang:1.25-alpine AS build
WORKDIR /app

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build the application
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o app .

# Runtime stage
FROM alpine:3.19
WORKDIR /app

COPY --from=build /app/app .

EXPOSE 8090

ENTRYPOINT ["./app"]
