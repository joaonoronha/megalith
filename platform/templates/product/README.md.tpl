# {{PRODUCT_NAME}}

{{PRODUCT_DESCRIPTION}}

## Architecture & Services

This product is managed within the Megalith monorepo under `apps/{{PRODUCT_ID}}/`.
Its product contract is defined in [`product.yaml`](product.yaml).

### Declared Services

Services belonging to this product are scaffolded into subdirectories under `apps/{{PRODUCT_ID}}/` and registered in `product.yaml`.

### Development & Lifecycle Commands

Run service lifecycle commands via the Megalith Platform CLI:

```bash
# Validate manifests
megalith validate

# Run tests
megalith run {{PRODUCT_ID}}/<service-id> test
```
