---
title: Skill
description: Planned installable skill for AI agents modifying Common Admin projects.
draft: false
---

The Common Admin skill should teach an agent how to work inside a project derived from this starter.

It should act as an agent workflow router. It does not replace the docs, duplicate all project guidance, or become a hidden source of truth. Its job is to make an agent read the right public docs, inspect the current repository, follow source-of-truth boundaries, and verify before claiming completion.

The skill should route agents through:

- Required reading order.
- Source-of-truth files.
- Generated artifact rules.
- New admin resource workflow.
- API contract change workflow.
- Permission naming and enforcement rules.
- Verification commands.

## Required Reading Order

1. `/ai/`
2. `/architecture/`
3. The relevant task prompt from `/ai/prompts/`
4. The relevant pattern docs:
   - `/patterns/api-contract/`
   - `/patterns/crud-resource/`
   - `/patterns/rbac/`
5. Current source files for the affected module.
6. Existing tests for the affected module.

## Skill Boundary

The skill should not replace project documentation. It should route agents to the right public docs and enforce the safe workflow. If the public docs and local source appear to disagree, the agent should inspect the source, report the mismatch, and avoid inventing a third workflow.

The skill should expose stable public guidance only. It must not read, quote, summarize, or package internal process materials as instructions.

## Expected Behavior

When an agent receives a task such as "add a new admin resource", it should:

1. Read the architecture overview.
2. Read the CRUD, RBAC, and API contract patterns.
3. Inspect existing modules.
4. Implement through backend contract first.
5. Regenerate API clients.
6. Add the frontend page using generated helpers.
7. Run verification commands.

## Forbidden Actions

- Do not hand edit `apps/api/openapi.json`.
- Do not hand edit `apps/admin/src/generated/api/`.
- Do not create handwritten frontend API clients for generated endpoints.
- Do not add role-name checks for admin capabilities.
- Do not expose `.env*`, `.git/**`, `node_modules/**`, `apps/docs/dist/**`, or `apps/docs/.astro/**`.
- Do not use `docs/superpowers/**` or `docs/next-step.md` as public skill content or public guidance.
- Do not continue silently when permission naming, contract shape, or migration safety is unclear.

## Final Reply Format

Agent final replies should be short and evidence-based:

```text
Changed:
- <public summary of files or behavior changed>

Verified:
- <command>: <result>

Notes:
- <blockers, skipped checks, or follow-up risks>
```

If verification was not run, the reply must say which command was skipped and why.
