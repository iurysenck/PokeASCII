# Inicia o Servidor Híbrido (HTTP + HTTPS p/ iPhone + API de Save/Balanceamento/Bugs)!
$serverScript = Join-Path $PSScriptRoot "server\api_server.py"
$portHttp     = 8088
$portHttps    = 8443

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host " POKEASCII GO 3D AR - SERVIDOR UNIVERSAL (PC, ANDROID & IPHONE HTTPS)" -ForegroundColor Green
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host " 1. Jogar no PC:               http://localhost:$portHttp" -ForegroundColor Yellow
Write-Host " 2. Painel Admin Balanceamento: http://localhost:$portHttp/admin.html" -ForegroundColor Magenta

$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169\." }
foreach ($ip in $ips) {
    Write-Host (" 3. No Android (Wi-Fi):        http://{0}:{1}" -f $ip.IPAddress, $portHttp) -ForegroundColor Green
    Write-Host (" 4. No iPhone Chrome/Safari:   https://{0}:{1}  (Aceite o certificado local p/ liberar câmera!)" -f $ip.IPAddress, $portHttps) -ForegroundColor Cyan
}
Write-Host "==================================================================================" -ForegroundColor Cyan

Start-Process "http://localhost:$portHttp"
python "$serverScript"
