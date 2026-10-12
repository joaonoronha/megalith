# Dedicated least-privilege service account for the single-node VM (Task 012.1 Objective C)
resource "google_service_account" "vm_sa" {
  account_id   = "${var.instance_name}-sa"
  display_name = "Megalith VM Service Account (${var.deployment_profile})"
  description  = "Dedicated zero-role service account for Megalith single-node VM with zero project IAM permissions"
}

# Megalith single-node host compute instance (Google Compute Engine)
resource "google_compute_instance" "megalith" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone
  description  = "Megalith single-node application host (${var.deployment_profile} profile, ${var.environment} environment)"

  tags = ["megalith-host"]

  boot_disk {
    auto_delete = true
    initialize_params {
      image = var.os_image
      size  = var.boot_disk_size_gb
      type  = var.boot_disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.megalith.id

    dynamic "access_config" {
      for_each = var.assign_public_ip ? [1] : []
      content {
        # Ephemeral external IP address
      }
    }
  }

  metadata = {
    ssh-keys = "${var.admin_username}:${trimspace(var.ssh_public_key)}"
    user-data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      admin_username = var.admin_username
      ssh_public_key = trimspace(var.ssh_public_key)
      ssh_admin_cidr = var.ssh_admin_cidr
    })
    block-project-ssh-keys = "TRUE"
    enable-oslogin         = "FALSE"
  }

  # Shielded VM security baseline
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  # Least-privilege service account: dedicated identity with zero project IAM roles and empty scopes
  service_account {
    email  = google_service_account.vm_sa.email
    scopes = []
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false
  }

  lifecycle {
    # Objective A & G: Fail-closed cost-safety gates and architectural guardrails
    precondition {
      condition     = var.machine_type == "e2-micro" || var.allow_paid_resources
      error_message = "Cost-safety gate: Machine type '${var.machine_type}' incurs hourly charges. Staging target is restricted strictly to Always Free 'e2-micro' unless allow_paid_resources = true."
    }

    precondition {
      condition     = !(var.environment == "production" && var.deployment_profile == "micro")
      error_message = "Safety gate: The 'micro' deployment profile is strictly experimental and cannot be deployed in 'production'. Production requires deployment_profile = 'full' and allow_paid_resources = true."
    }

    precondition {
      condition     = !(var.deployment_profile == "full" && var.machine_type == "e2-micro")
      error_message = "Memory-safety gate: The full Megalith production stack (PostgreSQL, FastAPI, React, Caddy, migrations) cannot run on 'e2-micro' (1 GB RAM) and would trigger Linux OOM. Full profile requires a machine with >= 4 GB RAM (e.g., e2-standard-2) and allow_paid_resources = true."
    }

    precondition {
      condition     = !(var.environment == "production" && !var.allow_paid_resources)
      error_message = "Cost-safety gate: Production environment requires allow_paid_resources = true."
    }

    precondition {
      condition     = contains(["us-central1", "us-east1", "us-west1"], var.region) || var.allow_paid_resources
      error_message = "Cost-safety gate: Region '${var.region}' is not eligible for Google Cloud Compute Engine Always Free tier (must be us-central1, us-east1, or us-west1) unless allow_paid_resources = true."
    }

    precondition {
      condition     = var.boot_disk_type == "pd-standard" || var.allow_paid_resources
      error_message = "Cost-safety gate: Disk type '${var.boot_disk_type}' is not eligible for the Always Free allowance (which requires pd-standard). Choose pd-standard or set allow_paid_resources = true."
    }

    precondition {
      condition     = var.boot_disk_size_gb <= 30 || var.allow_paid_resources
      error_message = "Cost-safety gate: Boot disk size ${var.boot_disk_size_gb} GB exceeds the 30 GB Always Free persistent disk allowance. Set boot_disk_size_gb <= 30 or allow_paid_resources = true."
    }

    precondition {
      condition     = !(var.deployment_profile == "micro" && var.machine_type != "e2-micro" && !var.allow_paid_resources)
      error_message = "Cost-safety gate: Micro deployment profile is intended strictly for 'e2-micro' staging validation."
    }

    ignore_changes = [
      metadata["ssh-keys"],
    ]
  }
}
