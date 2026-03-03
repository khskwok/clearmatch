# ClearMatch Deployment Plan

This document outlines the steps to deploy the ClearMatch Static Web App and its APIs to Azure, including configuration and cleanup procedures. Follow each section in order to ensure a successful cloud deployment.

---

## 1. Prerequisites

- Azure subscription with appropriate permissions (Contributor or Owner).
- Azure CLI installed and authenticated (`az login`).
- GitHub account linked to the repository (if using GitHub Actions) or local git for manual deployments.
- A working copy of the ClearMatch repository (frontend and `api/` folder).

---

## 2. Create Azure Resources

1. **Resource group** (if not already created):
   ```powershell
   az group create --name clearmatch-rg --location "East US"
   ```

2. **Static Web App** (replace `<appName>` with a globally unique name):
   ```powershell
   az staticwebapp create \
     --name mpf-clearmatch-swa \
     --resource-group clearmatch-rg \
     --source . \
     --location "East US" \
     --app-location "/" \
     --api-location "api" \
     --branch main \
     --output table
   ```

   - This command initializes a GitHub Actions workflow if running from a git repo.
   - The `--branch` parameter should match the primary branch (e.g. `main`).

3. **Verify** the deployment in the Azure Portal: navigate to the Static Web App resource and note the default URL.

---

## 3. Configure Application Settings

1. In the Azure Portal, go to the Static Web App resource.
2. Under **Configuration > Application settings**, add the following keys (values provided by your Azure OpenAI resource or other service):
   - `OpenAIEndpoint` – e.g. `https://<your-instance>.openai.azure.com/`
   - `OpenAIDeployment` – e.g. `gpt-4o-mini`
   - `OpenAIKey` – API key string

3. Save and restart the app if prompted.

> 🔐 Do **not** commit secrets to source control; use the portal or CLI to set them.

---

## 4. Deploy Code

### If using GitHub Actions

- Commit and push your code to the designated branch (`main` or `master`).
- The workflow created under `.github/workflows/` will build and deploy your app automatically.
- Monitor the workflow run via the Actions tab in GitHub or the Deployment Center in Azure.

### Manual deployment

- Use the CLI command (run from repo root):
  ```powershell
  az staticwebapp upload --name mpf-clearmatch-swa --resource-group clearmatch-rg --source .
  ```
- Alternatively, use `swa deploy` from the Static Web Apps CLI once configured.

---

## 5. Testing

- Browse to the app URL (e.g. `https://mpf-clearmatch-swa.azurestaticapps.net`).
- Upload sample payroll and trustee files to ensure reconciliation works.
- Test API endpoints directly if needed:
  ```http
  POST /api/reconcile
  Content-Type: application/json
  ```

- Verify AI explanation by invoking `/api/explain` with a mock prompt.

---

## 6. Cleanup (when needed)

To remove all deployed resources:

1. **Delete the Static Web App**:
   ```powershell
   az staticwebapp delete --name mpf-clearmatch-swa --resource-group clearmatch-rg --yes
   ```

2. **Delete the resource group** (if no other resources exist):
   ```powershell
   az group delete --name clearmatch-rg --yes --no-wait
   ```

3. Optionally, remove local build artifacts or temp files.

> ⚠️ Be cautious: deleting the resource group removes **all** contained resources.

---

## 7. Additional Considerations

- **Custom domains** can be configured under the Static Web App's Settings section.
- Use Azure Monitor / Application Insights for logging and telemetry (auto-enabled).
- Manage secrets through Azure Key Vault or environment settings as needs evolve.

---

This plan provides a complete path from local code to a running cloud application with configuration and cleanup. Adjust resource names, locations, and branch names to fit your environment.
