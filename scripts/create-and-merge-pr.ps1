# Create PR and Merge After CI Success
# Creates a pull request, waits for CI to pass, then merges

$ErrorActionPreference = "Stop"

# Safety Check: Verify current branch
$currentBranch = git rev-parse --abbrev-ref HEAD

# Allow running from any branch EXCEPT main. If on main, abort to avoid accidental operations.
if ($currentBranch -eq "main") {
    Write-Host "Error: This script must NOT be run on 'main' branch. Current branch: '$currentBranch'" -ForegroundColor Red
    Write-Host "Please switch to a feature or integration branch before running this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Running on branch: $currentBranch" -ForegroundColor Green

# Check if there are any uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Error: You have uncommitted changes. Please commit or stash them first." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Working directory is clean" -ForegroundColor Green

Write-Host "Creating pull request..." -ForegroundColor Cyan

# Check if PR already exists
$existingPrOutput = gh pr list --head $currentBranch --base main --json number --jq '.[0].number' 2>&1
$existingPrNumber = $existingPrOutput

if ($existingPrNumber -and $existingPrNumber -match '^\d+$') {
    Write-Host "[OK] Pull request already exists: #$existingPrNumber" -ForegroundColor Green
    $prNumber = $existingPrNumber
} else {
    # Create the PR with auto-fill
    $prOutput = gh pr create --base main --head $currentBranch --fill

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create pull request." -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Pull request created" -ForegroundColor Green
    Write-Host $prOutput

    # Extract PR number from output
    $prUrl = $prOutput
    $prNumber = [regex]::Match($prUrl, 'pull/(\d+)').Groups[1].Value

    if (-not $prNumber) {
        Write-Host "Error: Could not extract PR number from response." -ForegroundColor Red
        exit 1
    }
}

Write-Host "PR Number: $prNumber" -ForegroundColor Green

# Wait for CI checks to complete
# Use --watch with longer timeout to handle registration delay
Write-Host "Waiting for CI checks to complete..." -ForegroundColor Cyan
$ErrorActionPreference = "SilentlyContinue"
gh pr checks $prNumber --watch --interval 5
$ErrorActionPreference = "Stop"

# Check final status using GitHub API (more reliable than --watch)
$statusJson = gh pr view $prNumber --json statusCheckRollup
$statusCheckRollup = $statusJson | ConvertFrom-Json | Select-Object -ExpandProperty statusCheckRollup

# Determine if all checks passed
$hasFailures = $statusCheckRollup | Where-Object { $_.conclusion -eq "FAILURE" }
$hasIncomplete = $statusCheckRollup | Where-Object { $_.status -ne "COMPLETED" }

if ($hasFailures) {
    Write-Host "`nCI checks failed." -ForegroundColor Red
    exit 1
}

if ($hasIncomplete) {
    Write-Host "`nCI checks did not complete." -ForegroundColor Red
    exit 1
}

Write-Host "All checks passed!" -ForegroundColor Green

# Merge the PR
Write-Host "Merging pull request..." -ForegroundColor Cyan
gh pr merge $prNumber --squash --delete-branch

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to merge pull request." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Pull request merged successfully!" -ForegroundColor Green
Write-Host "Merged PR #$prNumber into main" -ForegroundColor Green

# Switch to main and sync
Write-Host "Switching to main branch..." -ForegroundColor Cyan
git switch main

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Could not switch to main branch." -ForegroundColor Yellow
}

Write-Host "Pulling latest changes..." -ForegroundColor Cyan
git pull --ff-only

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Could not pull changes. Repository may have diverged." -ForegroundColor Yellow
}

Write-Host "Done!" -ForegroundColor Green
