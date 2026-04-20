# tg-claude.ps1 — registra este terminal con nombre, rol y cwd, luego arranca claude
param([Parameter(ValueFromRemainingArguments)]$claudeArgs)

$sidFile = "$env:TEMP\terminal-grid\$PID.sid"
if (Test-Path $sidFile) {
    $sessionId = (Get-Content $sidFile -Raw).Trim()
} elseif ($env:TERMINAL_GRID_SESSION_ID) {
    $sessionId = $env:TERMINAL_GRID_SESSION_ID
} else {
    Write-Host "[tg-claude] Session ID not found. Running claude without registration."
    claude @claudeArgs
    exit
}

$defaultName = Split-Path -Leaf (Get-Location)

$gitRoot = (git rev-parse --show-toplevel 2>$null) -replace '\\', '/'
$currentDir = (Get-Location).Path -replace '\\', '/'
$defaultRole = if ($currentDir -eq $gitRoot) { "orchestrator" } else { "agent" }

$inputName = Read-Host "[tg-claude] Session name [$defaultName]"
$agentName = if ($inputName.Trim()) { $inputName.Trim() } else { $defaultName }

$inputRole = Read-Host "[tg-claude] Role (orchestrator/agent) [$defaultRole]"
$agentRole = if ($inputRole.Trim() -in @("orchestrator", "agent")) { $inputRole.Trim() } else { $defaultRole }

$agentCwd = (Get-Location).Path

# ── Progress bar ─────────────────────────────────────────────────────────────

function Write-Bar {
    param([int]$pct)
    $width  = 36
    $filled = [int]($pct / 100.0 * $width)
    $bar    = ("=" * $filled) + ("-" * ($width - $filled))
    Write-Host ("`r[$bar] $($pct.ToString().PadLeft(3))%") -NoNewline
}

# Start registration in background so we can animate while it runs
$body = @{ name = $agentName; role = $agentRole; cwd = $agentCwd } | ConvertTo-Json -Compress
$job = Start-Job -ScriptBlock {
    param($sid, $b)
    try {
        Invoke-RestMethod -Method Post `
            -Uri "http://localhost:8000/sessions/$sid/name" `
            -ContentType "application/json" `
            -Body $b | Out-Null
        return $true
    } catch { return $false }
} -ArgumentList $sessionId, $body

# Animate 0 → 90 while the job is still running
$p = 0
while ($job.State -eq 'Running' -and $p -lt 90) {
    Write-Bar $p
    Start-Sleep -Milliseconds 25
    $p += 1
}

# Wait for completion, then fill to 100
Receive-Job $job -Wait | Out-Null
Remove-Job $job

while ($p -le 100) {
    Write-Bar $p
    Start-Sleep -Milliseconds 10
    $p += 1
}

Write-Host ""
Write-Host "[tg-claude] Registered as '$agentName' ($agentRole)"
claude @claudeArgs
