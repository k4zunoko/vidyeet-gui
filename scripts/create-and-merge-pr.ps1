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

# Wait for CI checks to be registered (initial delay)
Write-Host "Waiting for CI checks to be registered..." -ForegroundColor Cyan
$maxRetries = 30
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    # Suppress error output temporarily to avoid exception when checks not yet registered
    $ErrorActionPreference = "SilentlyContinue"
    $checkStatus = gh pr checks $prNumber --json name --jq 'length' 2>$null
    $lastExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    
    if ($lastExitCode -eq 0 -and $checkStatus -gt 0) {
        Write-Host "OK" -ForegroundColor Green
        break
    }
    $retryCount++
    if ($retryCount -lt $maxRetries) {
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Seconds 2
    }
}

if ($retryCount -eq $maxRetries) {
    Write-Host "`nWarning: CI checks not registered after 60 seconds. Proceeding anyway..." -ForegroundColor Yellow
}

# Wait for CI checks to complete using --watch
Write-Host "Waiting for CI checks to complete..." -ForegroundColor Cyan
gh pr checks $prNumber --watch

if ($LASTEXITCODE -ne 0) {
    Write-Host "CI checks failed or timed out. Aborting merge." -ForegroundColor Red
    # Extract GitHub repo path from remote URL (handles both https:// and git@ formats)
    $repoUrl = git config --get remote.origin.url
    # Match github.com followed by : or /, then capture user/repo path
    $repoPath = $repoUrl -replace '^.*github\.com[/:]', '' -replace '\.git$', ''
    Write-Host "Please review the PR: https://github.com/$repoPath/pull/$prNumber" -ForegroundColor Yellow
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

Write-Host "Pruning stale remote branches..." -ForegroundColor Cyan
git fetch --prune

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Could not prune remote branches." -ForegroundColor Yellow
}

# Clean up local branch
Write-Host "Cleaning up local branch..." -ForegroundColor Cyan
git branch -d $currentBranch

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Could not delete local branch '$currentBranch'. It may have unmerged commits." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Local branch '$currentBranch' deleted" -ForegroundColor Green
}
