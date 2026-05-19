output "artifact_registry_url" {
  description = "Docker push URL for karma images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repo}"
}

output "violations_topic" {
  description = "Pub/Sub topic for contract violations"
  value       = google_pubsub_topic.violations.id
}

output "karma_runner_sa_email" {
  description = "Service account email for Cloud Run deployments"
  value       = google_service_account.karma_runner.email
}

output "dt_api_token_secret_name" {
  description = "Secret Manager resource name for the Dynatrace token"
  value       = google_secret_manager_secret.dt_api_token.name
}

output "api_secret_key_secret_name" {
  description = "Secret Manager resource name for the API secret key"
  value       = google_secret_manager_secret.api_secret_key.name
}
