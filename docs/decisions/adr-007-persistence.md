# ADR-007: Persistence Strategy

## Status
Accepted

## Context
Multiple products require relational database persistence. Running a dedicated PostgreSQL container instance for every product wastes RAM and CPU resources on a single VM. Conversely, sharing a single database and credentials across products introduces data leakage risks and tight coupling.

## Decision
We deploy a **single shared PostgreSQL container instance**, but enforce strict isolation by creating:
1. A separate logical database per product (e.g., `db_fitness`, `db_finance`).
2. A dedicated user role per product (e.g., `role_fitness`, `role_finance`) with strong passwords and restricted permissions granted solely to its own database.
3. No shared tables, schemas, or cross-database queries between products.

## Rationale
- **Resource Efficiency**: A single PostgreSQL daemon efficiently pools connection memory, buffer caches, and background writers across all applications, saving gigabytes of host RAM.
- **Strict Isolation**: Product roles cannot read, modify, or list tables belonging to another product's database.
- **Operational Unification**: Centralized management for engine upgrades, connection tuning, WAL configuration, and automated backups.
- **Independence**: Each product manages its own schema migrations (Alembic, Prisma, Flyway, etc.) independently without coordination.

## Alternatives Considered
- **PostgreSQL Container Per Product**: Rejected because running 6–15 separate database engines consumes excessive memory, creates port sprawl, and complicates host administration.
- **Shared Database with Separate Schemas**: Rejected because accidental cross-schema queries can occur, permissions boundaries are harder to enforce, and database-level drops/restores affect multiple products.
- **Embedded SQLite Per Product**: Rejected for services requiring concurrent writes, network access from separate worker services, or robust relational features.

## Consequences
- Single point of failure: If the PostgreSQL container crashes, all products relying on persistence are affected.
- Host I/O and CPU are shared among products; noisy neighbor queries could degrade other applications if unconstrained.
- Provisioning scripts must automate the creation of product databases and roles during onboarding.
