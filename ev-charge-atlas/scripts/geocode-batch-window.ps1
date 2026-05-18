# 100'er batch Photon geocode; pencere açık kalır, ilerlemeyi buradan izleyin.
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

function Get-RemainingCount {
  $jsonPath = 'public/data/stations.geocoded.json'
  $rows = Get-Content $jsonPath -Raw | ConvertFrom-Json
  $remaining = 0
  foreach ($r in $rows) {
    $lat = 0.0
    $lng = 0.0
    $latOk = [double]::TryParse([string]$r.lat, [ref]$lat) -and [math]::Abs($lat) -le 90
    $lngOk = [double]::TryParse([string]$r.lng, [ref]$lng) -and [math]::Abs($lng) -le 180
    if (-not ($latOk -and $lngOk)) { $remaining++ }
  }
  return $remaining
}

Write-Host "Klasör: $(Get-Location)" -ForegroundColor Gray
Write-Host "Her tur: npm run geocode:batch100 (max 100 adres). Durdurmak için Ctrl+C." -ForegroundColor Gray
Write-Host ""

$maxBatches = 200
for ($batch = 1; $batch -le $maxBatches; $batch++) {
  Write-Host "=== Batch $batch / $maxBatches (100 kayıt) ===" -ForegroundColor Cyan
  npm run geocode:batch100
  if ($LASTEXITCODE -ne 0) {
    Write-Host "npm hata kodu: $LASTEXITCODE" -ForegroundColor Red
    Read-Host "Çıkmak için Enter"
    exit $LASTEXITCODE
  }
  $remaining = Get-RemainingCount
  Write-Host "Kalan koordinatsız: $remaining" -ForegroundColor Yellow
  if ([int]$remaining -le 0) {
    Write-Host "Tüm kayıtlar koordinatlı görünüyor (veya script sınırı)." -ForegroundColor Green
    Read-Host "Kapatmak için Enter"
    exit 0
  }
  Start-Sleep -Seconds 2
}

Write-Host "200 batch tamamlandı; hâlâ kalan varsa bu scripti yeniden çalıştırın." -ForegroundColor Yellow
Read-Host "Kapatmak için Enter"
