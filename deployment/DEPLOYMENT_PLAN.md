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
     --location "westus2" \  # choose a supported region (eastus is not valid)
     --app-location "/" \
     --api-location "api" \
     --branch main \
     --output table
   ```

   - **Region note:** not all Azure regions support Static Web Apps. Valid
     locations include `westus2`, `centralus`, `eastus2`, `westeurope`, and
     `eastasia`. Replace `--location` with one of those if you see a
     `LocationNotAvailableForResourceType` error.
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

4. **Verify OpenAI deployment** (if using Azure OpenAI backend):
   - In Azure Portal, open the OpenAI resource (e.g. `clearmatch-openai`).
   - Go to **Deployments** and ensure there is at least one `Running` deployment (e.g. `gpt-4o-mini` or `deepseek-v3.2-clearmatch`).
   - If using `OpenAIDeployment` in app settings, this name must match exactly.
   - If you see `DeploymentNotFound` in logs, update the SWA app setting and retry.

---

## 3. Configure Application Settings

> This section assumes you have created (or will create) an Azure OpenAI resource first.

1. In the Azure Portal, go to the Static Web App resource.
2. Under **Configuration > Application settings**, add the following keys (values provided by your Azure OpenAI resource):
   - `OpenAIEndpoint` – e.g. `https://<your-instance>.openai.azure.com/`
   - `OpenAIDeployment` – e.g. `gpt-4o-mini`
   - `OpenAIKey` – API key string

3. Save and restart the app if prompted.

> 🔐 Do **not** commit secrets to source control; use the portal or CLI to set them.

## 3.1. Create Azure OpenAI resource (if needed)

1. In Azure Portal, click **Create a resource** → search `Azure OpenAI` → **Create**.
2. Choose subscription, resource group (`clearmatch-rg`), name (e.g., `clearmatch-openai`), region (e.g., West US 2), pricing tier (`S0`).
3. Complete create and deploy.
4. In the OpenAI resource, go to **Deployments** and create a deployment (e.g., model `gpt-4o-mini`, name `gpt-4o-mini`).
5. In **Keys and Endpoint**, copy the endpoint and one key.

## 3.2. Set app settings via CLI

Run from repository root (or any working folder):

```powershell
az staticwebapp appsettings set \
  --name mpf-clearmatch-swa \
  --resource-group clearmatch-rg \
  --settings \
    OpenAIEndpoint="https://<your-instance>.openai.azure.com/" \
    OpenAIDeployment="gpt-4o-mini" \
    OpenAIKey="<your-openai-key>"
```

Verify with:

```powershell
az staticwebapp appsettings list --name mpf-clearmatch-swa --resource-group clearmatch-rg
```

`properties` should list `OpenAIEndpoint`, `OpenAIDeployment`, `OpenAIKey`.

---

## 3.5. Create or configure Foundry agents

ClearMatch relies on two Microsoft Foundry agents for the reconciliation and
explanation logic. You can create them via the portal or programmatically using
the Foundry REST API. The agents are not provisioned automatically by the
Static Web App.

### Portal (GUI)
1. Sign in to the Azure portal and search for **Azure AI Foundry**.
2. Select your Foundry resource (e.g., `mpf-clearmatch-openai`).
3. Open the project (e.g., `mpf-clearmatch-openai-project`).
4. Navigate to **Agents** in the left menu, then click **+ New agent**.
5. For the **Reconcile Agent**:
   - Name: `clearmatch-reconcile-agent`
   - Description: Deterministic payroll/trustee reconciliation logic
   - Model: Select `deepseek-v3.2-clearmatch` or your preferred deployment
   - Prompt: "You are a JSON-output agent. Input: {\"payroll\": [...],\"trustee\": [...]}. For each payroll row, join on EmpId+Period, compare expected vs received ER/EE amounts within tolerance, classify as Matched/Underpay/Overpay/Missing/Mismatch, and emit a result object with totalEmployees, matchRate and exceptions[] according to the README schema."
   - Response format: JSON with the schema from the README (totalEmployees, matchRate, exceptions array).
6. Save the agent and note the **Endpoint URL** and **API Key** from the agent details.
7. Repeat for the **Explain Agent**:
   - Name: `clearmatch-explain-agent`
   - Description: Generate a 2–4 sentence human explanation for a single exception object
   - Model: Same as above
   - Prompt: "You are given an exception record with employee, period, expected/received amounts and reason code. Produce a 2-4 sentence plain-text explanation. Do not change any numbers."
   - Response format: Text
8. Add the endpoints and keys to your Static Web App's application settings (e.g., `ReconcileAgentUrl`, `ReconcileAgentKey`, `ExplainAgentUrl`, `ExplainAgentKey`).

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

Before you deploy, it’s helpful to confirm whether the Static Web App already
exists and is running. This lets you choose between a new deployment or a
redeploy of an existing site.

```powershell
# check status of SWA
az staticwebapp show --name mpf-clearmatch-swa --resource-group clearmatch-rg
```

- If the command returns JSON with details (see earlier examples), the app is
  already deployed. You can force a redeploy by pushing a commit or running
  `az staticwebapp upload ...` again; the existing resource will not be
  recreated.
- If the command fails with `ResourceNotFound`, the app hasn’t been created
  yet and you should use `az staticwebapp create` as described in section 2
  above.

### If using GitHub Actions

1. Commit and push your code to the designated branch (`main` or `master`).
   - If the SWA was already connected to the repo, this push will trigger the
     existing workflow and redeploy the site.
   - If you just created the SWA (via CLI or portal), the GitHub Actions
     workflow is already in place; the initial push will deploy it.
2. Monitor the workflow run via the Actions tab in GitHub or the Deployment
   Center in Azure. A successful run means the site is live and “started”.

### Manual deployment

- To deploy or redeploy without Actions, run the CLI command from the repo
  root:
  ```powershell
  az staticwebapp upload --name mpf-clearmatch-swa --resource-group clearmatch-rg --source .
  ```
  (This works whether the SWA already exists or is brand new.)
- Alternatively, use `swa deploy` from the Static Web Apps CLI once
  configured.

After deployment, the app is automatically “started” and accessible at the
hostname shown in the static web app’s overview page. No separate start
command is required.

---

## 5. Testing

- Browse to the app URL (e.g. `https://mpf-clearmatch-swa.azurestaticapps.net`).
- Use the sample CSV files in `deployment/payroll.csv` and `deployment/trustee.csv` as test inputs.
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

## 8. Actual Deployment Details

This section documents the specific values and configurations used in the successful deployment of ClearMatch.

### Azure Resources
- **Resource Group**: `clearmatch-rg` (Location: East US)
- **Static Web App**: `mpf-clearmatch-swa` (Location: West US 2, URL: `https://salmon-smoke-05d320f1e.6.azurestaticapps.net`)
- **Azure OpenAI Resource**: `khskw-mm8sjfq1-swedencentral` (Resource Group: `rg-mpf-clearmatch`, Location: Sweden Central)
  - Endpoint: `https://khskw-mm8sjfq1-swedencentral.cognitiveservices.azure.com/`
  - Deployment: `DeepSeek-V3.2`
  - API Key: Configured in SWA app settings (redacted for security)

### Application Settings
- `OpenAIEndpoint`: `https://khskw-mm8sjfq1-swedencentral.cognitiveservices.azure.com/`
- `OpenAIDeployment`: `DeepSeek-V3.2`
- `OpenAIKey`: [API key provided during setup]

### GitHub Integration
- Repository: `https://github.com/khskwok/clearmatch`
- Branch: `main`
- Build Status: Successful (GitHub Actions triggered on push)

### Testing Results
- **Reconcile API**: Functional, returns correct match rate and exceptions.
- **Explain API**: Functional, generates AI explanations using Azure OpenAI.
- **Frontend**: Accessible and interactive.

### Notes
- Foundry agents were not implemented; reconciliation uses direct code logic for auditability.
- Secrets were removed from git history to comply with GitHub's push protection.
- Deployment completed on March 14, 2026.
