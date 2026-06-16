# GHCR Image Publishing Design

## Goal

Add a GitHub Actions packaging path that builds the existing API and admin
Docker images and pushes them to GitHub Container Registry for Docker Compose
deployments on a cloud server.

## Approach

Keep the existing `docker-compose.yml` as the local/source-build deployment
entry point. Add a production override file that replaces the API and admin
`build` configuration with GHCR image references. The server deployment flow
then uses:

```bash
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose --env-file .env.deploy -f docker-compose.yml -f docker-compose.prod.yml up -d
```

GitHub Actions should publish images only after the `Quality` workflow succeeds
on `main`, and it should also support manual publishing through
`workflow_dispatch`.

## Images

Publish two images:

```text
ghcr.io/coder-li/common-admin-api
ghcr.io/coder-li/common-admin-admin
```

Each publish creates:

```text
latest
sha-<short-sha>
```

`latest` is the default production deployment tag. `sha-<short-sha>` gives a
stable rollback target.

## Files

Create:

```text
.github/workflows/docker-image.yml
docker-compose.prod.yml
docs/superpowers/plans/2026-06-16-ghcr-image-publishing.md
```

Modify:

```text
.env.deploy.example
README.md
```

## Deployment Notes

For public GHCR packages, the cloud server can pull anonymously. If GitHub keeps
the packages private, the server must run `docker login ghcr.io` with a token
that has package read permission.

Database migration and seed commands run from the published API image through
Compose, so the cloud server does not need pnpm installed.

