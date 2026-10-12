# Free PostgreSQL Hosting Evaluation & Feasibility Study

**Task:** Megalith Task 014 & Task 014.1  
**Date:** 2026-10-12  
**Author:** Agy (Platform Implementation Engineer)  
**Status:** Complete (Corrected Specification)  
**Scope:** Architecture evaluation, verified free-tier limits, security review, off-host backup destinations, and multi-tenant topology for 6–15 independent applications targeting **€0/month** recurring cost.

---

## 1. Executive Summary & Strategy Overview

Megalith is designed as a polyglot monorepo hosting multiple independent applications with strict service isolation, deterministic releases, and zero ongoing cloud infrastructure expenditure.

This evaluation establishes the corrected database strategy across three distinct operating tiers:

1. **Local Development (Default Path):** Standard PostgreSQL 16 containerized via Docker Compose (`compose.yaml`). Self-contained, offline-capable, with per-product logical databases and isolated roles.
2. **Initial Deployment Candidate:** **Neon Free Tier (Serverless PostgreSQL).**
   - Designated as the immediate deployment candidate for staging and small, intermittent cloud workloads.
   - Provides up to **100 projects** per free account ($0/month), supporting **1 dedicated database project per application (`Topology A`)**.
   - No credit card required. Pure hard-stop model preventing any automatic charges.
   - 100 Compute Unit (CU) hours per project per month; 1 GB storage per project (20 GB account ceiling).
   - Strict Workload Constraint: Viable solely for intermittent, bursty, or web-request-driven workloads. Continuous 24/7 background daemons or real-time polling will exhaust compute in 4 to 16 days.
3. **Future Self-Hosted Candidate:** **OCI Always Free PostgreSQL (Ampere A1 VM).**
   - **Operational Reality:** Pervasive regional capacity exhaustion (`Out of host capacity for shape VM.Standard.A1.Flex`) across OCI Free Tier tenancies is currently a **blocking operational constraint**, not merely a theoretical risk.
   - Designated as a future candidate contingent upon the operator obtaining confirmed Ampere A1 capacity.
   - When available, unlocks 4 OCPUs, 24 GB RAM, 200 GB persistent storage, zero cold starts, and full support for continuous background workers without quotas.
4. **Viable Off-Host Backup Destinations Identified:**
   - **Cloudflare R2 (Primary):** 10 GB free permanent storage, zero egress bandwidth fees, 1M Class A operations/month, S3-compatible API.
   - **Backblaze B2 (Alternative - No Credit Card Required):** 10 GB free permanent storage, zero credit card requirement at sign-up, free download egress up to 30 GB/month, S3-compatible API.
5. **Inviable Alternatives (Rejected):**
   - **Supabase Free:** Capped at **2 active projects** and pauses databases after 7 days of inactivity without auto-wake. Topology A is impossible for 6–15 apps.
   - **GCP `e2-micro`:** 1 GB host RAM total; running PostgreSQL triggers the Linux Out-Of-Memory (OOM) killer. Restricted to stateless staging (`micro` profile).
   - **Google Cloud Firestore / Datastore:** Proprietary document NoSQL; incompatible with relational joins, constraints, and Alembic migrations.

---

## 2. Comprehensive Provider Research Matrix

*All pricing, limits, and service quotas verified against official vendor documentation on **2026-10-12**.*

| Provider & Tier | Guaranteed Documented Limits | Account-Level Caps & Pooling | Inactivity / Suspension Behavior | Backup & Snapshot Availability | Egress & Over-limit Enforcement | Billing Safety (Charge Risk) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Neon Free** | **100 projects** included;<br>100 CU-hrs/project/mo;<br>1 GB storage/project;<br>10 branches/project | 20 GB storage total across all projects;<br>Integrated PgBouncer pooler (max 100 pooled conns) | Auto-suspends after **5 min idle**;<br>auto-wakes on TCP connect (~500ms–1.5s) | 6-hour instant restore history (max 1 GB WAL);<br>1 manual snapshot (no automated schedules) | 5 GB/project/mo egress.<br>Exceeding compute/egress suspends instance.<br>Exceeding storage fails writes. | **Zero Charge Risk**<br>No credit card required.<br>Strict hard stop. |
| **Supabase Free** | **Max 2 active projects** per org;<br>500 MB database size;<br>Shared compute (500 MB RAM) | 1 database (`postgres`) surfaced in UI;<br>Supavisor connection pooler | Pauses after 7 days idle;<br>**NO auto-wake** (requires manual dashboard unpause) | Daily backups retained 7 days (Pro only for PITR);<br>Manual logical dumps | Usage beyond quota blocked.<br>No automatic overage fees. | **Zero Charge Risk**<br>No credit card required. |
| **OCI Always Free (Ampere A1)** | Up to 4 OCPUs (ARM64);<br>24 GB RAM;<br>200 GB boot/block storage | Unlimited logical databases within self-hosted instance;<br>Host-level connection tuning | **Never suspended** (provided compute is active) | Unlimited local WAL archiving;<br>Automated cron `pg_dump` to off-host S3 storage | 10 TB/month free outbound egress. | **Zero Cost (Within Limits)**<br>Requires credit card for initial identity verification. |
| **GCP `e2-micro` Always Free** | 1 `e2-micro` VM (2 shared vCPUs, 1 GB RAM);<br>30 GB `pd-standard` disk | Inadequate host memory for DB + apps;<br>OS uses ~380 MiB RAM | Never suspended | Manual scripts to Cloud Storage | 1 GB/mo internet egress.<br>Public IPv4 incurs charges (~$3.65/mo) unless exempt. | **Potential Charges**<br>Public IP / egress overages billed automatically. |
| **Cloudflare R2 (Backup Target)** | 10 GB-months standard storage;<br>1M Class A operations/mo;<br>10M Class B operations/mo | S3-compatible bucket API;<br>Integrated token authentication | Always available | Object versioning supported | **$0.00 Egress Fees** (Unlimited free outbound transfer) | **Zero Cost (Within Limits)**<br>Credit card required for account creation. |
| **Backblaze B2 (Backup Target)** | 10 GB standard storage free;<br>Free download egress up to 3x storage (~30 GB/mo) | S3-compatible API | Always available | Lifecycle rules supported | Zero cost within 10 GB storage and 30 GB egress. | **Zero Charge Risk**<br>No credit card required to start. |

---

## 3. Detailed Neon Free Limits & Operational Behavior

*Source: `https://neon.tech/docs/introduction/plans` (Verified 2026-10-12)*

### 1. Guaranteed Documented Limits vs. Illustrative Estimates
- **Projects:** **100 projects included** on the Free plan ($0/month). (Guaranteed limit).
- **Storage:** **1 GB of Postgres storage per project**, with an account-wide limit of **20 GB total** across all projects in the organization. Both limits are enforced independently. (Guaranteed limit).
- **Compute Allowance:** **100 CU-hours per project per month**. (Guaranteed limit).
  - 1 Compute Unit (CU) allocates ~1 vCPU and 4 GB RAM.
  - Autoscaling on Free plan ranges from 0.25 CU (1 GB RAM) up to 2 CU (8 GB RAM).
  - Running at minimum fractional compute (0.25 CU) provides up to **400 active hours per month** (100 / 0.25).
  - Running at 1 CU provides 100 active hours per month.
- **Inactivity Suspension (Scale-to-Zero):** Automatically suspends compute after **5 minutes of network inactivity**. Cannot be disabled or modified on the Free plan. (Guaranteed limit).
- **Wake-up Latency:** Cold start typically takes **500 ms to 1.5 seconds** upon receiving an incoming connection. (Observed operational behavior).
- **Connection Pooling:** Built-in PgBouncer pooler endpoint (`-pooler` hostname) operating in transaction pooling mode. Supports up to 100 pooled connections. (Guaranteed limit).
- **Public Data Transfer (Egress):** **5 GB per project per month** included. (Guaranteed limit).
- **Snapshots & Restore:**
  - 6-hour instant restore history window (capped at 1 GB change history).
  - 1 manual snapshot per project.
  - Automated backup schedules are **not available** on the Free plan. (Guaranteed limit).
- **Billing Enforcement & Over-limit Safety:**
  - **No Credit Card Required:** Free plan accounts do not collect payment methods.
  - **Compute Exhaustion:** When 100 CU-hours are depleted, the project's compute instance is suspended until the next monthly billing cycle. Active connections drop; new connections are rejected.
  - **Storage Exhaustion:** When 1 GB project storage or 20 GB account storage is reached, write operations (`INSERT`, `UPDATE`, `DELETE`) fail immediately with storage errors. Read queries continue to function.
  - **Zero Financial Risk:** The service is strictly hard-capped; users cannot incur unexpected fees.

---

## 4. Workload Assumptions & Recalculated Multi-App Scenarios

To distinguish guaranteed provider limits from illustrative estimates, we define explicit workload models:

### Explicit Workload Model Definitions:
1. **Model W (Web-Only Sporadic Application):**
   - 5,000 requests/day, arriving in ~25 bursts throughout the day.
   - Database query execution time: 15 ms per request (~75 seconds of active execution/day).
   - Inactivity timeout: 5 minutes idle per burst (25 bursts × 5 min = 125 min/day = ~2.08 hours/day active compute time).
   - Monthly active compute time: ~62.5 hours/month at 0.25 CU = **15.6 CU-hours/month**.
   - Storage profile: Initial schema 15 MB + 10 MB growth/month = **135 MB at year 1**.
   - Public egress: ~300 MB/month.
2. **Model C (Continuous Worker / Polling Application):**
   - Application runs a background worker, Celery daemon, websocket listener, or cron job polling every 1–2 minutes.
   - Inactivity timeout (5 minutes) is **never reached**; compute never scales to zero.
   - Monthly active compute time: 720 hours/month at 0.25 CU = **180 CU-hours/month** (or 720 CU-hours at 1 CU).
   - **Exhausts Neon 100 CU-hour quota in 16.6 days at 0.25 CU (or 4.1 days at 1 CU).**

---

### Scenario Calculations (1, 3, 6, and 15 Applications)

| Scenario | Application Breakdown | Storage Required vs. Limit | Compute Usage vs. Limit | Egress Required vs. Limit | Feasibility on Neon Free (Topology A) | Feasibility on OCI Ampere A1 (Topology B - Future) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 App** | 1 Model W app | ~135 MB<br>*(Guaranteed limit: 1 GB)*<br>**Headroom: 86.5%** | ~15.6 CU-hrs/mo<br>*(Guaranteed: 100 CU-hrs)*<br>**Headroom: 84.4%** | ~300 MB/mo<br>*(Guaranteed: 5 GB)*<br>**Headroom: 94%** | **Feasible & Sustainable** (€0/mo). Zero charge risk. | **Feasible** when VM capacity is obtained (€0/mo). |
| **3 Apps** | 3 Model W apps | ~405 MB total<br>*(Guaranteed: 1 GB/proj, 20 GB total)* | ~15.6–25 CU-hrs/proj<br>*(Guaranteed: 100 CU-hrs/proj)* | ~900 MB total<br>*(Guaranteed: 5 GB/proj)* | **Feasible & Sustainable** (3 dedicated projects, €0/mo). | **Feasible** when VM capacity is obtained (€0/mo). |
| **6 Apps** | 6 Model W apps | ~810 MB total<br>*(Guaranteed: 20 GB total)*<br>**Headroom: >95%** | ~15.6–30 CU-hrs/proj<br>*(Guaranteed: 100 CU-hrs/proj)* | ~1.8 GB total<br>*(Guaranteed: 5 GB/proj)* | **Feasible & Sustainable** (6 dedicated projects, €0/mo). | **Feasible** when VM capacity is obtained (€0/mo). |
| **15 Apps** | **Case 1:** 15 Model W apps | ~2.0 GB total<br>*(Guaranteed: 20 GB total)*<br>**Headroom: 90%** | ~15.6–30 CU-hrs/proj<br>*(Guaranteed: 100 CU-hrs/proj)* | ~4.5 GB total<br>*(Guaranteed: 5 GB/proj)* | **Feasible** (15 of 100 projects used, €0/mo). | **Feasible** when VM capacity is obtained (€0/mo). |
| **15 Apps** | **Case 2:** 14 Model W + 1 Model C app | ~2.0 GB total | 14 apps at ~20 CU-hrs;<br>**1 app uses 180 CU-hrs** | ~4.5 GB total | **Partial Failure:** The 1 Model C app **halts on Day 16** when its 100 CU-hours deplete. The other 14 apps continue unaffected. | **Fully Feasible & Robust:** 24 GB RAM and 4 OCPUs run continuous workers without quotas. |

### Key Insight:
Under **Topology A on Neon Free**, failures are strictly isolated: if App #3 depletes its 100 CU-hours, only App #3 suspends; Apps #1, #2, and #4–15 continue operating normally. However, applications requiring continuous daemons (Model C) **must not be deployed to Neon Free**; they must await self-hosted OCI Ampere A1.

---

## 5. Viable Off-Host Backup Destinations

Because Neon Free does not provide automated backup schedules and retains point-in-time history for only 6 hours (with a 1 GB WAL cap), Megalith mandates independent off-host backups using `pg_dump` piped directly into `age` X25519 authenticated encryption.

We have evaluated candidate off-host backup storage destinations that provide permanent free-tier capacity:

### Option A: Cloudflare R2 (Primary Recommended Off-Host Target)
- **Free Allowance:** **10 GB-months storage**, 1,000,000 Class A operations/month (uploads/lists), 10,000,000 Class B operations/month (reads).
- **Egress Fees:** **$0.00 forever** (Cloudflare charges zero data transfer fees).
- **API Interface:** Standard S3-compatible API.
- **Retention Feasibility:**
  - 15 applications × 20 MB compressed encrypted backup × 7 daily retention versions = **2.1 GB total storage**.
  - 2.1 GB consumed out of 10 GB allowance = **79% free headroom**.
  - Daily uploads for 15 apps = 450 Class A operations/month (out of 1,000,000 allowed).
- **Restore Feasibility:** Instant download via S3 API with zero bandwidth charges.
- **Cost Risk:** Cloudflare requires a payment method on file to create an account, but incurs €0.00 charges within 10 GB.

### Option B: Backblaze B2 (Alternative Target — Zero Credit Card Required)
- **Free Allowance:** **10 GB storage free permanently**, free download bandwidth up to 3× average storage (up to 30 GB/month).
- **Sign-up Constraint:** **No credit card required** to activate free tier.
- **API Interface:** Standard S3-compatible API.
- **Retention Feasibility:** Same 2.1 GB footprint for 15 apps over 7 days.
- **Restore Feasibility:** 2.1 GB restore consumes <7% of the 30 GB free monthly egress.
- **Cost Risk:** Zero risk of unintended charges.

---

## 6. OCI Availability as a Blocking Operational Reality

In previous analyses, OCI Always Free compute capacity was treated as readily available. However:

> **Critical Notice**: Regional capacity exhaustion for the ARM64 Ampere A1 shape (`VM.Standard.A1.Flex`) on OCI Free Tier tenancies is a **pervasive, documented operational reality** across multiple geographic regions (`Out of host capacity for shape VM.Standard.A1.Flex`).

Treating OCI Ampere A1 as an immediate deployment target leads to deployment failure. Therefore:
- **OCI Ampere A1 is classified as a Future Self-Hosted Candidate**, contingent on verified capacity allocation.
- **Neon Free is classified as the Initial Staging & Deployment Candidate**, providing immediate, automated cloud database hosting without waiting for VM availability.

---

## 7. Multi-Application Database Topology Comparison

| Topology | Description | Immediate Feasibility | Blast Radius | Connection Limits | Operational Overhead |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Topology A (1 Project per App)** | Neon Free: each app has a dedicated project. | **High (Immediate)** | **Zero cross-app impact** | 100 pooled conns/app | Low (managed cloud) |
| **Topology B (1 Instance, Separate DBs)** | OCI Ampere A1: dedicated logical databases in one container. | **Blocked by OCI capacity** | Isolated per DB; `REVOKE CONNECT` enforced | Configurable (200–300 total) | Moderate (Docker Compose) |
| **Topology C (1 Shared DB, Separate Schemas)** | All apps in single DB via PostgreSQL schemas. | Inadvisable | High (shared locks, catalog leaks) | Shared pool contention | High (complex Alembic version table scoping) |
| **Topology D (Self-Hosted on `e2-micro`)** | Docker Compose on GCP `e2-micro`. | **Infeasible (OOM crash)** | Host crash kills all apps | RAM exhausted by >20 conns | Extreme (kernel OOM debugging) |
