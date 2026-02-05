# create_pr.ps1
# Create PR only (base: main, title/body: --fill). No CI wait, no merge.

$ErrorActionPreference = "Stop"

function Fail($msg) {
    Write-Host "Error: $msg" -ForegroundColor Red
    exit 1
}
function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Info($msg) { Write-Host $msg -ForegroundColor Cyan }

# --- Constants ---
$BaseBranch = "main"

# --- Tool checks ---
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "git not found in PATH." }
if (-not (Get-Command gh  -ErrorAction SilentlyContinue)) { Fail "gh (GitHub CLI) not found in PATH." }

# gh auth status (fail fast)
gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Fail "gh is not authenticated. Run: gh auth login" }

# --- Safety: current branch must not be main ---
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $currentBranch) { Fail "Could not determine current branch." }

if ($currentBranch -eq $BaseBranch) {
    Fail "This script must NOT be run on '$BaseBranch' branch. Current: '$currentBranch'"
}
Ok "Running on branch: $currentBranch"

# --- Clean working tree ---
$gitStatus = git status --porcelain
if ($gitStatus) { Fail "You have uncommitted changes. Commit or stash first." }
Ok "Working directory is clean"

# --- Ensure remote branch exists (push if needed) ---
# If upstream is not set, set it by pushing with -u.
$upstream = (git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null).Trim()
if (-not $upstream) {
    Info "No upstream set. Pushing branch and setting upstream..."
    git push -u origin $currentBranch
    if ($LASTEXITCODE -ne 0) { Fail "Failed to push branch to origin." }
    Ok "Pushed branch and set upstream."
} else {
    # Push latest commits (idempotent; if nothing to push, it's fine)
    Info "Pushing latest commits..."
    git push
    if ($LASTEXITCODE -ne 0) { Fail "Failed to push branch to origin." }
    Ok "Branch pushed."
}

# --- Check if PR already exists (head=current, base=main) ---
Info "Checking existing PR (head: $currentBranch -> base: $BaseBranch)..."
$existing = gh pr list --head $currentBranch --base $BaseBranch --json number,url --jq '.[0]' 2>$null

if ($existing -and $existing.Trim() -ne "null" -and $existing.Trim() -ne "") {
    $existingObj = $existing | ConvertFrom-Json
    Ok "Pull request already exists: #$($existingObj.number)"
    Ok "URL: $($existingObj.url)"
    exit 0
}

# --- Create new PR ---
Info "Creating PR (head: $currentBranch -> base: $BaseBranch)..."

$prResult = gh pr create --base $BaseBranch --fill 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    # Check if PR was created despite the exit code (--web might behave differently)
    if ($prResult -match "https://github\.com/.*/pull/\d+") {
        Ok "Pull request created: $prResult"
        exit 0
    }
    Fail "Failed to create PR. gh pr create returned exit code $exitCode. Output: $prResult"
}

# Parse the PR URL from output
if ($prResult -match "https://github\.com/.*/pull/\d+") {
    Ok "Pull request created: $prResult"
} else {
    Ok "Pull request created successfully"
}
