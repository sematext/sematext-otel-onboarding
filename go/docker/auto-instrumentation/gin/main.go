package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	sdklog "go.opentelemetry.io/otel/sdk/log"
)

var logger *slog.Logger

func initOTelLogger(ctx context.Context) (*sdklog.LoggerProvider, error) {
	// Reads OTEL_EXPORTER_OTLP_LOGS_* env vars automatically
	exporter, err := otlploghttp.New(ctx)
	if err != nil {
		return nil, err
	}
	provider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)
	return provider, nil
}

func main() {
	ctx := context.Background()

	logProvider, err := initOTelLogger(ctx)
	if err != nil {
		slog.New(slog.NewJSONHandler(os.Stdout, nil)).Error("failed to init OTel logger", "error", err)
		os.Exit(1)
	}
	defer logProvider.Shutdown(ctx)

	// All slog calls are now exported via OTLP using the OTel bridge
	logger = slog.New(otelslog.NewHandler("go-gin-docker-auto",
		otelslog.WithLoggerProvider(logProvider)))

	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		logger.Info("Root endpoint called")
		c.JSON(http.StatusOK, gin.H{
			"message":         "Hello from Go Gin with OpenTelemetry!",
			"instrumentation": "auto (eBPF)",
		})
	})

	r.GET("/users/:id", func(c *gin.Context) {
		id := c.Param("id")
		logger.Info("Fetching user", slog.String("id", id))
		time.Sleep(100 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{
			"id":    id,
			"name":  "User " + id,
			"email": "user" + id + "@example.com",
		})
	})

	r.GET("/slow", func(c *gin.Context) {
		logger.Info("Slow endpoint called")
		time.Sleep(2 * time.Second)
		c.JSON(http.StatusOK, gin.H{
			"message": "Slow operation completed",
		})
	})

	r.GET("/error", func(c *gin.Context) {
		logger.Error("Error endpoint called - simulating error")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Something went wrong!",
		})
	})

	r.Run(":8090")
}
