# ── Enable required APIs ────────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "aiplatform.googleapis.com",
    "run.googleapis.com",
    "firestore.googleapis.com",
    "pubsub.googleapis.com",
    "cloudscheduler.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "redis.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ── Artifact Registry ───────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "karma" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repo
  description   = "Karma Docker images"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# ── Secret Manager — Dynatrace token ────────────────────────────────────────

resource "google_secret_manager_secret" "dt_api_token" {
  project   = var.project_id
  secret_id = "dt-api-token"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "dt_api_token" {
  secret      = google_secret_manager_secret.dt_api_token.id
  secret_data = var.dt_api_token
}

resource "google_secret_manager_secret" "api_secret_key" {
  project   = var.project_id
  secret_id = "api-secret-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "api_secret_key" {
  secret      = google_secret_manager_secret.api_secret_key.id
  secret_data = var.api_secret_key
}

# ── Pub/Sub — Watcher → Forensic trigger ────────────────────────────────────

resource "google_pubsub_topic" "violations" {
  project = var.project_id
  name    = "karma-violations"

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_subscription" "forensic_trigger" {
  project = var.project_id
  name    = "karma-forensic-trigger"
  topic   = google_pubsub_topic.violations.name

  ack_deadline_seconds       = 300
  message_retention_duration = "600s"

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "60s"
  }
}

# ── Cloud Scheduler — Watcher heartbeat ─────────────────────────────────────

resource "google_cloud_scheduler_job" "watcher" {
  project  = var.project_id
  region   = var.region
  name     = "karma-watcher-heartbeat"
  schedule = "*/10 * * * *"  # every 10 minutes
  time_zone = "UTC"

  http_target {
    uri         = "${var.api_url}/cutover/watchers/run-now"
    http_method = "POST"
    body        = base64encode(jsonencode({}))
    headers = {
      "Content-Type" = "application/json"
    }
  }

  depends_on = [google_project_service.apis]
}

# ── Service account for Cloud Run ────────────────────────────────────────────

resource "google_service_account" "karma_runner" {
  project      = var.project_id
  account_id   = "karma-runner"
  display_name = "Karma Cloud Run Service Account"
}

resource "google_project_iam_member" "karma_runner_roles" {
  for_each = toset([
    "roles/datastore.user",
    "roles/aiplatform.user",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
    "roles/storage.objectAdmin",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.karma_runner.email}"
}

# ── GCS staging bucket — Agent Engine upload staging ─────────────────────────

resource "google_storage_bucket" "agent_staging" {
  project                     = var.project_id
  name                        = "${var.project_id}-agent-staging"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  lifecycle_rule {
    condition { age = 7 }
    action    { type = "Delete" }
  }

  depends_on = [google_project_service.apis]
}
