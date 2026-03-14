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
- Generates human-readable explanations for each exception, including likely root cause and recommended next action.

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
    - `/api/explain` – returns explanation text for exceptions.

- **AI Integration**
  - Uses Microsoft Foundry configuration (`FoundryEndpoint`, `FoundryKey`) when enabled.
  - Target model for model-assisted explanations: `gpt-4o`.
  - Explanation endpoint supports deterministic fallback behavior for reliability.
  - Reconciliation is handled directly in code for auditability.

### Architecture Diagram

```
[Frontend (SPA)] --> [Azure Static Web App]
                     |
                     +--> [API Functions (/api/reconcile, /api/explain)]
                          |
                          +--> [Microsoft Foundry (optional/external explanation service)]
```

- **Frontend**: Single-page app for file uploads and results display.
- **Backend**: Serverless functions on Azure SWA.
- **AI Layer**: Foundry-backed explanation path with deterministic fallback.
- **Deployment**: GitHub Actions for CI/CD to Azure SWA.

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
- Builds an explanation using structured exception fields.
- Current production behavior is deterministic output for reliability.
- Foundry integration settings (`FoundryEndpoint`, `FoundryKey`) remain available for model-assisted explanations.

### Infrastructure

- GitHub repo with:
  - `/` – frontend app.
  - `/api` – SWA Functions (`reconcile.js`, `explain.js`).
- Azure Static Web Apps for hosting and CI/CD.
- Azure Key Vault for secrets.

---

## Challenges we ran into

- **Non-transparent Azure OpenAI / model policy constraints**
  - Model and endpoint constraints changed during implementation, which impacted explanation integration paths.
  - We designed the app so it can run with deterministic explanation output when external model configuration is unavailable.

- **Aligning data formats**
  - Employer and trustee files use different headers and formats.
  - We needed a normalization layer (e.g., `EmpId` vs `empId`, `Period` vs `period`, varying ER/EE naming).

- **Robust reconciliation rules**
  - Simple equality checks are not enough—had to handle tolerance, missing records, and multiple small differences in a clear, deterministic way.
  - The classification logic had to be simple enough to explain but strict enough for audit.

- **Balancing logic vs AI**
  - Pure AI reconciliation would have been opaque for audit and regulatory review.
  - A hybrid design (deterministic math + explanation layer) gave better transparency and usability.

---

## Accomplishments we’re proud of

- **End-to-end MPF reconciliation flow**
  - From two CSV uploads -> reconciliation -> exception list -> explanation per case, all in a small, self-contained app.

- **Deterministic logic + explainability**
  - Clean separation between:
    - Deterministic reconciliation (for auditability).
    - Human-readable narratives (for operations handover).

- **Demo-ready UX**
  - Non-technical stakeholders can:
    - Upload sample files.
    - See overall match rate and issue counts.
    - Drill into specific employees and read a clear explanation.

- **Resilient design**
  - The system stays functional even when external model services are unavailable.

---

## What we learned

- A small, well-defined domain (MPF reconciliation) is a great fit for deterministic rules plus an explanation layer.
- Tight grounding in numeric fields is critical for faithful explanations.
- Azure Static Web Apps + Functions provide a simple way to ship a complete prototype with CI/CD from GitHub.
- Deployment gotchas to document:
  - Invalid SWA token causes GitHub Action deploy failures.
  - Key Vault reference formatting can be truncated by local shell parsing on Windows.
  - Keep one active SWA workflow per environment.

---

## What’s next for ClearMatch

- **Configurable explanation mode**
  - Support deterministic, model-assisted, and hybrid modes behind a simple app setting.

- **Richer analytics**
  - Dashboards for:
    - Underpay/overpay trends by employer over time.
    - Top recurring issue types.

- **Workflow integration**
  - Auto-create tasks/tickets when exceptions exceed configured thresholds.

- **Multi-scheme support**
  - Extend beyond MPF to additional pension or benefits schemes with different contribution rules.

- **Template packaging**
  - Publish a reusable template with sample data, deterministic APIs, and Azure deployment automation.
