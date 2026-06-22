import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://coder-li.github.io',
  base: '/common-admin',
  integrations: [
    starlight({
      title: 'Common Admin',
      description:
        'An AI-friendly admin starter for NestJS, React, RBAC, OpenAPI, and agentic development workflows.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/coder-li/common-admin',
        },
      ],
      sidebar: [
        {
          label: 'Start',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Getting Started', slug: 'getting-started' },
            { label: 'Architecture', slug: 'architecture' },
            { label: 'FAQ', slug: 'faq' },
            { label: 'Troubleshooting', slug: 'troubleshooting' },
            { label: 'Feedback', slug: 'feedback' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Deployment', slug: 'deployment' },
            { label: 'Auth And Sessions', slug: 'auth-and-sessions' },
            { label: 'Session Management', slug: 'session-management' },
            { label: 'Errors And Logging', slug: 'errors-and-logging' },
            { label: 'Diagnostics And Health', slug: 'diagnostics-and-health' },
            { label: 'Audit Logs', slug: 'audit-logs' },
            { label: 'Settings', slug: 'settings' },
            { label: 'File Management', slug: 'file-management' },
            { label: 'Quality Gates', slug: 'quality-gates' },
            { label: 'Upgrade Guide', slug: 'upgrade-guide' },
            { label: 'Release Checklist', slug: 'release-checklist' },
          ],
        },
        {
          label: 'Build With AI',
          items: [
            { label: 'AI Guide', slug: 'ai' },
            { label: 'MCP Server', slug: 'ai/mcp-server' },
            { label: 'Skill', slug: 'ai/skill' },
            { label: 'Prompts', slug: 'ai/prompts' },
            { label: 'Public AI Surfaces', slug: 'public-ai-surfaces' },
          ],
        },
        {
          label: 'Modules',
          items: [
            { label: 'Users Roles And Permissions', slug: 'users-roles-permissions' },
            { label: 'Organization Structure', slug: 'organization-structure' },
            { label: 'Data Permissions', slug: 'data-permissions' },
            { label: 'Dictionaries', slug: 'dictionaries' },
          ],
        },
        {
          label: 'Patterns',
          items: [
            { label: 'Resource Workflow', slug: 'resource-workflow' },
            { label: 'API Contract', slug: 'patterns/api-contract' },
            { label: 'CRUD Resource', slug: 'patterns/crud-resource' },
            { label: 'RBAC', slug: 'patterns/rbac' },
          ],
        },
      ],
    }),
    sitemap(),
  ],
})
