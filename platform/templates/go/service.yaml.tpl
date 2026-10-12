id: {{SERVICE_ID}}
product: {{PRODUCT_ID}}
type: {{SERVICE_TYPE}}
runtime:
  language: go
  version: "1.22"
  framework: standard
path: apps/{{PRODUCT_ID}}/{{SERVICE_ID}}
commands:
  dev:
    - go
    - run
    - main.go
  test:
    - go
    - test
    - ./...
  build:
    - go
    - build
    - -o
    - bin/{{SERVICE_ID}}
    - main.go
  check:
    - go
    - vet
    - ./...
artifact:
  type: docker
  image_name: megalith-{{PRODUCT_ID}}-{{SERVICE_ID}}
deployment:
  deployable: {{DEPLOYABLE}}
  target: {{TARGET}}
