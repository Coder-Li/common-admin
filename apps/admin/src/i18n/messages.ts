export const supportedLocales = ['en-US', 'zh-CN'] as const

export type Locale = (typeof supportedLocales)[number]

export const defaultLocale: Locale = 'en-US'

export function isSupportedLocale(value: string | null): value is Locale {
  return supportedLocales.includes(value as Locale)
}

export const messages = {
  'en-US': {
    'app.subtitle': 'Starter template',
    'auth.invalidCredentials': 'Invalid username or password',
    'auth.password': 'Password',
    'auth.signIn': 'Sign in',
    'auth.signInCta': 'Sign in',
    'auth.signInSubtitle': 'Sign in to continue',
    'auth.signingIn': 'Signing in',
    'auth.usernameOrEmail': 'Username or email',
    'auth.welcomeBack': 'Welcome back, {firstName}',
    'dashboard.currentUser': 'Current user',
    'dashboard.email': 'Email',
    'dashboard.loadedFrom': 'Loaded from',
    'dashboard.loadingProfile': 'Loading profile...',
    'dashboard.name': 'Name',
    'dashboard.nextSlice': 'Next slice',
    'dashboard.nextSliceDescription':
      'The template is ready for server-side user tables, role controls, and OpenAPI-generated client types.',
    'dashboard.role': 'Role',
    'dashboard.username': 'Username',
    'language.label': 'Language',
    'language.english': 'EN',
    'language.chinese': '中文',
    'nav.dashboard': 'Dashboard',
    'nav.settings': 'Settings',
    'nav.users': 'Users',
    'page.apiActive': 'API connection is active',
    'page.settingsDescription':
      'Application preferences and account settings will live here.',
    'page.signOut': 'Sign out',
    'page.usersDescription':
      'User management will be wired to server-side tables next.',
  },
  'zh-CN': {
    'app.subtitle': '启动模板',
    'auth.invalidCredentials': '用户名或密码无效',
    'auth.password': '密码',
    'auth.signIn': '登录',
    'auth.signInCta': '登录',
    'auth.signInSubtitle': '登录后继续',
    'auth.signingIn': '正在登录',
    'auth.usernameOrEmail': '用户名或邮箱',
    'auth.welcomeBack': '欢迎回来，{firstName}',
    'dashboard.currentUser': '当前用户',
    'dashboard.email': '邮箱',
    'dashboard.loadedFrom': '加载自',
    'dashboard.loadingProfile': '正在加载资料...',
    'dashboard.name': '姓名',
    'dashboard.nextSlice': '下一步',
    'dashboard.nextSliceDescription':
      '模板已准备好接入服务端用户表、角色控制和 OpenAPI 生成的客户端类型。',
    'dashboard.role': '角色',
    'dashboard.username': '用户名',
    'language.label': '语言',
    'language.english': 'EN',
    'language.chinese': '中文',
    'nav.dashboard': '仪表盘',
    'nav.settings': '设置',
    'nav.users': '用户',
    'page.apiActive': 'API 连接正常',
    'page.settingsDescription': '应用偏好和账号设置会放在这里。',
    'page.signOut': '退出登录',
    'page.usersDescription': '用户管理接下来会接入服务端表格。',
  },
} satisfies Record<Locale, Record<string, string>>

export type MessageKey = keyof (typeof messages)['en-US']

export type TranslationValues = Record<string, string | number>
