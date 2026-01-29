# Release Tag Creation Script
# Compares package.json version with latest GitHub release and creates tag if newer

$ErrorActionPreference = "Stop"

# Safety Check: Verify current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
$expectedBranch = "main"

if ($currentBranch -ne $expectedBranch) {
    Write-Host "Error: You are on branch '$currentBranch', but this script expects '$expectedBranch'" -ForegroundColor Red
    Write-Host "Please switch to '$expectedBranch' before running this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Confirmed on branch: $currentBranch" -ForegroundColor Green

# Read version from package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "Current package.json version: $currentVersion" -ForegroundColor Cyan

# Get latest release version from GitHub
Write-Host "Fetching latest release from GitHub..." -ForegroundColor Cyan
$latestRelease = gh release list --limit 1 --json tagName | ConvertFrom-Json

if ($latestRelease -and $latestRelease.Count -gt 0) {
    $latestTag = $latestRelease[0].tagName
    # Remove 'v' prefix if present
    $latestVersion = $latestTag -replace '^v', ''
    Write-Host "Latest GitHub release: $latestVersion" -ForegroundColor Cyan
} else {
    Write-Host "No releases found on GitHub. Proceeding with tag creation." -ForegroundColor Yellow
    $latestVersion = "0.0.0"
}

# Compare versions
function Compare-Versions {
    param (
        [string]$version1,
        [string]$version2
    )
    
    $v1Parts = $version1.Split('.') | ForEach-Object { [int]$_ }
    $v2Parts = $version2.Split('.') | ForEach-Object { [int]$_ }
    
    for ($i = 0; $i -lt 3; $i++) {
        if ($v1Parts[$i] -gt $v2Parts[$i]) { return 1 }
        if ($v1Parts[$i] -lt $v2Parts[$i]) { return -1 }
    }
    return 0
}

$comparison = Compare-Versions $currentVersion $latestVersion

if ($comparison -le 0) {
    Write-Host "Current version ($currentVersion) is not newer than latest release ($latestVersion)." -ForegroundColor Red
    Write-Host "Skipping tag creation." -ForegroundColor Yellow
    exit 0
}

Write-Host "Current version ($currentVersion) is newer than latest release ($latestVersion)." -ForegroundColor Green
Write-Host "Creating and pushing tag..." -ForegroundColor Green

# Create annotated tag
$tagName = "v$currentVersion"
$tagMessage = "Release v$currentVersion"

Write-Host "Creating tag: $tagName" -ForegroundColor Cyan
git tag -a $tagName -m $tagMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create tag." -ForegroundColor Red
    exit 1
}

# Push tag to remote
Write-Host "Pushing tag to origin..." -ForegroundColor Cyan
git push origin $tagName

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push tag." -ForegroundColor Red
    exit 1
}

Write-Host "Successfully created and pushed tag: $tagName" -ForegroundColor Green
