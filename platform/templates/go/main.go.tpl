package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","service":"%s-%s"}`, "{{PRODUCT_ID}}", "{{SERVICE_ID}}")
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"ready":true,"service":"%s-%s"}`, "{{PRODUCT_ID}}", "{{SERVICE_ID}}")
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"message":"Welcome to %s (%s)"}`, "{{PRODUCT_NAME}}", "{{SERVICE_ID}}")
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "{{PORT}}"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ready", readyHandler)
	mux.HandleFunc("/", rootHandler)

	addr := ":" + port
	log.Printf("Starting {{PRODUCT_ID}}-{{SERVICE_ID}} on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
