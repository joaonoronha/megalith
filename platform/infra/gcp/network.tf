# Custom Virtual Private Cloud (VPC) dedicated to Megalith
resource "google_compute_network" "megalith" {
  name                    = var.network_name
  auto_create_subnetworks = false
  description             = "Dedicated custom VPC network for Megalith single-node deployment"
}

# Dedicated public subnet
resource "google_compute_subnetwork" "megalith" {
  name          = "${var.network_name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.megalith.id
  description   = "Dedicated subnet hosting the Megalith Compute Engine instance"
}

# Firewall Rule: SSH access restricted strictly to administrator trusted CIDR
resource "google_compute_firewall" "allow_ssh" {
  name        = "${var.network_name}-allow-ssh"
  network     = google_compute_network.megalith.name
  description = "Allow inbound SSH access strictly from trusted administrator CIDR"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = [var.ssh_admin_cidr]
  target_tags   = ["megalith-host"]
}

# Firewall Rule: Public HTTP (80) and HTTPS (443) for Caddy edge reverse proxy
resource "google_compute_firewall" "allow_web" {
  name        = "${var.network_name}-allow-web"
  network     = google_compute_network.megalith.name
  description = "Allow public HTTP and HTTPS ingress to edge reverse proxy (Caddy)"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["megalith-host"]
}
