# GitHub Actions Setup

Status of all repository variables, secrets, and GCP resources required for the four CI/CD workflows.

---

## Repository Variables (`vars.*`)

Set in **GitHub → Settings → Secrets and variables → Actions → Variables**.

| Variable | Value | Status |
|---|---|---|
| `GCP_PROJECT_ID` | `skillbridge-76a4c` | ✅ Done |
| `GCP_LOCATION` | `us-central1` | ✅ Done |
| `FIREBASE_PROJECT_ID` | `gptuesser-firebase` | ✅ Done |
| `FIREBASE_AUTH_DOMAIN` | `gptuesser-firebase.firebaseapp.com` | ✅ Done |
| `FIREBASE_STORAGE_BUCKET` | `gptuesser-firebase.appspot.com` | ✅ Done |
| `API_BASE_URL` | Cloud Run URL, e.g. `https://karma-api-xxxx-uc.a.run.app` | ⏳ Set after first API deploy |

---

## Repository Secrets (`secrets.*`)

Set in **GitHub → Settings → Secrets and variables → Actions → Secrets**.

| Secret | Source | Status |
|---|---|---|
| `FIREBASE_API_KEY` | Firebase console → Project settings → Your apps | ✅ Done |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase console → Project settings → Your apps | ✅ Done |
| `FIREBASE_APP_ID` | Firebase console → Project settings → Your apps | ✅ Done |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GCP WIF setup (see below) | ⏳ Pending |
| `GCP_SERVICE_ACCOUNT` | GCP WIF setup (see below) | ⏳ Pending |

---

## GCP Secret Manager Secrets

Required by the API Cloud Run deployment (`deploy-api.yml`):

```yaml
--set-secrets=DT_API_TOKEN=dt-api-token:latest,API_SECRET_KEY=api-secret-key:latest
```

**These were created automatically by `terraform apply`** using the values from
`infrastructure/terraform/terraform.tfvars`. No manual setup needed.

| Secret Manager secret | Used by | Purpose | Status |
|---|---|---|---|
| `dt-api-token` | agents → MCP gateway | Platform Token (Bearer auth) | ✅ Done (Terraform) |
| `dt-otel-token` | agents + api | Classic token: OTel, BizEvents, SLO, Events ingest | ✅ Done (Terraform) |
| `dt-query-token` | api → agent observability | Classic token: Grail `storage:spans:read` | ✅ Done (Terraform) |
| `api-secret-key` | `deploy-api.yml` → Cloud Run | API signing secret | ✅ Done (Terraform) |
| `github-token` | api → deployment metrics | Fine-grained PAT (Contents:read, PRs:read) | ✅ Done (Terraform) |

---

## Workload Identity Federation (WIF) Setup

Required to populate `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`.

WIF lets GitHub Actions authenticate to GCP without a long-lived service account key file.

### Step 1 — Create a service account

```bash
gcloud iam service-accounts create karma-deployer \
  --display-name="Karma GitHub Actions deployer" \
  --project=skillbridge-76a4c
```

### Step 2 — Grant the service account the required roles

```bash
SA=karma-deployer@skillbridge-76a4c.iam.gserviceaccount.com
PROJECT=skillbridge-76a4c

# Push images to Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"

# Deploy to Cloud Run
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/run.admin"

# Deploy to Agent Engine (Vertex AI)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"

# Read secrets from Secret Manager
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"

# Allow the service account to act as itself (required for Cloud Run deploy)
gcloud iam service-accounts add-iam-policy-binding $SA \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"
```

### Step 3 — Create a Workload Identity Pool

```bash
gcloud iam workload-identity-pools create karma-github-pool \
  --location="global" \
  --display-name="Karma GitHub Actions pool" \
  --project=skillbridge-76a4c
```

### Step 4 — Create a provider inside the pool

```bash
gcloud iam workload-identity-pools providers create-oidc karma-github-provider \
  --location="global" \
  --workload-identity-pool="karma-github-pool" \
  --display-name="GitHub OIDC provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --project=skillbridge-76a4c
```

### Step 5 — Allow the GitHub repo to impersonate the service account

Replace `rogerjeasy/karma` with your actual GitHub org/repo if different.

```bash
gcloud iam service-accounts add-iam-policy-binding \
  karma-deployer@skillbridge-76a4c.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe skillbridge-76a4c --format='value(projectNumber)')/locations/global/workloadIdentityPools/karma-github-pool/attribute.repository/rogerjeasy/karma" \
  --project=skillbridge-76a4c
```

### Step 6 — Get the values for GitHub secrets

```bash
# GCP_WORKLOAD_IDENTITY_PROVIDER
gcloud iam workload-identity-pools providers describe karma-github-provider \
  --location="global" \
  --workload-identity-pool="karma-github-pool" \
  --project=skillbridge-76a4c \
  --format="value(name)"

# GCP_SERVICE_ACCOUNT (just the email)
echo "karma-deployer@skillbridge-76a4c.iam.gserviceaccount.com"
```

Add the output of the first command as `GCP_WORKLOAD_IDENTITY_PROVIDER` and the email as `GCP_SERVICE_ACCOUNT` in GitHub secrets.

---

## Summary Checklist

- [x] `GCP_PROJECT_ID` variable set
- [x] `GCP_LOCATION` variable set
- [x] `FIREBASE_PROJECT_ID` variable set
- [x] `FIREBASE_AUTH_DOMAIN` variable set
- [x] `FIREBASE_STORAGE_BUCKET` variable set
- [x] `FIREBASE_API_KEY` secret set
- [x] `FIREBASE_MESSAGING_SENDER_ID` secret set
- [x] `FIREBASE_APP_ID` secret set
- [x] `dt-api-token` in GCP Secret Manager (done by `terraform apply`)
- [x] `dt-otel-token` in GCP Secret Manager (done by `terraform apply`)
- [x] `dt-query-token` in GCP Secret Manager (done by `terraform apply`)
- [x] `api-secret-key` in GCP Secret Manager (done by `terraform apply`)
- [x] `github-token` in GCP Secret Manager (done by `terraform apply`)
- [ ] `GCP_WORKLOAD_IDENTITY_PROVIDER` secret set → run `.\infrastructure\setup-wif.ps1`
- [ ] `GCP_SERVICE_ACCOUNT` secret set → run `.\infrastructure\setup-wif.ps1`
- [ ] `API_BASE_URL` variable set (after first deploy)
