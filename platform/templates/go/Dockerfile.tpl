FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/{{SERVICE_ID}} main.go

FROM alpine:3.20 AS runtime

WORKDIR /app

RUN addgroup -g 10001 appgroup && \
    adduser -u 10001 -G appgroup -s /bin/false -D appuser

COPY --from=builder --chown=appuser:appgroup /app/bin/{{SERVICE_ID}} /app/service

USER appuser

EXPOSE {{PORT}}

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:{{PORT}}/health"]

CMD ["/app/service"]
