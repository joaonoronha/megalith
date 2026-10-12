id: {{SERVICE_ID}}
product: {{PRODUCT_ID}}
type: web
runtime:
  language: typescript
  version: "5.x"
  framework: React
path: apps/{{PRODUCT_ID}}/{{SERVICE_ID}}
commands:
  dev:
    - pnpm
    - dev
  test:
    - pnpm
    - test
  build:
    - pnpm
    - build
  check:
    - pnpm
    - check
artifact:
  type: docker
  image_name: megalith-{{PRODUCT_ID}}-{{SERVICE_ID}}
deployment:
  deployable: {{DEPLOYABLE}}
  target: {{TARGET}}
