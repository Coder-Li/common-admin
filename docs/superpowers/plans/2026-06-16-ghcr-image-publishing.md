# GHCR Image Publishing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish API and admin Docker images to GHCR and provide a Docker Compose production override that pulls those images.

**Architecture:** Reuse the existing Dockerfiles and Compose services. Add one GitHub Actions workflow for image publishing after `Quality` succeeds, plus one Compose override file that switches API/admin from local `build` to GHCR `image` references.

**Tech Stack:** GitHub Actions, GHCR, Docker Buildx, Docker Compose, pnpm workspace Dockerfiles.

---

## Chunk 1: Image Publishing Workflow

### Task 1: Add GHCR Workflow

**Files:**
- Create: `.github/workflows/docker-image.yml`

- [x] Create a workflow triggered by successful `Quality` workflow runs on `main` and by manual `workflow_dispatch`.
- [x] Grant `contents: read` and `packages: write`.
- [x] Login to `ghcr.io` with `GITHUB_TOKEN`.
- [x] Build and push API image from `apps/api/Dockerfile`.
- [x] Build and push admin image from `apps/admin/Dockerfile` with `VITE_API_BASE_URL=/api`.
- [x] Tag both images as `latest` and `sha-<short-sha>`.

## Chunk 2: Production Compose Override

### Task 2: Add Pull-Based Compose File

**Files:**
- Create: `docker-compose.prod.yml`
- Modify: `.env.deploy.example`

- [x] Add image variables for API/admin image names and the deployment tag.
- [x] Override API/admin services to use GHCR images.
- [x] Reset local `build` configuration in production mode.
- [x] Prefer pulling images when starting the production stack.

## Chunk 3: Deployment Documentation

### Task 3: Document Image Publishing And Server Deployment

**Files:**
- Modify: `README.md`

- [x] Document that GitHub Actions publishes images after `Quality` succeeds.
- [x] Document cloud-server commands using `docker-compose.prod.yml`.
- [x] Document initial deployment, later upgrades, image tags, and GHCR login note.

## Verification

- [ ] Run YAML parsing or `gh workflow view` after commit.
- [ ] Run `docker compose --env-file .env.deploy.example -f docker-compose.yml -f docker-compose.prod.yml config`.
- [ ] Push to `main`.
- [ ] Confirm `Quality` succeeds.
- [ ] Confirm `Docker Image` publishes both GHCR images.

