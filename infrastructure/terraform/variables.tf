variable "project_id" {
  type        = string
  description = "Google Cloud project ID"
  default     = "skillbridge-76a4c"
}

variable "region" {
  type        = string
  description = "Primary GCP region"
  default     = "us-central1"
}

variable "artifact_registry_repo" {
  type        = string
  description = "Artifact Registry repository name"
  default     = "karma-images"
}

variable "ci_service_account" {
  type        = string
  description = "GitHub Actions CI service account email (e.g. github-actions@PROJECT.iam.gserviceaccount.com). Needs storage.admin to create/use the Agent Engine staging bucket."
  default     = ""
}

variable "api_url" {
  type        = string
  description = "Cloud Run URL of the karma-api service — set after first deploy, e.g. https://karma-api-xxxx-uc.a.run.app"
  default     = ""
}

variable "dt_api_token" {
  type        = string
  description = "Dynatrace Platform Token — stored in Secret Manager, never in state plain-text (sensitive)"
  sensitive   = true
}

variable "api_secret_key" {
  type        = string
  description = "Random hex secret for FastAPI JWT signing — generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
  sensitive   = true
}

variable "firestore_location" {
  type        = string
  description = "Firestore location (e.g. nam5, eur3, europe-west6)"
  default     = "nam5"
}

variable "payments_v2_url" {
  type        = string
  description = "Cloud Run URL of karma-svc-payments-v2 — used by the load generator job"
  default     = ""
}

variable "reporting_url" {
  type        = string
  description = "Cloud Run URL of karma-svc-reporting — used by the load generator job"
  default     = ""
}
