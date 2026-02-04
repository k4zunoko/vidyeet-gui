# prune_local_branches.ps1
# Sync main and prune local branches whose origin/<branch> is gone AND have no diff vs main.
# (Remote merge + remote delete are assumed to be done on GitHub.)

$ErrorActionPreference = "Stop"

function Fail($msg) {
    Write-Host "Error: $msg" -ForegroundColor Red
    exit 1
}
function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }

# --- Preconditions ---
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "git not found in PATH." }

# Clean working tree required (switch/pull safety)
$gitStatus = git status --porcelain
if ($gitStatus) { Fail "Working tree is not clean. Commit or stash before running." }
Ok "Working directory is clean"

# Remember where we started
$startBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $startBranch) { Fail "Could not determine current branch." }

# Switch to main if needed
if ($startBranch -ne "main") {
    Info "Switching to main..."
    git switch main
    if ($LASTEXITCODE -ne 0) { Fail "Failed to switch to main." }
}
Ok "On branch: main"

# Update main safely
Info "Pulling latest changes (ff-only)..."
git pull --ff-only
if ($LASTEXITCODE -ne 0) { Fail "git pull --ff-only failed. Resolve divergence manually." }
Ok "main updated"

# Prune remote-tracking references
Info "Fetching and pruning remote-tracking branches..."
git fetch -p
if ($LASTEXITCODE -ne 0) { Fail "git fetch -p failed." }
Ok "Remote-tracking refs pruned"

# Collect existing origin/* refs after prune
$remoteRefs = @{}
git for-each-ref refs/remotes/origin --format="%(refname:short)" | ForEach-Object {
    $name = $_.Trim()
    if ($name) { $remoteRefs[$name] = $true }
}

# Enumerate local branches with their upstream
# Format: branch|upstream
$localWithUpstream = git for-each-ref refs/heads --format="%(refname:short)|%(upstream:short)"

$candidates = New-Object System.Collections.Generic.List[string]
$risky      = New-Object System.Collections.Generic.List[string]

foreach ($line in $localWithUpstream) {
    $line = $line.Trim()
    if (-not $line) { continue }

    $parts = $line.Split("|", 2)
    $branch = $parts[0]
    $upstream = if ($parts.Length -gt 1) { $parts[1] } else { "" }

    # Skip main
    if ($branch -eq "main") { continue }

    # Only handle branches that track origin/*
    if (-not $upstream -or -not $upstream.StartsWith("origin/")) { continue }

    # If upstream still exists, keep it
    if ($remoteRefs.ContainsKey($upstream)) { continue }

    # Upstream is gone: candidate. Check if patch-equivalent to main (handles squash merges).
    git diff --quiet "main...$branch" *> $null
    if ($LASTEXITCODE -eq 0) {
        $candidates.Add($branch)
    } else {
        $risky.Add($branch)
    }
}

if ($candidates.Count -eq 0 -and $risky.Count -eq 0) {
    Ok "No local branches to prune."
    exit 0
}

if ($candidates.Count -gt 0) {
    Info "`nWill delete these local branches (upstream gone AND no diff vs main):"
    $candidates | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
} else {
    Info "`nNo safe-to-delete branches found."
}

if ($risky.Count -gt 0) {
    Info "`nNot deleting these (upstream gone BUT diff exists vs main):"
    $risky | ForEach-Object { Write-Host "  - $_" -ForegroundColor Magenta }
    Info "These may contain local-only work. Inspect manually before deleting."
}

if ($candidates.Count -eq 0) { exit 0 }

$answer = Read-Host "`nDelete the above local branches now? (y/N)"
if ($answer -ne "y" -and $answer -ne "Y") {
    Info "Cancelled."
    exit 0
}

foreach ($b in $candidates) {
    Info "Deleting local branch: $b"
    git branch -D $b
    if ($LASTEXITCODE -ne 0) { Fail "Failed to delete branch: $b" }
}
Ok "Done. Local branches pruned."
