# Virtual Cloud Network (VCN) dedicated to Megalith
resource "oci_core_vcn" "megalith" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = [var.vcn_cidr]
  display_name   = "${var.instance_name}-vcn"
  dns_label      = "megalith"
}

# Internet Gateway for public inbound/outbound connectivity
resource "oci_core_internet_gateway" "megalith" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.megalith.id
  display_name   = "${var.instance_name}-igw"
  enabled        = true
}

# Route Table directing default internet traffic (0.0.0.0/0) through the Internet Gateway
resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.megalith.id
  display_name   = "${var.instance_name}-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.megalith.id
    description       = "Default internet route to Internet Gateway"
  }
}

# Restrictive Security List for the subnet.
# All granular ingress/egress policies are enforced at the Network Security Group (NSG) level.
# Keeping the subnet-level security list empty prevents OCI's default security list
# (which permits SSH from 0.0.0.0/0 by default) from bypassing our NSG controls.
resource "oci_core_security_list" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.megalith.id
  display_name   = "${var.instance_name}-subnet-sl"

  # Outbound egress rule for OS updates, package retrieval, and container images
  egress_security_rules {
    destination      = "0.0.0.0/0"
    destination_type = "CIDR_BLOCK"
    protocol         = "all"
    description      = "Allow outbound connectivity from subnet"
  }
}

# Public Subnet hosting the Megalith ARM64 VM
resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.megalith.id
  cidr_block                 = var.subnet_cidr
  display_name               = "${var.instance_name}-public-subnet"
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.public.id]
  prohibit_public_ip_on_vnic = false
}

# Network Security Group (NSG) enforcing instance-level ingress controls
resource "oci_core_network_security_group" "megalith" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.megalith.id
  display_name   = "${var.instance_name}-nsg"
}

# NSG Ingress Rule: SSH restricted to administrator trusted CIDR
resource "oci_core_network_security_group_security_rule" "ssh_ingress" {
  network_security_group_id = oci_core_network_security_group.megalith.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = var.ssh_admin_cidr
  source_type               = "CIDR_BLOCK"
  description               = "Allow inbound SSH access exclusively from trusted administrator CIDR"

  tcp_options {
    destination_port_range {
      min = 22
      max = 22
    }
  }
}

# NSG Ingress Rule: HTTP (Port 80) for Let's Encrypt ACME and HTTPS redirection
resource "oci_core_network_security_group_security_rule" "http_ingress" {
  network_security_group_id = oci_core_network_security_group.megalith.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Allow inbound HTTP (port 80) for ACME challenges and HTTP to HTTPS redirects"

  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

# NSG Ingress Rule: HTTPS (Port 443) for Caddy edge reverse proxy
resource "oci_core_network_security_group_security_rule" "https_ingress" {
  network_security_group_id = oci_core_network_security_group.megalith.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Allow inbound HTTPS (port 443) for edge ingress"

  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

# NSG Egress Rule: Full outbound egress
resource "oci_core_network_security_group_security_rule" "all_egress" {
  network_security_group_id = oci_core_network_security_group.megalith.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "Allow outbound traffic for package updates, container images, and ACME"
}
