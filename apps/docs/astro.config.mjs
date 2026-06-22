import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'

const link = (label, slug, zhLabel) => ({
  label,
  translations: { 'zh-CN': zhLabel },
  slug,
})

const group = (label, zhLabel, items) => ({
  label,
  translations: { 'zh-CN': zhLabel },
  items,
})

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
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
        'zh-cn': {
          label: '简体中文',
          lang: 'zh-CN',
        },
      },
      sidebar: [
        group('Start', '开始', [
          link('Introduction', 'introduction', '介绍'),
          link('Getting Started', 'getting-started', '快速开始'),
          link('Architecture', 'architecture', '架构'),
          link('FAQ', 'faq', '常见问题'),
          link('Troubleshooting', 'troubleshooting', '故障排查'),
          link('Feedback', 'feedback', '反馈'),
        ]),
        group('Operations', '运维', [
          link('Deployment', 'deployment', '部署'),
          link('Auth And Sessions', 'auth-and-sessions', '认证与会话'),
          link('Session Management', 'session-management', '会话管理'),
          link('Errors And Logging', 'errors-and-logging', '错误与日志'),
          link('Diagnostics And Health', 'diagnostics-and-health', '诊断与健康检查'),
          link('Audit Logs', 'audit-logs', '审计日志'),
          link('Settings', 'settings', '设置'),
          link('File Management', 'file-management', '文件管理'),
          link('Quality Gates', 'quality-gates', '质量门禁'),
          link('Upgrade Guide', 'upgrade-guide', '升级指南'),
          link('Release Checklist', 'release-checklist', '发布检查清单'),
        ]),
        group('Build With AI', '使用 AI 构建', [
          link('AI Guide', 'ai', 'AI 指南'),
          link('MCP Server', 'ai/mcp-server', 'MCP Server'),
          link('Skill', 'ai/skill', 'Skill'),
          link('Prompts', 'ai/prompts', '提示词'),
          link('Public AI Surfaces', 'public-ai-surfaces', '公共 AI 入口'),
        ]),
        group('Modules', '模块', [
          link('Users Roles And Permissions', 'users-roles-permissions', '用户、角色与权限'),
          link('Organization Structure', 'organization-structure', '组织结构'),
          link('Data Permissions', 'data-permissions', '数据权限'),
          link('Dictionaries', 'dictionaries', '字典'),
        ]),
        group('Patterns', '模式', [
          link('Resource Workflow', 'resource-workflow', '资源工作流'),
          link('API Contract', 'patterns/api-contract', 'API 契约'),
          link('CRUD Resource', 'patterns/crud-resource', 'CRUD 资源'),
          link('RBAC', 'patterns/rbac', 'RBAC'),
        ]),
      ],
    }),
    sitemap(),
  ],
})
