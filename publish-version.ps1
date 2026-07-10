param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [Parameter(Mandatory = $false)]
  [string]$ReleaseDate = (Get-Date -Format 'yyyy-MM-dd')
)

$ErrorActionPreference = 'Stop'

if ($Version -notmatch '^v\d+\.\d+\.\d+$') {
  throw "Version must use semantic versioning, for example v1.2.0"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $repoRoot "versions/$Version"
$releasesDir = Join-Path $repoRoot 'releases'
$versionsFile = Join-Path $releasesDir 'versions.json'
$notesFile = Join-Path $releasesDir "$Version.md"

if (Test-Path $targetDir) {
  throw "Version folder already exists: $targetDir"
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$excludeDirs = @('.git', 'versions', 'releases', 'scripts')
$excludeFiles = @('README.md')

$robocopyArgs = @(
  $repoRoot,
  $targetDir,
  '/E',
  '/R:1',
  '/W:1',
  '/NFL',
  '/NDL',
  '/NJH',
  '/NJS',
  '/NC',
  '/NS'
)

foreach ($dir in $excludeDirs) {
  $robocopyArgs += @('/XD', (Join-Path $repoRoot $dir))
}

foreach ($file in $excludeFiles) {
  $robocopyArgs += @('/XF', $file)
}

& robocopy @robocopyArgs | Out-Null

if (-not (Test-Path $versionsFile)) {
  throw "Missing releases/versions.json"
}

$versionsJson = Get-Content $versionsFile -Raw | ConvertFrom-Json

if (-not $versionsJson.versions) {
  $versionsJson | Add-Member -NotePropertyName versions -NotePropertyValue @()
}

foreach ($entry in $versionsJson.versions) {
  if ($entry.status -eq 'current') {
    $entry.status = 'archived'
    if (-not $entry.url -or $entry.url -eq './') {
      $entry.url = "./versions/$($entry.name)/"
    }
  }
}

$newEntry = [PSCustomObject]@{
  name = $Version
  releasedOn = $ReleaseDate
  status = 'current'
  public = $true
  url = './'
  notes = "./releases/$Version.md"
}

$versionsJson.latest = $Version
$versionsJson.versions = @($versionsJson.versions + $newEntry)

$versionsJson | ConvertTo-Json -Depth 10 | Set-Content -Path $versionsFile

if (-not (Test-Path $notesFile)) {
  @"
# $Version

Release date: $ReleaseDate

## Summary

- 

## Data Changes

- 

## Testing Completed

- 

## Known Limitations

- 

## Rollback

- Restore previous root files from versions/<previous-version>/.
"@ | Set-Content -Path $notesFile
}

Write-Output "Created snapshot and release metadata for $Version"
Write-Output "Next: commit changes, create git tag $Version, and create a GitHub Release."
