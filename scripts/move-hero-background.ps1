# Move hero_background.png from project root to public/ if present (e.g. after git pull).
$root = Join-Path $PSScriptRoot ".."
$src = Join-Path $root "hero_background.png"
$dest = Join-Path $root "public\hero_background.png"
if (Test-Path $src) {
  Move-Item -Path $src -Destination $dest -Force
  Write-Host "Moved hero_background.png to public/"
} else {
  Write-Host "hero_background.png not in root (already in public/ or not pulled yet)."
}
