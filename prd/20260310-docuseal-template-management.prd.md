# DocuSeal Template Management PRD

**Date:** 2026-03-10
**Author:** Cascade (AI pair engineer)
**Stakeholders:** Cesar (Founder), Ops/Admin team, Engineering (Frontend + Backend)

## 1. Context
Laburauto currently wires each contract flow (publisher onboarding, publisher↔renter rental agreement) to DocuSeal templates via environment variables. This prevents admins from self-managing templates, makes it impossible to preview or switch templates without a deploy, and blocks exposing the full DocuSeal catalog (filtered by naming convention such as `LABURAUTO_*`) in the UI. We need an in-app experience that lists DocuSeal templates, lets admins set the active template for each contract type, and links directly to DocuSeal for edits.

## 2. Problem Statement
Admins cannot:
1. Discover which DocuSeal templates are available under a configured name regex (e.g., `LABURAUTO_*`).
2. Switch the "active" template for publisher or renter contracts without changing environment variables.
3. Jump from the Laburauto admin UI into DocuSeal to edit/view a template.
4. Audit which template is currently active and when it last changed.

## 3. Goals & Success Criteria
- **G1:** Surface every DocuSeal template (optionally filtered by environment-provided name regex) inside the Laburauto admin UI with metadata (name, type, last updated).
- **G2:** Allow admins to designate the active template for each contract type (publisher onboarding vs rental agreement) without editing env vars.
- **G3:** Provide direct links from each template card to the DocuSeal instance (docs.askn.us) for convenience.
- **G4:** Ensure backend contract creation/signing flows use the active template stored in the DB.
- **G5:** Record audit metadata (who toggled active template + when) for traceability.

**Success Metrics**
- T1: 100% of new contract instances pull template IDs from DB, not env vars.
- T2: Admins can switch active templates in < 30 seconds; change reflected without redeploy.
- T3: Zero regressions in DocuSeal submission creation and webhook handling (monitored via logs/tests).

## 4. Non-Goals
- Building a full DocuSeal editor (we only link out).
- Managing DocuSeal user provisioning or auth.
- Replacing DocuSeal tagging UI (we read tags only).

## 5. Users & Use Cases
- **Backoffice Admin:** Needs to review available templates, set the correct active contract, and open DocuSeal to adjust wording.
- **Publisher Ops:** Needs visibility into which template is live to coordinate legal/compliance sign-off.

## 6. User Stories
1. *As an admin,* I can view all DocuSeal templates filtered by a configured name regex so I know what documents exist.
2. *As an admin,* I can mark any template as the active publisher-onboarding agreement and instantly update the platform.
3. *As an admin,* I can mark a template as the active rental agreement for publisher↔renter contracts.
4. *As an admin,* I can click "Abrir en DocuSeal" to jump to docs.askn.us for the template I'm inspecting.
5. *As an engineer,* I can rely on DB-backed template IDs so contract creation is environment-agnostic.

## 7. Functional Requirements
1. **Template Catalog Sync**
   - Backend fetches DocuSeal templates via API, filtered by `DOCUSEAL_TEMPLATE_NAME_REGEX` (supports simple glob/regex such as `LABURAUTO_*`). If unset, list all templates.
   - Upsert templates into `contract_templates` with fields: `docusealTemplateId`, `docusealName`, `docusealNameMatchesFilter`, `docusealPreviewUrl`, `docusealLastSyncedAt`.
   - Provide manual sync endpoint for admins.

2. **Active Template Selection**
   - Add columns `isActivePublisherEnrollment`, `isActiveRentalAgreement`, and `activatedBy/activatedAt` metadata.
   - Backend mutation to set a template active for a contract type (enforces single active template per type).
   - Contract creation (`ensureDocusealSubmissionForInstance`) uses the template flagged active; env vars become fallback only if no active template exists.

3. **Admin UI**
   - `AdminContractTemplates` lists templates grouped by type with badges for active state and indicates whether they match the regex filter.
   - Each card shows: name, type, DocuSeal template ID, stage count, field count, last sync timestamp, active-state controls, and "Ver en DocuSeal" link.
   - Provide buttons to set template active for each contract type (disabled if already active).
   - Provide "Sincronizar" button to trigger backend sync.

4. **DocuSeal Linkage**
   - Use `DOCUSEAL_PUBLIC_URL` to build `https://docs.askn.us/templates/{docusealTemplateId}` (fallback to general dashboard if ID missing).

5. **Audit + Logging**
   - Record `activatedByUserId` + `activatedAt` per contract type.
   - Log DocuSeal sync runs and active toggles in server logs.

## 8. Non-Functional Requirements
- Sync + toggling endpoints require admin auth; rate-limit sync to avoid DocuSeal API abuse.
- UI must respond within <1s for listing (cached data from DB).
- Backend must handle DocuSeal downtime gracefully (surface error to UI, keep prior data).

## 9. Dependencies / Risks
- DocuSeal API availability and permissions (requires API key with template read scope).
- Database migration to extend `contract_templates`.
- Need to retire env-based template IDs carefully to avoid downtime.
- Potential mismatches between DocuSeal name regex and actual naming convention.

## 10. Rollout Plan
1. **Phase 1:** Backend migration + DocuSeal template sync endpoint, but still respect env fallback.
2. **Phase 2:** Admin UI for listing & toggling active templates; add DocuSeal links.
3. **Phase 3:** Remove env fallback once admins set active templates and verify flows.
4. **Phase 4:** Update documentation (README + onboarding runbook) with new workflow.

## 11. QA / Validation
- Unit + integration tests for template sync, active selection, fallback logic.
- Manual test: set active template, create publisher and rental contract, ensure DocuSeal submission uses new template.
- Manual test: DocuSeal webhook still updates contract instances.

## 12. Open Questions
- Do we need multi-environment segregation (e.g., staging vs prod tags)?
- Should we support multiple regex patterns (publisher vs renter) or a single shared regex?
- Should we expose DocuSeal preview (PDF) inline, or is link-out sufficient? (Out of scope for V1.)
