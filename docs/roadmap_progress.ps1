# Atualiza a tabela de progresso de docs/ROADMAP.md contando checkboxes por fase.
# Uso: powershell -File docs/roadmap_progress.ps1
$path = Join-Path $PSScriptRoot 'ROADMAP.md'
$lines = Get-Content -LiteralPath $path -Encoding UTF8
$phases = [ordered]@{}   # id -> @{name; done; total}
$cur = $null
foreach ($l in $lines) {
  if ($l -match '^## (v\d+\.\d+) — (.+)$') {
    $cur = $Matches[1]
    $name = ($Matches[2] -replace '[🔮]', '').Trim()
    $phases[$cur] = @{ name = $name; done = 0; total = 0; future = ($l -match '🔮') }
  } elseif ($cur -and $l -match '^- \[( |x|X)\] ') {
    $phases[$cur].total++
    if ($Matches[1] -ne ' ') { $phases[$cur].done++ }
  }
}
$rows = @('| Fase | Nome | Feitas | Total | % | Estado |', '|---|---|---:|---:|---:|---|')
$td = 0; $tt = 0
foreach ($k in $phases.Keys) {
  $p = $phases[$k]; $pct = if ($p.total) { [math]::Round(100 * $p.done / $p.total) } else { 0 }
  $state = if ($p.future) { '🔮 futuro opcional' } elseif ($p.done -eq $p.total -and $p.total -gt 0) { '✅ concluída' } elseif ($p.done -gt 0) { '🚧 em andamento' } else { '⏳ não iniciada' }
  $rows += "| $k | $($p.name) | $($p.done) | $($p.total) | $pct% | $state |"
  if (-not $p.future) { $td += $p.done; $tt += $p.total }
}
$gp = if ($tt) { [math]::Round(100 * $td / $tt) } else { 0 }
$rows += "| **Total (sem v1.0)** | | **$td** | **$tt** | **$gp%** | |"
$out = New-Object System.Collections.Generic.List[string]
$skip = $false
foreach ($l in $lines) {
  if ($l -match 'PROGRESS:START') { $out.Add($l); $rows | ForEach-Object { $out.Add($_) }; $skip = $true; continue }
  if ($l -match 'PROGRESS:END') { $skip = $false }
  if (-not $skip) { $out.Add($l) }
}
[System.IO.File]::WriteAllLines($path, $out, (New-Object System.Text.UTF8Encoding($false)))
$rows | ForEach-Object { Write-Host $_ }
