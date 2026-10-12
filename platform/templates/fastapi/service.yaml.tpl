id: {{SERVICE_ID}}
product: {{PRODUCT_ID}}
type: {{SERVICE_TYPE}}
runtime:
  language: python
  version: "3.12"
  framework: FastAPI
path: apps/{{PRODUCT_ID}}/{{SERVICE_ID}}
commands:
  dev:
    - uvicorn
    - src.main:app
    - --port
    - "{{PORT}}"
    - --reload
  test:
    - pytest
    - tests/
  check:
    - ruff
    - check
    - src/
    - tests/{{MIGRATE_COMMAND}}
artifact:
  type: docker
  image_name: megalith-{{PRODUCT_ID}}-{{SERVICE_ID}}
deployment:
  deployable: {{DEPLOYABLE}}
  target: {{TARGET}}{{DEPENDENCIES_BLOCK}}
