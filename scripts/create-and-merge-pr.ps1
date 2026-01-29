# Create PR and Merge After CI Success
# Creates a pull request, waits for CI to pass, then merges

$ErrorActionPreference = "Stop"

# Safety Check: Verify current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
$expectedBranch = "develop"

if ($currentBranch -ne $expectedBranch) {
    Write-Host "Error: You are on branch '$currentBranch', but this script expects '$expectedBranch'" -ForegroundColor Red
    Write-Host "Please switch to '$expectedBranch' before running this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Confirmed on branch: $currentBranch" -ForegroundColor Green

# Check if there are any uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Error: You have uncommitted changes. Please commit or stash them first." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Working directory is clean" -ForegroundColor Green

Write-Host "Creating pull request..." -ForegroundColor Cyan

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

Write-Host "PR Number: $prNumber" -ForegroundColor Green

# Wait for CI to complete
Write-Host "Waiting for CI checks to complete..." -ForegroundColor Cyan
$maxAttempts = 120  # 2 hours with 60 second intervals
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $prStatus = gh pr view $prNumber --json statusCheckRollup | ConvertFrom-Json

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to get PR status." -ForegroundColor Red
        $attempt++
        Start-Sleep -Seconds 60
        continue
    }

    $rollup = $prStatus.statusCheckRollup

    if ($rollup.Count -eq 0) {
        Write-Host "No checks found yet. Waiting..." -ForegroundColor Yellow
        $attempt++
        Start-Sleep -Seconds 60
        continue
    }

    # Check rollup states
    $states = $rollup | Select-Object -ExpandProperty state -ErrorAction SilentlyContinue

    # Check if all checks are complete (no PENDING states)
    $hasPending = $states -contains "PENDING"
    
    if (-not $hasPending) {
        # All checks are complete, check if all passed
        $hasFailed = $states -contains "FAILURE"

        Write-Host "Checks complete!" -ForegroundColor Green
        Write-Host ""

        # Display check results
        foreach ($check in $rollup) {
            $statusSymbol = if ($check.state -eq "SUCCESS") { "[OK]" } else { "[NG]" }
            $color = if ($check.state -eq "SUCCESS") { "Green" } else { "Red" }
            Write-Host "$statusSymbol $($check.name): $($check.state) (conclusion: $($check.conclusion))" -ForegroundColor $color
        }

        if (-not $hasFailed) {
            Write-Host "All checks passed!" -ForegroundColor Green
            break
        } else {
            Write-Host "CI checks failed. Aborting merge." -ForegroundColor Red
            Write-Host "Please review the PR: https://github.com/$(git config --get remote.origin.url | sed 's/.*:\|\.git$//g')/pull/$prNumber" -ForegroundColor Yellow
            exit 1
        }
    } else {
        $pendingChecks = ($rollup | Where-Object { $_.state -eq "PENDING" }).name -join ", "
        Write-Host "Still waiting for: $pendingChecks" -ForegroundColor Yellow
        $attempt++
        Start-Sleep -Seconds 60
    }
}

if ($attempt -eq $maxAttempts) {
    Write-Host "Timeout waiting for CI checks. Aborting merge." -ForegroundColor Red
    Write-Host "Please review the PR: https://github.com/$(git config --get remote.origin.url | sed 's/.*:\|\.git$//g')/pull/$prNumber" -ForegroundColor Yellow
    exit 1
}

# Merge the PR
Write-Host "Merging pull request..." -ForegroundColor Cyan
gh pr merge $prNumber --squash

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to merge pull request." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Pull request merged successfully!" -ForegroundColor Green
Write-Host "Merged PR #$prNumber into main" -ForegroundColor Green
