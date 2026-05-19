# Workload Identity Federation setup for Karma GitHub Actions CI/CD.
#
# Runs all six gcloud steps then writes GCP_WORKLOAD_IDENTITY_PROVIDER and
# GCP_SERVICE_ACCOUNT directly into your GitHub repo secrets via the gh CLI.
#
# Prerequisites:
#   gcloud   - authenticated (gcloud auth login)
#   gh       - authenticated (gh auth login) and pointed at rogerjeasy/karma
#
# Usage (from repo root):
#   .\infrastructure\setup-wif.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PROJECT       = "skillbridge-76a4c"
$PROJECT_NUM   = "957527396263"
$SA_NAME       = "karma-deployer"
$SA_EMAIL      = "$SA_NAME@$PROJECT.iam.gserviceaccount.com"
$POOL_NAME     = "karma-github-pool"
$PROVIDER_NAME = "karma-github-provider"
$GITHUB_REPO   = "rogerjeasy/karma"

function ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function info { param($msg) Write-Host "  -->  $msg" -ForegroundColor Cyan }
function warn { param($msg) Write-Host "  [!]  $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "=== Karma -- Workload Identity Federation Setup ===" -ForegroundColor Magenta
Write-Host ""

# ── Step 1: Create deployer service account ───────────────────────────────────
info "Step 1: Create service account $SA_NAME"
$existing = $false
try {
    $saCheck = gcloud iam service-accounts list --project=$PROJECT --filter="email:$SA_EMAIL" --format="value(email)" 2>$null
    if ($saCheck) { $existing = $true }
} catch { $existing = $false }

if ($existing) {
    warn "Service account already exists -- skipping."
} else {
    gcloud iam service-accounts create $SA_NAME --display-name="Karma GitHub Actions deployer" --project=$PROJECT | Out-Null
    ok "Created: $SA_EMAIL"
}

# ── Step 2: Grant IAM roles ───────────────────────────────────────────────────
info "Step 2: Grant IAM roles"
$roles = @(
    "roles/artifactregistry.writer",
    "roles/run.admin",
    "roles/aiplatform.user",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountTokenCreator"
)
foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA_EMAIL" --role=$role --condition=None | Out-Null
    ok $role
}
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser" --project=$PROJECT | Out-Null
ok "roles/iam.serviceAccountUser (self-binding)"

# ── Step 3: Create Workload Identity Pool ─────────────────────────────────────
info "Step 3: Create Workload Identity Pool"
$poolExists = $false
try {
    $null = gcloud iam workload-identity-pools describe $POOL_NAME --location=global --project=$PROJECT --format="value(name)" 2>$null
    if ($LASTEXITCODE -eq 0) { $poolExists = $true }
} catch { $poolExists = $false }

if ($poolExists) {
    warn "Pool already exists -- skipping."
} else {
    gcloud iam workload-identity-pools create $POOL_NAME --location=global --display-name="Karma GitHub Actions pool" --project=$PROJECT | Out-Null
    ok "Pool created."
}

# ── Step 4: Create OIDC provider ─────────────────────────────────────────────
info "Step 4: Create OIDC provider"
$providerExists = $false
try {
    $null = gcloud iam workload-identity-pools providers describe $PROVIDER_NAME --location=global --workload-identity-pool=$POOL_NAME --project=$PROJECT --format="value(name)" 2>$null
    if ($LASTEXITCODE -eq 0) { $providerExists = $true }
} catch { $providerExists = $false }

if ($providerExists) {
    warn "Provider already exists -- skipping."
} else {
    gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME --location=global --workload-identity-pool=$POOL_NAME --display-name="GitHub OIDC provider" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" --attribute-condition="assertion.repository=='$GITHUB_REPO'" --issuer-uri="https://token.actions.githubusercontent.com" --project=$PROJECT | Out-Null
    ok "Provider created."
}

# ── Step 5: Allow GitHub repo to impersonate the SA ──────────────────────────
info "Step 5: Bind GitHub repo $GITHUB_REPO to service account"
$principal = "principalSet://iam.googleapis.com/projects/$PROJECT_NUM/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$GITHUB_REPO"
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL --role="roles/iam.workloadIdentityUser" --member=$principal --project=$PROJECT | Out-Null
ok "Binding created."

# ── Step 6: Get provider resource name ───────────────────────────────────────
info "Step 6: Fetch provider resource name"
$WIF_PROVIDER = gcloud iam workload-identity-pools providers describe $PROVIDER_NAME --location=global --workload-identity-pool=$POOL_NAME --project=$PROJECT --format="value(name)"
ok "Provider: $WIF_PROVIDER"

# ── Step 7: Set GitHub secrets ────────────────────────────────────────────────
Write-Host ""
info "Step 7: Write secrets to GitHub repo"
$ghAvailable = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)

if ($ghAvailable) {
    $WIF_PROVIDER | gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo=$GITHUB_REPO
    ok "GCP_WORKLOAD_IDENTITY_PROVIDER set."
    $SA_EMAIL | gh secret set GCP_SERVICE_ACCOUNT --repo=$GITHUB_REPO
    ok "GCP_SERVICE_ACCOUNT set."

    info "Step 8: Create GitHub Actions 'production' environment"
    gh api --method PUT "repos/$GITHUB_REPO/environments/production" | Out-Null
    ok "Environment 'production' ready."
} else {
    warn "gh CLI not found -- set secrets manually (see instructions below)."
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host ""
Write-Host "Secrets written to github.com/$GITHUB_REPO :"
Write-Host "  GCP_WORKLOAD_IDENTITY_PROVIDER = $WIF_PROVIDER"
Write-Host "  GCP_SERVICE_ACCOUNT            = $SA_EMAIL"
Write-Host ""
if (-not $ghAvailable) {
    Write-Host "  gh CLI not installed. Set these two secrets manually:" -ForegroundColor Yellow
    Write-Host "  GitHub -> Settings -> Secrets and variables -> Actions -> Secrets"
    Write-Host ""
    Write-Host "  Name : GCP_WORKLOAD_IDENTITY_PROVIDER"
    Write-Host "  Value: $WIF_PROVIDER"
    Write-Host ""
    Write-Host "  Name : GCP_SERVICE_ACCOUNT"
    Write-Host "  Value: $SA_EMAIL"
    Write-Host ""
    Write-Host "  Also create a GitHub Actions environment named 'production':"
    Write-Host "  GitHub -> Settings -> Environments -> New environment -> production"
    Write-Host ""
    Write-Host "  To install gh CLI: winget install GitHub.cli"
    Write-Host ""
}
Write-Host "After first API deploy, set API_BASE_URL:"
Write-Host "  gh variable set API_BASE_URL --body '<cloud-run-url>' --repo=$GITHUB_REPO"
Write-Host ""
