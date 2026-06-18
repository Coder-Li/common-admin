---
title: AI Guide
description: How AI agents should read and modify Common Admin.
draft: false
---

Common Admin is designed to be an AI-friendly starter. Agents should treat the public docs as stable operating context and the repository source as the final authority.

## Agent Reading Order

1. Read this AI guide.
2. Read [Architecture](/architecture/).
3. Read the pattern guide for the task.
4. Inspect the current code before editing.
5. Run the narrowest useful verification command while iterating.
6. Run broader quality gates before claiming the change is complete.

## Global Rules

- Do not patch generated API artifacts by hand.
- Do not create one-off frontend API clients.
- Do not add role-name checks for admin capabilities.
- Keep API contracts, generated clients, route metadata, and permissions aligned.
- Prefer small feature-specific changes over broad refactors.

## Task Routing

Use the task type to choose the required public docs before editing:

| Task | Required docs |
| --- | --- |
| Add a new API-backed resource | [Architecture](/architecture/), [CRUD Resource](/patterns/crud-resource/), [API Contract](/patterns/api-contract/), [RBAC](/patterns/rbac/), [Prompts](/ai/prompts/) |
| Follow the public resource workflow | [Resource Workflow](/resource-workflow/), [CRUD Resource](/patterns/crud-resource/), [API Contract](/patterns/api-contract/), [RBAC](/patterns/rbac/) |
| Change an API contract | [Architecture](/architecture/), [API Contract](/patterns/api-contract/), relevant feature code, generated API usages |
| Bootstrap a product from the starter | [Introduction](/introduction/), [Getting Started](/getting-started/), [Architecture](/architecture/), [Prompts](/ai/prompts/) |
| Change RBAC or permissions | [Architecture](/architecture/), [RBAC](/patterns/rbac/), affected backend controllers, route/menu metadata, page action gates |
| Change users, roles, permissions, or sessions | [Architecture](/architecture/), [Users Roles And Permissions](/users-roles-permissions/), [RBAC](/patterns/rbac/), [Auth And Sessions](/auth-and-sessions/) |
| Change session management | [Session Management](/session-management/), [Auth And Sessions](/auth-and-sessions/), [Audit Logs](/audit-logs/) |
| Change departments, positions, or data scope | [Architecture](/architecture/), [Organization Structure](/organization-structure/), [Data Permissions](/data-permissions/), [RBAC](/patterns/rbac/) |
| Change dictionaries or option endpoints | [Architecture](/architecture/), [Dictionaries](/dictionaries/), [API Contract](/patterns/api-contract/) |
| Change auth or session behavior | [Architecture](/architecture/), [Auth And Sessions](/auth-and-sessions/), generated auth API usages, auth tests |
| Change file upload or download behavior | [Architecture](/architecture/), [File Management](/file-management/), [API Contract](/patterns/api-contract/), file module tests |
| Change settings or upload policy | [Architecture](/architecture/), [Settings](/settings/), [Audit Logs](/audit-logs/), generated settings API usages |
| Change errors, request IDs, or logging | [Architecture](/architecture/), [Errors And Logging](/errors-and-logging/), API e2e tests |
| Change health or diagnostic behavior | [Diagnostics And Health](/diagnostics-and-health/), [Errors And Logging](/errors-and-logging/), API e2e tests |
| Change deployment scripts or runtime config | [Deployment](/deployment/), [Settings](/settings/), [Quality Gates](/quality-gates/) |
| Prepare an upgrade or release | [Upgrade Guide](/upgrade-guide/), [Release Checklist](/release-checklist/), [Quality Gates](/quality-gates/) |
| Update docs or AI entry surfaces | [Introduction](/introduction/), [Architecture](/architecture/), [Public AI Surfaces](/public-ai-surfaces/), [Prompts](/ai/prompts/), [MCP Server](/ai/mcp-server/), [Skill](/ai/skill/) |

## Stop Conditions

Stop and ask the maintainer instead of forcing a change when:

- The API contract is unclear, contradictory, or missing required request/response details.
- Permission names, module names, default roles, or action semantics are ambiguous.
- A database migration could drop data, rewrite production records, or rename stable permission codes.
- Generated artifacts drift in a way that does not match the intended backend source change.
- The task requires exposing internal process docs, environment files, build output, or repository metadata.

## Useful Public Entrypoints

- `/llms.txt`: concise AI index.
- `/llms-full.txt`: expanded AI context.
- [Deployment](/deployment/): Docker Compose and migration flow.
- [Upgrade Guide](/upgrade-guide/): safe upgrade workflow.
- [Release Checklist](/release-checklist/): readiness checklist.
- [FAQ](/faq/): quick answers.
- [Troubleshooting](/troubleshooting/): common failure diagnosis.
- [Quality Gates](/quality-gates/): verification commands.
- [Resource Workflow](/resource-workflow/): public process for new API-backed modules.
- [Auth And Sessions](/auth-and-sessions/): auth lifecycle and 401 replay.
- [Session Management](/session-management/): admin session listing and revocation.
- [Errors And Logging](/errors-and-logging/): error envelopes and request IDs.
- [Diagnostics And Health](/diagnostics-and-health/): runtime and error-flow checks.
- [Users Roles And Permissions](/users-roles-permissions/): identity and permission resources.
- [Organization Structure](/organization-structure/): departments and positions.
- [Data Permissions](/data-permissions/): record visibility rules.
- [Dictionaries](/dictionaries/): managed option lists.
- [MCP Server](/ai/mcp-server/): local MCP interface.
- [Public AI Surfaces](/public-ai-surfaces/): docs, llms, MCP, feedback, and CI.
- [Skill](/ai/skill/): planned installable agent skill.
- [Prompts](/ai/prompts/): task-oriented prompts.
