# PowerShell wrapper for setup-dynatrace.sh
# Usage: .\infrastructure\setup-dynatrace.ps1 [setup|verify-tools|verify-events]
param([string]$Command = "help")

$gitBash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $gitBash)) {
    Write-Error "Git Bash not found at $gitBash. Install Git for Windows or run the .sh script directly in Git Bash."
    exit 1
}

$repo = $PSScriptRoot | Split-Path -Parent
& $gitBash -c "cd '$($repo -replace '\\','/')' && ./infrastructure/setup-dynatrace.sh $Command"
