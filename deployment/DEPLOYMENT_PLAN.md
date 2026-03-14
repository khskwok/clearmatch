# ClearMatch Deployment Plan

This guide documents the production deployment path for ClearMatch on Azure.
It is optimized for one workflow: push to GitHub `main`, deploy via Azure Static Web Apps CI/CD.

---

## 1. Current Target Environment

- Resource Group: `clearmatch-rg` (`eastus`)
- Shared Key Vault Resource Group: `rg-mpf-clearmatch`
- Static Web App: `mpf-clearmatch-swa` (`West US 2`)
- Production URL: `https://brave-beach-048a8081e.2.azurestaticapps.net`
- API folder: `api`
- Deployment branch: `main`
- Deployment workflow: `.github/workflows/azure-static-web-apps-salmon-smoke-05d320f1e.yml`

---

## 2. Prerequisites

- Azure CLI installed and authenticated: `az login`
- Access to subscription containing `clearmatch-rg`
- GitHub repository access: `https://github.com/khskwok/clearmatch`
- GitHub Actions secret configured:
  - `AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_SMOKE_05D320F1E`

---

## 3. Azure Resources

Create only if missing.

```powershell
az group create --name clearmatch-rg --location eastus

az staticwebapp create \
  --name mpf-clearmatch-swa \
  --resource-group clearmatch-rg \
  --location westus2 \
  --branch main \
  --app-location / \
  --api-location api
```

Verify:

```powershell
az staticwebapp show --name mpf-clearmatch-swa --resource-group clearmatch-rg --query "{name:name,defaultHostname:defaultHostname,sku:sku.name}" -o json
```

---

## 4. App Settings and Secrets

ClearMatch uses:

- `FoundryEndpoint`
- `FoundryKey`

Use Key Vault for `FoundryKey`.

### 4.1 Reuse Existing Key Vault

- Key Vault: `kv-mpf-clearmatch`
- Secret name: `FoundryKey`

```powershell
az keyvault show --name kv-mpf-clearmatch --query "{name:name,vaultUri:properties.vaultUri}" -o json
az keyvault secret show --vault-name kv-mpf-clearmatch --name FoundryKey --query "{id:id,updated:attributes.updated}" -o json
```

### 4.2 Update SWA Settings

Set endpoint and Key Vault reference.

```powershell
$foundryEndpoint = "https://<your-foundry-instance>.services.ai.azure.com/api/projects/<project-name>"
$secretId = az keyvault secret show --vault-name kv-mpf-clearmatch --name FoundryKey --query id -o tsv
$kvRef = "@Microsoft.KeyVault(SecretUri=$secretId)"

az staticwebapp appsettings set \
  --name mpf-clearmatch-swa \
  --resource-group clearmatch-rg \
  --setting-names FoundryEndpoint="$foundryEndpoint" FoundryKey="$kvRef"
```

If Windows shell truncates the Key Vault reference, use ARM REST update instead:

```powershell
$settings = az staticwebapp appsettings list --name mpf-clearmatch-swa --resource-group clearmatch-rg -o json | ConvertFrom-Json
$settings.properties.FoundryKey = $kvRef
$payload = @{ properties = $settings.properties } | ConvertTo-Json -Depth 20
Set-Content "$env:TEMP\swa-appsettings.json" $payload -Encoding UTF8

az rest --method PUT \
  --uri "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/clearmatch-rg/providers/Microsoft.Web/staticSites/mpf-clearmatch-swa/config/appsettings?api-version=2023-12-01" \
  --headers "Content-Type=application/json" \
  --body "@$env:TEMP\swa-appsettings.json"
```

Verify:

```powershell
az staticwebapp appsettings list --name mpf-clearmatch-swa --resource-group clearmatch-rg --query "properties.{FoundryEndpoint:FoundryEndpoint,FoundryKey:FoundryKey}" -o json
```

---

## 5. Deploy (GitHub Actions Only)

Push to `main` to deploy.

```powershell
git push origin main
```

Watch workflow run in GitHub Actions:

- Workflow: `Azure Static Web Apps CI/CD`
- File: `.github/workflows/azure-static-web-apps-salmon-smoke-05d320f1e.yml`

### 5.1 Common Failure and Fix

If workflow fails with:

`No matching Static Web App was found or the api key was invalid.`

Rotate SWA deployment token and update GitHub secret.

```powershell
az staticwebapp secrets reset-api-key --name mpf-clearmatch-swa --resource-group clearmatch-rg
az staticwebapp secrets list --name mpf-clearmatch-swa --resource-group clearmatch-rg --query properties.apiKey -o tsv
```

Update GitHub secret:

- `AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_SMOKE_05D320F1E`

Re-run workflow or push empty commit:

```powershell
git commit --allow-empty -m "chore: rerun Azure SWA workflow"
git push origin main
```

---

## 6. Post-Deploy Validation

### 6.1 API Health

```powershell
$base = "https://brave-beach-048a8081e.2.azurestaticapps.net"

Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/reconcile" -ContentType "application/json" -Body '{"payroll":[],"trustee":[]}'

$body = @{ exception = @{ empId='E001'; empName='Demo'; period='2026-03'; expectedER=100; expectedEE=100; receivedER=90; receivedEE=100; issueType='Underpay'; reasonCode='ER_UNDERPAID' } } | ConvertTo-Json -Depth 6
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/explain" -ContentType "application/json" -Body $body
```

Expected:

- `/api/reconcile` returns `200` with JSON summary
- `/api/explain` returns `200` with `explanation`

### 6.2 UI Smoke Test

- Open app URL
- Upload `deployment/payroll.csv` and `deployment/trustee.csv`
- Confirm table population and explanation rendering

---

## 7. Cleanup Procedure

Use one of the following levels.

### 7.1 Level 1: Safe Cost Control (Keep Environment)

Use when you want to pause deployments without deleting infrastructure.

1. Disable GitHub workflow in repository Actions UI.
2. Rotate SWA deployment token.
3. Keep SWA and Key Vault resources intact.

### 7.2 Level 2: App Teardown (Keep Shared Resources)

Use when you want to remove the web app but keep shared Foundry/Key Vault resources.

```powershell
az staticwebapp delete --name mpf-clearmatch-swa --resource-group clearmatch-rg --yes
```

Optional: remove resource group if only SWA exists there:

```powershell
az group delete --name clearmatch-rg --yes --no-wait
```

### 7.3 Level 3: Full Teardown

Use when you want to remove everything for this prototype.

```powershell
# review what will be deleted first
az resource list --resource-group clearmatch-rg -o table
az resource list --resource-group rg-mpf-clearmatch -o table

# delete both groups
az group delete --name clearmatch-rg --yes --no-wait
az group delete --name rg-mpf-clearmatch --yes --no-wait
```

Also clean GitHub repository secrets related to this environment.

---

## 8. Operations Notes

- Prefer GitHub Actions deployment over local SWA CLI for release validation.
- Keep only one active SWA workflow for this environment (salmon-smoke).
- Store secrets in Key Vault and reference them from SWA settings.
- If app behavior changes, update this file in the same PR as code changes.
