variable "compartment_ocid" {
  description = "The OCID of the compartment where Megalith resources will be created. In an Always Free tenancy, this can be the tenancy root compartment OCID or a dedicated compartment OCID."
  type        = string

  validation {
    condition     = can(regex("^ocid1\\.(compartment|tenancy)\\.oc1\\.", var.compartment_ocid))
    error_message = "The compartment_ocid must be a valid OCI compartment or tenancy OCID starting with ocid1.compartment.oc1. or ocid1.tenancy.oc1."
  }
}

variable "region" {
  description = "The OCI region where infrastructure resources will be provisioned (e.g., us-ashburn-1, sa-saopaulo-1)."
  type        = string
  default     = "us-ashburn-1"
}

variable "availability_domain_name" {
  description = "The exact availability domain name (e.g., 'UwhS:US-ASHBURN-AD-1'). If left empty, the availability domain is determined automatically using availability_domain_number."
  type        = string
  default     = ""
}

variable "availability_domain_number" {
  description = "1-based index of the availability domain to select from the tenancy availability domains list when availability_domain_name is empty (default: 1)."
  type        = number
  default     = 1

  validation {
    condition     = var.availability_domain_number >= 1 && var.availability_domain_number <= 3
    error_message = "availability_domain_number must be between 1 and 3."
  }
}

variable "instance_name" {
  description = "Display name for the Megalith host compute instance."
  type        = string
  default     = "megalith-host"
}

variable "fault_domain" {
  description = "Optional fault domain within the availability domain (e.g. 'FAULT-DOMAIN-1', 'FAULT-DOMAIN-2', 'FAULT-DOMAIN-3'). If left empty, OCI selects automatically."
  type        = string
  default     = ""
}

variable "vcn_cidr" {
  description = "IPv4 CIDR block for the dedicated Megalith Virtual Cloud Network."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vcn_cidr))
    error_message = "vcn_cidr must be a valid IPv4 CIDR block."
  }
}

variable "subnet_cidr" {
  description = "IPv4 CIDR block for the Megalith public subnet."
  type        = string
  default     = "10.0.1.0/24"

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

variable "ocpus" {
  description = "Number of OCPUs for the Ampere A1 Flex shape (1 to 4 for Always Free eligibility)."
  type        = number
  default     = 2

  validation {
    condition     = var.ocpus >= 1 && var.ocpus <= 4
    error_message = "ocpus must be between 1 and 4 to remain within Always Free eligibility limits."
  }
}

variable "memory_in_gbs" {
  description = "Memory in gigabytes for the Ampere A1 Flex shape (up to 24 GB total for Always Free eligibility; 6 GB per OCPU recommended)."
  type        = number
  default     = 12

  validation {
    condition     = var.memory_in_gbs >= 1 && var.memory_in_gbs <= 24
    error_message = "memory_in_gbs must be between 1 and 24 to remain within Always Free eligibility limits."
  }
}

variable "boot_volume_size_in_gbs" {
  description = "Boot volume size in gigabytes (50 to 200 GB for Always Free eligibility)."
  type        = number
  default     = 50

  validation {
    condition     = var.boot_volume_size_in_gbs >= 50 && var.boot_volume_size_in_gbs <= 200
    error_message = "boot_volume_size_in_gbs must be between 50 and 200 GB."
  }
}

variable "operating_system" {
  description = "Operating system distribution name for ARM64 image lookup."
  type        = string
  default     = "Canonical Ubuntu"
}

variable "operating_system_version" {
  description = "Operating system distribution version for ARM64 image lookup."
  type        = string
  default     = "24.04"
}

variable "image_ocid" {
  description = "Optional explicit OCID of an ARM64 operating system image. If provided, overrides the automated image lookup."
  type        = string
  default     = ""

  validation {
    condition     = var.image_ocid == "" || can(regex("^ocid1\\.image\\.oc1\\.", var.image_ocid))
    error_message = "image_ocid, if specified, must be a valid image OCID starting with ocid1.image.oc1."
  }
}
