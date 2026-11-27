# Abre o Pokémon GO ASCII-3D AR diretamente em uma janela dedicada do Windows Terminal!
$exePath = Join-Path $PSScriptRoot "build\pokemon_ar_preview.exe"

if (-not (Test-Path $exePath)) {
    & (Join-Path $PSScriptRoot "build.ps1")
}

$wt = Get-Command "wt.exe" -ErrorAction SilentlyContinue
if ($wt) {
    Start-Process "wt.exe" -ArgumentList "--size 140,42 `"$exePath`""
} else {
    Start-Process $exePath
}
