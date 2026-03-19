$ErrorActionPreference = 'Stop'

$cfg = Get-Content .vscode/mcp.json -Raw | ConvertFrom-Json
$url = $cfg.mcpServers.Jira.env.JIRA_URL
$email = $cfg.mcpServers.Jira.env.JIRA_API_MAIL
$token = $env:JIRA_API_TOKEN
$pair = "$email`:$token"
$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$headers = @{
  Authorization = "Basic $b64"
  Accept = 'application/json'
  'Content-Type' = 'application/json'
}

$targets = @('SCRUM-51','SCRUM-52','SCRUM-57','SCRUM-59','SCRUM-61')
$payload = @{ transition = @{ id = '21' } } | ConvertTo-Json -Depth 4
$updated = @()
$failed = @()

foreach ($k in $targets) {
  try {
    Invoke-RestMethod -Method Post -Uri "$url/rest/api/3/issue/$k/transitions" -Headers $headers -Body $payload | Out-Null
    $updated += $k
  } catch {
    $failed += [PSCustomObject]@{ key = $k; error = $_.Exception.Message }
  }
}

$verifyBody = @{ jql='key in (SCRUM-51,SCRUM-52,SCRUM-57,SCRUM-59,SCRUM-61,SCRUM-62,SCRUM-63,SCRUM-64) ORDER BY key'; maxResults=20; fields=@('summary','status') } | ConvertTo-Json -Depth 8
$r = Invoke-RestMethod -Method Post -Uri "$url/rest/api/3/search/jql" -Headers $headers -Body $verifyBody

[PSCustomObject]@{
  movedToInProgress = $updated
  failures = $failed
  statuses = ($r.issues | Select-Object key,@{N='status';E={$_.fields.status.name}},@{N='summary';E={$_.fields.summary}})
} | ConvertTo-Json -Depth 8
