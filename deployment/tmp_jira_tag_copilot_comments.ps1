$ErrorActionPreference = 'Stop'

$cfg = Get-Content .vscode/mcp.json -Raw | ConvertFrom-Json
$url = $cfg.mcpServers.Jira.env.JIRA_URL.TrimEnd('/')
$email = $cfg.mcpServers.Jira.env.JIRA_API_MAIL
$token = $env:JIRA_API_TOKEN
$pair = "$email`:$token"
$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$headers = @{
  Authorization = "Basic $b64"
  Accept = 'application/json'
  'Content-Type' = 'application/json'
}

$storyKeys = 51..64 | ForEach-Object { "SCRUM-$_" }
$updated = @()
$skipped = @()
$failed = @()

foreach ($key in $storyKeys) {
  try {
    $commentsResp = Invoke-RestMethod -Method Get -Uri "$url/rest/api/3/issue/$key/comment" -Headers $headers
    foreach ($c in $commentsResp.comments) {
      $textParts = @()
      if ($c.body -and $c.body.content) {
        foreach ($block in $c.body.content) {
          if ($block.content) {
            foreach ($item in $block.content) {
              if ($item.text) { $textParts += $item.text }
            }
          }
        }
      }
      $plain = ($textParts -join ' ').Trim()

      if (-not $plain) {
        continue
      }

      if ($plain -notlike 'Status update*') {
        continue
      }

      if ($plain -like '* (update by Copilot)*' -or $plain -like '*(update by Copilot)*') {
        $skipped += [PSCustomObject]@{ key = $key; commentId = $c.id; reason = 'Already tagged' }
        continue
      }

      $newText = $plain + ' (update by Copilot)'
      $payload = @{
        body = @{
          type = 'doc'
          version = 1
          content = @(
            @{
              type = 'paragraph'
              content = @(
                @{
                  type = 'text'
                  text = $newText
                }
              )
            }
          )
        }
      } | ConvertTo-Json -Depth 20

      Invoke-RestMethod -Method Put -Uri "$url/rest/api/3/issue/$key/comment/$($c.id)" -Headers $headers -Body $payload | Out-Null
      $updated += [PSCustomObject]@{ key = $key; commentId = $c.id }
    }
  } catch {
    $failed += [PSCustomObject]@{ key = $key; error = $_.Exception.Message }
  }
}

[PSCustomObject]@{
  updated = $updated
  skipped = $skipped
  failed = $failed
} | ConvertTo-Json -Depth 8
