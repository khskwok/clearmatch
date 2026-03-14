# ClearMatch MPF Reconciliation Assistant

ClearMatch is an AI-assisted MPF reconciliation prototype that automatically compares employer payroll reports with trustee records, flags mismatches, and explains what went wrong in plain language. It is designed to cut manual spreadsheet work for operations teams and provide a clear, auditable view of contribution issues across employers and periods.

---

## Inspiration

MPF reconciliation today is often a painful, manual process—operations staff download CSVs from multiple systems, build VLOOKUP-heavy spreadsheets, and spend hours investigating small numeric mismatches. Small errors (like a few dollars underpaid) can slip through, while obvious systemic issues take days to detect.

ClearMatch was inspired by this workflow friction: we wanted to show how a small web app plus an AI explanation layer can turn raw contribution files into a structured exception list and easy-to-read narratives for each case. The goal is to move from “spreadsheet archaeology” to a proactive, explainable reconciliation assistant.

---

## What it does

ClearMatch takes two data sources:

- **Payroll file** – expected MPF contributions per employee and period (ER/EE amounts).
- **Trustee file** – actual contributions received and posted for the same employees/periods.

It then:

- Joins records by employee and period.
- Detects mismatches: match, underpay, overpay, missing, and general mismatch.
- Calculates match rate and basic KPIs.
- Generates human-readable explanations (via AI) for each exception, including likely root cause and recommended next action.

You can ask it things like “Show me who is underpaid this month and why,” and get a prioritized exception list with explanations without building new spreadsheets.

---

## Architecture overview

ClearMatch is built as a thin, Git-deployable front end with serverless APIs:

- **UI and API**
  - Azure Static Web App (`mpf-clearmatch-swa`).
  - Frontend (SPA) for:
    - Uploading payroll and trustee CSVs.
    - Configuring thresholds (e.g., tolerance for small differences).
    - Viewing a table of reconciled records and exceptions.
    - Triggering explanation generation per exception.
  - Backend Functions:
    - `/api/reconcile` – performs deterministic reconciliation logic.
    - `/api/explain` – generates AI explanations via Azure OpenAI.

- **AI Integration**
  - Uses Azure OpenAI for explanations (model deployment: `DeepSeek-V3.2`).
  - No Foundry agents in current implementation; reconciliation is handled directly in code for auditability.

---

## How we built it

### Frontend

- Single-page web UI for:
  - Uploading payroll and trustee CSVs.
  - Configuring thresholds (e.g., tolerance for small differences).
  - Viewing a table of reconciled records and exceptions.
  - Triggering explanation generation per exception.
- Uses REST calls to the SWA API endpoints (`/api/reconcile`, `/api/explain`).

### Reconciliation API (`reconcile`)

- Node.js Azure Function under `/api/reconcile`.
- Parses JSON payload with two arrays: `payroll` and `trustee`.
- Indexes trustee data by `EmpId + Period`.
- For each payroll row:
  - Finds matching trustee record (if any).
  - Compares expected vs received ER/EE amounts within a tolerance.
  - Classifies each row as:
    - `Matched`
    - `Underpay`
    - `Overpay`
    - `Missing` (no trustee record)
    - `Mismatch` (other discrepancies)
- Returns:
  - `totalEmployees`
  - `matchRate`
  - `exceptions[]` with fields like `empId`, `empName`, `period`, `expectedER/EE`, `receivedER/EE`, `issueType`, `reasonCode`.

### Explanation API (`explain`)

- Node.js Azure Function under `/api/explain`.
- Accepts a single `exception` object from the frontend.
- Builds a prompt that includes:
  - Employee ID/name, period.
  - Expected and received ER/EE.
  - Issue type and reason code.
- Calls Azure OpenAI using Chat Completions.
- Returns a 2–4 sentence explanation:
  - What is wrong.
  - Likely operational cause (e.g., missing trustee line, wrong salary, late remittance).
  - Suggested next action (e.g., contact employer to collect HKD X underpayment).

### Infrastructure

- GitHub repo with:
  - `/` – frontend app.
  - `/api` – SWA Functions (`reconcile.js`, `explain.js`).
  - `/tools` – optional scripts to create/update Foundry agents and clean up.
- Azure Static Web Apps for hosting and CI/CD.
- Azure OpenAI for AI explanations (model: DeepSeek-V3.2).

---

## Challenges we ran into

- **Non-transparent Azure OpenAI resource policy**
  - The subscription's OpenAI resource policies are not clearly documented, making it difficult to know what models are available for testing.
  - We designed the app so it could run with a **mock explanation** backend until quota or an alternative model (via Foundry) was available.

- **Aligning data formats**
  - Employer and trustee files use different headers and formats.
  - We needed a normalization layer (e.g., `EmpId` vs `empId`, `Period` vs `period`, varying ER/EE naming).

- **Robust reconciliation rules**
  - Simple equality checks are not enough—had to handle tolerance, missing records, and multiple small differences in a clear, deterministic way.
  - The classification logic had to be simple enough to explain but strict enough for audit.

- **Avoiding confusing AI output**
  - The explanation model must not invent numbers or change amounts.
  - We enforced tight system prompts and strict grounding in the numeric fields returned by `reconcile` to keep explanations faithful.

- **Balancing logic vs AI**
  - Pure AI reconciliation would have been opaque for audit and regulatory review.
  - A hybrid design (deterministic math + AI explanations) gave better transparency and usability.

---

## Accomplishments we’re proud of

- **End-to-end MPF reconciliation flow**
  - From two CSV uploads → reconciliation → exception list → explanation per case, all in a small, self-contained app.

- **Deterministic logic + AI**
  - Clean separation between:
    - Deterministic reconciliation (for auditability).
    - AI-generated narratives (for readability and operations handover).

- **Demo-ready UX**
  - Non-technical stakeholders can:
    - Upload sample files.
    - See overall match rate and issue counts.
    - Drill into specific employees and instantly read a clear explanation.

- **Mock-first design**
  - Even without Azure OpenAI/Foundry quota, the system can run with rule-based text explanations, making it safe to demo in constrained environments.

- **Agent reusability**
  - The Reconcile and Explain agents are reusable from other services, batch jobs, or future UIs via Foundry APIs, not just from this Static Web App.

---

## What we learned

- A small, well-defined domain (MPF reconciliation) is a great fit for combining deterministic rules with AI summarization.
- Tight prompts and explicit field lists are critical for keeping explanations numerically faithful.
- Azure Static Web Apps + Functions provide a simple way to ship a complete prototype with CI/CD from GitHub.
- Microsoft Foundry agents are a good place to host “brains” that need to be reused across multiple applications.
- Designing for “no-quota / limited-quota” scenarios up front avoids surprises late in the project.
- Deployment gotchas to document:
  - `DeploymentNotFound` means the OpenAI resource deployment name is wrong or not ready.
  - App setting must exactly match OpenAI deployment name.
  - Use Key Vault + managed identity for secret management, then map into SWA settings.

---

## Demo Video

[Watch the 2-minute demo video](https://youtu.be/example) showing ClearMatch in action: uploading CSV files, running reconciliation, and generating AI explanations.

---

## Architecture Diagram

```
[Frontend (SPA)] --> [Azure Static Web App]
                     |
                     +--> [API Functions (/api/reconcile, /api/explain)]
                          |
                          +--> [Azure OpenAI Service (DeepSeek-V3.2)]
```

- **Frontend**: Single-page app for file uploads and results display.
- **Backend**: Serverless functions on Azure SWA.
- **AI Layer**: Azure OpenAI for generating explanations.
- **Deployment**: GitHub Actions for CI/CD to Azure SWA.

---

## Team Information

- **Team Member**: [Name] (Microsoft Learn Username: [username])
- **Project Lead**: [Name] (Microsoft Learn Username: [username])

---

## Submission Details

This project meets the hackathon requirements:

- **Working Project**: Deployed on Azure with functional APIs.
- **Problem Solved**: Automates manual MPF reconciliation with AI insights.
- **Technologies Used**: Azure Static Web Apps, Azure OpenAI, GitHub Actions.
- **GitHub Repository**: https://github.com/khskwok/clearmatch
- **Demo Video**: Linked above.
- **Architecture Diagram**: Illustrated above.

---

## What’s next for ClearMatch

- **Quota-aware model deployment**
  - Use Foundry model deployments (e.g. DeepSeek-V3.2 or GPT-5-mini), and tune prompts for MPF-specific language once quota and model availability are confirmed.

- **Richer analytics**
  - Dashboards for:
    - Underpay/overpay trends by employer over time.
    - Top recurring issue types (e.g., late payments vs data errors).

- **Workflow integration**
  - Auto-create tasks/tickets when exceptions exceed certain thresholds (e.g., large underpayment for a key employer).
  - Integrate with existing case management tools.

- **Multi-scheme support**
  - Extend beyond MPF to handle other pension or benefits schemes with different contribution rules.

- **Open sourcing**
  - Publish a template repo with:
    - Sample anonymized MPF data.
    - Reconciliation functions.
    - Agent definitions and deployment scripts for Foundry.
    - Optional Azure OpenAI integration path, so operations teams can adapt it quickly.
