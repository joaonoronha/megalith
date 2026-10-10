output "instance_id" {
  description = "The OCID of the provisioned Megalith compute instance."
  value       = oci_core_instance.megalith.id
}

output "public_ip" {
  description = "The assigned public IPv4 address of the Megalith host instance."
  value       = oci_core_instance.megalith.public_ip
}

output "private_ip" {
  description = "The internal private IPv4 address of the Megalith host instance within the subnet."
  value       = oci_core_instance.megalith.private_ip
}

output "vcn_id" {
  description = "The OCID of the dedicated Megalith Virtual Cloud Network."
  value       = oci_core_vcn.megalith.id
}

output "subnet_id" {
  description = "The OCID of the Megalith public subnet."
  value       = oci_core_subnet.public.id
}

output "ssh_admin_user" {
  description = "The non-root administrative username configured for SSH access."
  value       = "ubuntu"
}

output "ssh_connect_command" {
  description = "Command template for administrative SSH connection to the host instance."
  value       = "ssh ubuntu@${oci_core_instance.megalith.public_ip}"
}
