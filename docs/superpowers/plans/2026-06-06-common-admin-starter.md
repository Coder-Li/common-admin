# Common Admin Starter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pnpm monorepo starter with `apps/api` NestJS and `apps/admin` React/Vite/shadcn, with a working login and `/users/me` backend/frontend link.

**Architecture:** The API owns auth, user profile, Prisma, Postgres, Redis configuration, and Swagger. The admin app owns layout, login UI, route guard, auth store, and a small API client. Keep the first milestone minimal: seed one admin user, login with username/email plus password, store bearer tokens client-side, call `/users/me`, and redirect protected routes when unauthenticated.

**Tech Stack:** pnpm workspaces, NestJS, Prisma, PostgreSQL, Redis/ioredis, JWT, bcrypt, React, Vite, Tailwind CSS, shadcn/ui, TanStack Router, TanStack Query, Zustand, Axios, Vitest/Jest.

---

## Chunk 1: Monorepo Skeleton

### Task 1: Workspace files

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Create root workspace config**

Add root scripts for `dev`, `dev:api`, `dev:admin`, `build`, `test`, `lint`, and `format`.

- [ ] **Step 2: Verify pnpm sees the workspace**

Run: `pnpm -r list --depth -1`

Expected: exits successfully after apps are created.

## Chunk 2: API

### Task 2: Scaffold and harden `apps/api`

**Files:**
- Create/Modify: `apps/api/**`

- [ ] **Step 1: Scaffold NestJS**

Create a NestJS app under `apps/api`.

- [ ] **Step 2: Add Prisma, auth, env, and tests**

Implement modules for env validation, Prisma, health, auth, users, and Redis provider. Seed one admin user: `admin@example.com / Admin123!`.

- [ ] **Step 3: Verify API**

Run: `pnpm --filter api test`

Expected: auth service/controller tests pass.

Run: `pnpm --filter api build`

Expected: TypeScript build succeeds.

## Chunk 3: Admin

### Task 3: Scaffold and wire `apps/admin`

**Files:**
- Create/Modify: `apps/admin/**`

- [ ] **Step 1: Scaffold Vite React**

Create a React/Vite app under `apps/admin` using Tailwind and shadcn-style local components.

- [ ] **Step 2: Add auth API client and protected app shell**

Implement login, auth store, route guard, dashboard, and `/users/me` bootstrap.

- [ ] **Step 3: Verify admin**

Run: `pnpm --filter admin test`

Expected: auth store/API tests pass.

Run: `pnpm --filter admin build`

Expected: Vite build succeeds.

## Chunk 4: End-To-End Developer Flow

### Task 4: Local run docs and final verification

**Files:**
- Modify: `README.md`
- Create: `.env.example`
- Create: `apps/api/.env.example`
- Create: `apps/admin/.env.example`

- [ ] **Step 1: Document local Postgres and Redis setup**

Describe expected local services and commands. Do not add Docker as the primary path.

- [ ] **Step 2: Run full verification**

Run: `pnpm install`

Run: `pnpm -r test`

Run: `pnpm -r build`

Expected: all commands exit 0, or document exact blockers.
