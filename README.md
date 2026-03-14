# ClearMatch MPF Reconciliation Assistant

ClearMatch is a prototype web app for MPF reconciliation.
It compares payroll and trustee contribution records, flags exceptions, and returns plain-language explanations to reduce manual spreadsheet investigation.

---

## What It Does

ClearMatch accepts two datasets:

- Payroll: expected ER/EE contribution per employee and period
- Trustee: received ER/EE contribution per employee and period

It then:

- Matches records by `EmpId + Period`
- Classifies issues (`Matched`, `Underpay`, `Overpay`, `Missing`, `Mismatch`)
- Returns summary KPIs (`totalEmployees`, `matchRate`, `exceptions[]`)
- Generates explanation text for each exception via `/api/explain`

---

## Architecture

- Frontend: static SPA hosted on Azure Static Web Apps
- API: Azure Functions (managed by SWA)
  - `/api/reconcile`: deterministic reconciliation logic
  - `/api/explain`: explanation endpoint for exception narratives
- CI/CD: GitHub Actions on `main`

Production URL:

- `https://brave-beach-048a8081e.2.azurestaticapps.net`

---

## Repository Structure

- `index.html`: frontend UI
- `api/reconcile.js`: reconciliation API
- `api/explain.js`: explanation API
- `deployment/DEPLOYMENT_PLAN.md`: deployment and operations runbook
- `deployment/payroll.csv`: sample test input
- `deployment/trustee.csv`: sample test input

---

## Current Deployment Model

- Deploys from GitHub `main` branch
- Uses workflow:
  - `.github/workflows/azure-static-web-apps-salmon-smoke-05d320f1e.yml`
- Uses SWA deployment token secret:
  - `AZURE_STATIC_WEB_APPS_API_TOKEN_SALMON_SMOKE_05D320F1E`

---

## Running and Testing

### Cloud Validation

Use the deployed app URL and test endpoints:

```http
POST /api/reconcile
POST /api/explain
```

### Sample Data

Use:

- `deployment/payroll.csv`
- `deployment/trustee.csv`

---

## Notes on Explanations

The prototype prioritizes reliable explanation output for demos and validation.
When integrating external model services (for example Foundry), keep deterministic fallback behavior so `/api/explain` remains available even during external service or configuration issues.

---

## Security and Secrets

- Do not commit secrets to git.
- Store sensitive values in Azure Key Vault.
- Reference secrets from SWA application settings.

---

## Next Improvements

- Add structured API tests for `/api/reconcile` and `/api/explain`
- Add richer summary analytics (trend and employer-level views)
- Add configurable explanation mode (deterministic, model-assisted, hybrid)
