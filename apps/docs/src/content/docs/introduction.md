---
title: Common Admin
description: An AI-friendly admin starter for teams building production admin systems with agents.
draft: false
---

Common Admin is a reusable admin starter built around a NestJS API, a React admin app, RBAC permissions, OpenAPI generation, and quality gates.

It is intended to be a production admin starting point, not a demo scaffold. The template keeps the boring but important parts of an internal operations product in place: authentication, refresh-token sessions, permission-aware navigation, generated API clients, database migrations, tests, and repeatable verification commands.

The project is designed for two readers:

- Developers who want a practical admin foundation.
- AI agents that need stable project context before making changes.

This public documentation is intentionally separate from the repository's internal working notes. It exposes the stable architecture, workflows, and agent instructions that are useful outside the development process.

## Core Commitments

- **NestJS API**: backend modules own persistence, validation, business logic, auth, RBAC, OpenAPI metadata, and error behavior.
- **React admin app**: frontend pages consume generated API functions, schema types, query hooks, and query key helpers.
- **Prisma persistence**: schema and migrations describe the database shape for API modules.
- **RBAC permissions**: admin capabilities use stable `module.action` permission codes rather than role-name checks.
- **OpenAPI contract flow**: backend DTOs and Swagger metadata generate `apps/api/openapi.json`, which then generates the frontend API client.
- **Generated client boundary**: generated artifacts are committed for review, but they are read-only for humans and agents.
- **Quality gates**: changes are expected to pass API drift checks, linting, tests, API e2e tests when relevant, and builds.

## What Is Included

- Authentication and refresh-token session handling.
- RBAC users, roles, permissions, and route guards.
- Organization, department, position, and data permission foundations.
- Dictionaries, file management, audit logs, and system settings.
- OpenAPI contract generation and generated frontend API clients.
- AI-oriented task protocols for repeatable project changes.

Developer topic guides cover the operational surfaces that tend to affect more
than one module:

- [Deployment](/deployment/) for Docker Compose, migrations, seed behavior, and deployment-only configuration.
- [Upgrade Guide](/upgrade-guide/) for moving deployments or derived projects forward safely.
- [Release Checklist](/release-checklist/) for branch and release readiness.
- [Auth And Sessions](/auth-and-sessions/) for login, refresh, logout, cookies, and 401 replay behavior.
- [Session Management](/session-management/) for admin listing and revocation of user sessions.
- [Errors And Logging](/errors-and-logging/) for error envelopes, request IDs, structured logs, and redaction.
- [Diagnostics And Health](/diagnostics-and-health/) for health checks and diagnostic request-flow validation.
- [Audit Logs](/audit-logs/) for accountability records and payload sanitization.
- [Settings](/settings/) for runtime-editable settings and deployment-only configuration boundaries.
- [File Management](/file-management/) for upload/download contracts and storage safety.
- [Quality Gates](/quality-gates/) for verification commands and branch readiness.
- [Troubleshooting](/troubleshooting/) for common setup, auth, API drift, migration, upload, and docs build failures.
- [FAQ](/faq/) for quick answers to common Common Admin questions.

Module guides cover starter-provided resources:

- [Users Roles And Permissions](/users-roles-permissions/) for identity, role assignment, permission catalog, and session management.
- [Organization Structure](/organization-structure/) for departments and positions.
- [Data Permissions](/data-permissions/) for department-scoped user visibility rules.
- [Dictionaries](/dictionaries/) for managed option lists and option endpoints.
- [Resource Workflow](/resource-workflow/) for the public end-to-end process for adding an API-backed admin module.
- [Public AI Surfaces](/public-ai-surfaces/) for docs, llms files, MCP, feedback, and CI boundaries.

## Public Documentation Boundary

The public docs describe the stable starter architecture and workflows. They must not expose secrets, local environment files, generated build output, or internal planning history.

In particular, `docs/superpowers/**` is internal historical process material. It can help maintainers understand how the project was built, but it is not public guidance and must not be used as a source for public documentation, `llms.txt`, `llms-full.txt`, MCP tools, or installable skills.

## Where To Start

- Read [Getting Started](/getting-started/) to run the project locally.
- Read [Architecture](/architecture/) to understand the system shape.
- Read [FAQ](/faq/) for quick answers.
- Read [Troubleshooting](/troubleshooting/) when setup, API drift, auth, or docs build behavior is unclear.
- Read [Quality Gates](/quality-gates/) before treating a branch as ready.
- Read [AI Guide](/ai/) before asking an agent to modify the project.
