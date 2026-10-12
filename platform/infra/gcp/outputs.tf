output "instance_id" {
  description = "The server-assigned unique identifier of the Compute Engine instance."
  value       = google_compute_instance.megalith.instance_id
}

output "instance_name" {
  description = "The display name of the Compute Engine instance."
  value       = google_compute_instance.megalith.name
}

output "public_ip" {
  description = "The assigned external public IPv4 address (if assign_public_ip is true)."
  value       = var.assign_public_ip ? google_compute_instance.megalith.network_interface[0].access_config[0].nat_ip : null
}

output "instance_public_ip" {
  description = "Alias for public_ip matching documentation conventions."
  value       = var.assign_public_ip ? google_compute_instance.megalith.network_interface[0].access_config[0].nat_ip : null
}

output "service_account_email" {
  description = "The dedicated zero-role service account email attached to the Compute Engine instance."
  value       = google_service_account.vm_sa.email
}

output "private_ip" {
  description = "The internal RFC1918 IPv4 address within the VPC subnet."
  value       = google_compute_instance.megalith.network_interface[0].network_ip
}

output "ssh_admin_user" {
  description = "The non-root administrative username configured for SSH access."
  value       = var.admin_username
}

output "ssh_connect_command" {
  description = "Command template for administrative SSH connection to the host."
  value       = var.assign_public_ip ? "ssh ${var.admin_username}@${google_compute_instance.megalith.network_interface[0].access_config[0].nat_ip}" : "ssh ${var.admin_username}@${google_compute_instance.megalith.network_interface[0].network_ip}"
}

output "network_name" {
  description = "The name of the dedicated Megalith VPC network."
  value       = google_compute_network.megalith.name
}

output "subnet_name" {
  description = "The name of the dedicated Megalith public subnet."
  value       = google_compute_subnetwork.megalith.name
}

output "machine_type" {
  description = "The machine type configured for the instance."
  value       = var.machine_type
}

output "deployment_profile" {
  description = "The intended deployment profile (full vs micro)."
  value       = var.deployment_profile
}
