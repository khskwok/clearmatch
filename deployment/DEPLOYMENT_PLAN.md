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

   - **Important:** the CLI expects to run from within a git repository that is
     connected to GitHub or Azure DevOps. When executed in a plain local folder
     it will fail with a message about needing a PAT (as seen earlier).
   - If your code is already hosted on GitHub, clone that repo and run the
     command there; the command will then automatically configure the
     GitHub Actions workflow.
   - If you prefer not to use GitHub Actions, create the Static Web App using
     the Azure Portal and choose "Skip GitHub workflow" on the creation page
     (this produces an empty SWA resource you can deploy to manually).

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

## 3.5. Create or configure Foundry agents

ClearMatch relies on two Microsoft Foundry agents for the reconciliation and
explanation logic. You can create them via the portal or programmatically using
the Foundry REST API. The agents are not provisioned automatically by the
Static Web App.

### Portal (GUI)
1. Open the Azure portal and navigate to your Foundry instance.
2. Select your project, then go to **Agents ➜ + New agent**.
3. Name the agents `clearmatch-reconcile-agent` and
   `clearmatch-explain-agent`.
4. Choose a model deployment (e.g. `deepseek-v3.2-clearmatch` or any Azure
   OpenAI deployment) and supply a prompt that implements the behavior
   described in the repository README.
   - **Reconcile**: join `payroll`/`trustee` arrays, classify rows, return
     JSON with `totalEmployees`, `matchRate`, and an `exceptions[]` list.
   - **Explain**: accept one exception and return a 2–4 sentence plain-text
     narrative; never change numbers.
5. Save/deploy. Note the returned `endpoint` URL and API key for each agent.
   Add those to the SWA application settings (e.g. `ReconcileAgentUrl`,
   `ReconcileAgentKey`).

### REST API (automation)
If you prefer a scriptable path, call the Foundry API yourself. First obtain an
access token (you may use the default management audience if the Foundry
resource isn’t registered in AAD):

```powershell
# management token is usually fine
$token = az account get-access-token |
         ConvertFrom-Json | Select-Object -ExpandProperty accessToken
```

Then create each agent:

```powershell
$body = @"
{
  "name": "clearmatch-reconcile-agent",
  "description": "Deterministic payroll/trustee reconciliation logic",
  "project": "<your-project-id-or-name>",
  "modelDeployment": "deepseek-v3.2-clearmatch",
  "prompt": "...system prompt text...",
  "schema": { /* JSON schema per README */ }
}
"@

az rest \
  --method POST \
  --uri "https://<your-foundry-endpoint>/v1/agents" \
  --headers "Authorization=Bearer $token" "Content-Type=application/json" \
  --body $body
```

and similarly for `clearmatch-explain-agent` with a simpler prompt and
`"responseFormat":"text"`.

If you get a `invalid_resource` error, either re‑login with the appropriate
scope:

```powershell
az login --scope https://foundry.azure.com//.default
```

or just use the management token shown earlier.  The response from each
creation call will include the agent `endpoint` and `key` which you must store
in your app settings.

> Tip: you can also update or patch an existing agent via `az rest` with
> `--method PATCH`.


---

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
