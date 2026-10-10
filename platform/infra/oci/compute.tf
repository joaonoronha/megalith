# Query availability domains in the tenancy / compartment
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

# Query official ARM64 OS images compatible with VM.Standard.A1.Flex shape
data "oci_core_images" "ubuntu_arm64" {
  compartment_id           = var.compartment_ocid
  operating_system         = var.operating_system
  operating_system_version = var.operating_system_version
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

locals {
  # Deterministically select availability domain
  availability_domain = var.availability_domain_name != "" ? var.availability_domain_name : data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_number - 1].name

  # Select explicit override image if provided, otherwise latest matching official image
  image_id = var.image_ocid != "" ? var.image_ocid : data.oci_core_images.ubuntu_arm64.images[0].id
}

# Megalith single-node host compute instance (OCI Always Free Ampere A1 ARM64)
resource "oci_core_instance" "megalith" {
  compartment_id      = var.compartment_ocid
  availability_domain = local.availability_domain
  display_name        = var.instance_name

  # Fixed to Ampere A1 Flex shape for Always Free ARM64 compute (no paid fallback)
  shape = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_in_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    display_name     = "${var.instance_name}-primary-vnic"
    assign_public_ip = true
    nsg_ids          = [oci_core_network_security_group.megalith.id]
  }

  source_details {
    source_type             = "image"
    source_id               = local.image_id
    boot_volume_size_in_gbs = var.boot_volume_size_in_gbs
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml.tftpl", {
      admin_username = "ubuntu"
      ssh_public_key = var.ssh_public_key
    }))
  }

  preserve_boot_volume = false
}
