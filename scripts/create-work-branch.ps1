# Create and Setup Work Branch
# Creates a new branch from main with proper upstream tracking
# Usage: .\scripts\create-work-branch.ps1 <branch-name>

param(
    [Parameter(Mandatory = $true)]
    [string]$BranchName
)

$ErrorActionPreference = "Stop"

# Validate branch name format
if ([string]::IsNullOrWhiteSpace($BranchName)) {
    Write-Host "Error: Branch name cannot be empty." -ForegroundColor Red
    exit 1
}

# Validate branch name (no spaces, special chars except - and _)
if ($BranchName -notmatch '^[a-zA-Z0-9_\-/]+$') {
    Write-Host "Error: Branch name contains invalid characters. Use only alphanumeric, hyphens, and underscores." -ForegroundColor Red
    exit 1
}

Write-Host "=== Create Work Branch ===" -ForegroundColor Cyan
Write-Host "Target branch: $BranchName" -ForegroundColor Cyan

# 1. Check current branch is main
Write-Host "`n[1/5] Verifying current branch..." -ForegroundColor Yellow
$currentBranch = git rev-parse --abbrev-ref HEAD

if ($currentBranch -ne "main") {
    Write-Host "Error: You must be on 'main' branch to create a work branch. Current branch: '$currentBranch'" -ForegroundColor Red
    Write-Host "Switch to main: git switch main" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Currently on main branch" -ForegroundColor Green

# 2. Check for uncommitted changes
Write-Host "`n[2/5] Checking for uncommitted changes..." -ForegroundColor Yellow
$gitStatus = git status --porcelain

if ($gitStatus) {
    Write-Host "Error: You have uncommitted changes. Please commit or stash them first." -ForegroundColor Red
    Write-Host "Run: git status" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Working directory is clean" -ForegroundColor Green

# 3. Sync with remote repository
Write-Host "`n[3/5] Syncing with remote repository..." -ForegroundColor Yellow

Write-Host "Fetching from origin..." -ForegroundColor Cyan
git fetch origin

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to fetch from origin." -ForegroundColor Red
    exit 1
}

Write-Host "Pulling latest changes..." -ForegroundColor Cyan
git pull --ff-only

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Could not pull changes. Repository may have diverged." -ForegroundColor Red
    Write-Host "Try: git pull (with merge resolution)" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Main branch is up to date with remote" -ForegroundColor Green

# 4. Create and switch to new branch
Write-Host "`n[4/5] Creating new branch '$BranchName'..." -ForegroundColor Yellow

# Check if branch already exists
$existingBranch = git branch --list $BranchName

if ($existingBranch) {
    Write-Host "Error: Branch '$BranchName' already exists locally." -ForegroundColor Red
    Write-Host "Delete existing branch or use a different name." -ForegroundColor Yellow
    exit 1
}

git checkout -b $BranchName

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create and switch to branch '$BranchName'." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Created and switched to branch: $BranchName" -ForegroundColor Green

# 5. Set upstream and prepare for work
Write-Host "`n[5/5] Setting upstream tracking..." -ForegroundColor Yellow

git push -u origin $BranchName

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to set upstream branch on origin." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Branch pushed to remote with upstream tracking" -ForegroundColor Green

# Summary
Write-Host "`n=== Work Branch Ready ===" -ForegroundColor Green
Write-Host "Branch: $BranchName" -ForegroundColor Cyan
Write-Host "Status: Ready for commits" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Make your changes" -ForegroundColor White
Write-Host "2. Commit: git commit -m 'message'" -ForegroundColor White
Write-Host "3. Push: git push" -ForegroundColor White
Write-Host "4. Create PR: .\scripts\create-and-merge-pr.ps1" -ForegroundColor White
