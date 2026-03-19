# ClearMatch Requirements (Story Based)

This document contains the story-based requirements separated from README.
Each story is tagged with a corresponding Jira ID.

## Jira ID Mapping Convention

- Epic IDs: SCRUM-45, SCRUM-46, SCRUM-47, SCRUM-48, SCRUM-49, SCRUM-50
- Story IDs: SCRUM-51 to SCRUM-64

## Epic 1: Data Intake and Normalization [JIRA: SCRUM-45]

### Story 1.1: Upload payroll and trustee files [JIRA: SCRUM-51]

As an operations user, I want to upload payroll and trustee CSV files so that reconciliation can run without manual spreadsheet joins.

Acceptance criteria:

- User can upload one payroll file and one trustee file.
- System validates that required fields exist.
- User receives clear error messages for invalid file format.

Definition of done:

- Upload works in UI.
- Validation errors are shown and actionable.

### Story 1.2: Normalize source schemas [JIRA: SCRUM-52]

As a reconciliation engine, I want to normalize different input headers so that source file variations do not break matching.

Acceptance criteria:

- Supports common header variants, such as EmpId and empId.
- Supports period field variants and ER/EE naming variants.
- Normalized records are passed to reconciliation logic in a stable schema.

Definition of done:

- Mapping logic is covered by tests for representative file formats.

## Epic 2: Deterministic Reconciliation [JIRA: SCRUM-46]

### Story 2.1: Match by employee and period [JIRA: SCRUM-53]

As a reconciliation analyst, I want records joined by employee and period so the system compares the correct contribution pairs.

Acceptance criteria:

- Join key uses employee identifier plus contribution period.
- Missing trustee rows are detected.

Definition of done:

- API response includes joined records and missing flags.

### Story 2.2: Classify reconciliation outcomes [JIRA: SCRUM-54]

As an operations user, I want each row classified by issue type so I can triage work quickly.

Acceptance criteria:

- Issue types include Matched, Underpay, Overpay, Missing, and Mismatch.
- Classification applies tolerance settings consistently.
- Each exception includes a reason code.

Definition of done:

- Classification results are deterministic for same input and tolerance.

### Story 2.3: Return reconciliation KPIs [JIRA: SCRUM-55]

As a team lead, I want summary metrics so I can assess payroll quality at a glance.

Acceptance criteria:

- Response includes total employees processed.
- Response includes match rate.
- Response includes exception list with expected and received values.

Definition of done:

- KPIs are displayed in UI and traceable to API response.

## Epic 3: Explainable Exceptions [JIRA: SCRUM-47]

### Story 3.1: Generate plain-language explanations [JIRA: SCRUM-56]

As an operations user, I want an explanation for each exception so I can understand likely causes and next actions.

Acceptance criteria:

- Explanation includes what is wrong.
- Explanation includes likely operational cause.
- Explanation includes recommended next step.
- Output is concise, around 2 to 4 sentences.

Definition of done:

- Explain endpoint accepts exception payload and returns grounded narrative text.

### Story 3.2: Enforce grounding and numeric fidelity [JIRA: SCRUM-57]

As a compliance reviewer, I want explanations grounded in source numbers so AI output remains auditable.

Acceptance criteria:

- Prompt uses explicit fields from reconciliation output.
- Explanation does not invent or alter monetary values.
- Fallback rule-based explanation is available when AI is unavailable.

Definition of done:

- Test cases confirm explanation behavior with and without model access.

## Epic 4: User Experience and Workflow [JIRA: SCRUM-48]

### Story 4.1: Review exceptions in a table [JIRA: SCRUM-58]

As an operations user, I want a table view of exceptions so I can filter and prioritize follow-up tasks.

Acceptance criteria:

- UI shows employee, period, expected values, received values, and issue type.
- Users can trigger explanation generation per row.

Definition of done:

- Table rendering and row-level actions are available in the SPA.

### Story 4.2: Configure tolerance thresholds [JIRA: SCRUM-59]

As an operations manager, I want tolerance controls so small rounding differences do not create false positives.

Acceptance criteria:

- User can set tolerance value before reconciliation.
- Tolerance is applied in classification logic.

Definition of done:

- API and UI use the same tolerance semantics.

## Epic 5: Platform and Deployment [JIRA: SCRUM-49]

### Story 5.1: Deploy as static web app with serverless APIs [JIRA: SCRUM-60]

As a developer, I want the solution deployed on Azure Static Web Apps so hosting and API routing stay simple.

Acceptance criteria:

- Frontend deploys from repository root.
- APIs deploy from api folder.
- Routes include /api/reconcile and /api/explain.

Definition of done:

- CI/CD deploys successfully from GitHub Actions.

### Story 5.2: Secure configuration and secrets [JIRA: SCRUM-61]

As a security owner, I want keys managed safely so credentials are never committed.

Acceptance criteria:

- API secrets are configured via app settings or Key Vault integration.
- No token values are stored in source control.

Definition of done:

- Security checklist passes for deployment configuration.

## Epic 6: Next Iteration Backlog [JIRA: SCRUM-50]

### Story 6.1: Trend dashboards [JIRA: SCRUM-62]

As a manager, I want underpay and overpay trend charts so I can identify recurring employer issues.

### Story 6.2: Ticket integration [JIRA: SCRUM-63]

As an operations lead, I want severe exceptions to create tickets automatically so follow-up is trackable.

### Story 6.3: Multi-scheme support [JIRA: SCRUM-64]

As a product owner, I want support for additional pension schemes so the platform can scale beyond MPF.

---

## Jira Requirement Management in VS Code (Jira MCP)

This repo is configured to use Jira through MCP in [ .vscode/mcp.json ](.vscode/mcp.json).

### Current configuration

- Jira site: `<YOUR_JIRA_SITE_URL>`
- Jira account email: `<YOUR_JIRA_ACCOUNT_EMAIL>`
- MCP package: `@mcp-devtools/jira`
- Auth token source: user environment variable `JIRA_API_TOKEN`

### One-time local setup

1. Set Jira API token in PowerShell:

	 ```powershell
	 setx JIRA_API_TOKEN "<YOUR_JIRA_API_TOKEN>"
	 ```

2. Restart VS Code so environment variables are reloaded.
3. Open Copilot Chat and allow Jira MCP tool calls when prompted.

### Requirement-management prompts

Use these prompts directly in Copilot Chat:

- `List Jira projects I can access.`
- `Create an epic in project <KEY> titled "MPF Reconciliation Improvements" with acceptance criteria for underpay detection and explainability.`
- `Break epic <EPIC_KEY> into stories with estimates and dependencies for API, UI, and QA.`
- `Create a user story in project <KEY> for "Tolerance-based reconciliation" with detailed acceptance criteria and definition of done.`
- `Find all open issues in project <KEY> missing acceptance criteria and suggest updates.`
- `Transition issue <KEY-123> to In Progress and add a progress comment based on latest implementation status.`

### Recommended Jira fields for requirements

- Summary
- Description (problem, business value, scope)
- Acceptance Criteria
- Priority
- Story Points
- Labels/Component
- Dependencies/Linked Issues

### Security note

- Do not commit API tokens to source control.
- If a token is ever exposed in terminal/chat history, rotate it immediately in Atlassian and run `setx JIRA_API_TOKEN "<NEW_TOKEN>"`.

### Copilot comment convention

- For Jira comments added or updated by Copilot, append: `(updated by Copilot)`.
