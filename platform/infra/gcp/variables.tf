variable "project_id" {
  description = "The Google Cloud project ID where resources will be provisioned."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "The project_id must be between 6 and 30 characters, start with a lowercase letter, and contain only lowercase letters, digits, and hyphens."
  }
}

variable "region" {
  description = "The GCP region to deploy resources into (e.g. us-central1, us-east1, us-west1 are eligible for Free Tier)."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone within the chosen region (e.g. us-central1-a)."
  type        = string
  default     = "us-central1-a"
}

variable "instance_name" {
  description = "The name of the Compute Engine VM instance."
  type        = string
  default     = "megalith-host"
}

variable "environment" {
  description = "Target deployment environment: 'staging' (default, free-tier sandbox) or 'production'. Note: 'production' requires allow_paid_resources = true and deployment_profile = 'full'."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be either 'staging' or 'production'."
  }
}

variable "allow_paid_resources" {
  description = "Explicit cost-safety gate authorizing paid GCP resources beyond the Always Free tier. Must remain false for the free-tier staging profile."
  type        = bool
  default     = false
}

variable "machine_type" {
  description = "The Compute Engine machine type. Defaults to 'e2-micro' (Always Free eligible in US regions). Paid machine types (e2-standard-2, etc.) require allow_paid_resources = true."
  type        = string
  default     = "e2-micro"

  validation {
    condition     = contains(["e2-micro", "e2-small", "e2-medium", "e2-standard-2", "e2-standard-4", "n2-standard-2"], var.machine_type)
    error_message = "machine_type must be a recognized general-purpose machine type such as e2-micro (Always Free staging default) or e2-standard-2."
  }
}

variable "deployment_profile" {
  description = "Deployment profile targeted by this host: 'micro' (experimental bootstrap smoke testing on e2-micro, default) or 'full' (complete production stack requiring >= 4 GB RAM and allow_paid_resources = true)."
  type        = string
  default     = "micro"

  validation {
    condition     = contains(["micro", "full"], var.deployment_profile)
    error_message = "deployment_profile must be either 'micro' or 'full'."
  }
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in gigabytes. 30 GB standard persistent disk (pd-standard) per month is included in the GCP Free Tier for US regions."
  type        = number
  default     = 30

  validation {
    condition     = var.boot_disk_size_gb >= 20 && var.boot_disk_size_gb <= 100
    error_message = "boot_disk_size_gb must be between 20 and 100 GB."
  }
}

variable "boot_disk_type" {
  description = "Boot disk type. 'pd-standard' is eligible for the Free Tier; 'pd-balanced' or 'pd-ssd' provides higher performance but incurs persistent disk charges."
  type        = string
  default     = "pd-standard"

  validation {
    condition     = contains(["pd-standard", "pd-balanced", "pd-ssd"], var.boot_disk_type)
    error_message = "boot_disk_type must be one of: pd-standard, pd-balanced, pd-ssd."
  }
}

variable "os_image" {
  description = "Operating system image family or explicit image path (x86_64 Ubuntu 24.04 LTS recommended)."
  type        = string
  default     = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
}

variable "network_name" {
  description = "Name of the dedicated custom VPC network."
  type        = string
  default     = "megalith-vpc"
}

variable "subnet_cidr" {
  description = "IPv4 CIDR block for the dedicated public subnet."
  type        = string
  default     = "10.10.0.0/24"

  validation {
    condition     = can(cidrnetmask(var.subnet_cidr))
    error_message = "subnet_cidr must be a valid IPv4 CIDR block."
  }
}

variable "ssh_admin_cidr" {
  description = "Trusted administrator IPv4 CIDR block permitted to connect via SSH (port 22). For security, this cannot be 0.0.0.0/0. Specify your public IP as a /32 (e.g., 203.0.113.50/32)."
  type        = string

  validation {
    condition     = var.ssh_admin_cidr != "0.0.0.0/0" && can(cidrnetmask(var.ssh_admin_cidr))
    error_message = "ssh_admin_cidr must be a valid IPv4 CIDR block and must NOT be open to the entire internet (0.0.0.0/0). Specify a trusted administrator CIDR, such as 203.0.113.50/32."
  }
}

variable "ssh_public_key" {
  description = "SSH public key string for administrative host access. Must be an ed25519 or rsa public key."
  type        = string

  validation {
    condition     = can(regex("^(ssh-(ed25519|rsa)|ecdsa-sha2-nistp(256|384|521))\\s+[A-Za-z0-9+/=]+", trimspace(var.ssh_public_key)))
    error_message = "ssh_public_key must be a valid OpenSSH public key (e.g. starting with ssh-ed25519 or ssh-rsa)."
  }
}

variable "admin_username" {
  description = "Non-root administrative username configured for SSH access and Docker group."
  type        = string
  default     = "ubuntu"
}

variable "assign_public_ip" {
  description = "Whether to assign an ephemeral external public IPv4 address to the instance. Notice: GCP bills in-use external IPv4 addresses (~$0.005/hour, approx $3.60/month)."
  type        = bool
  default     = true
}
