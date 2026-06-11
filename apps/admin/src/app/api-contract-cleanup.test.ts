import { describe, expect, it } from 'vitest'

const appDirectory = 'app'
const libDirectory = 'lib'
const apiClientFile = 'api-client.ts'
const legacyApiStem = 'api'
const legacyApiFile = `${legacyApiStem}.ts`
const legacyApiTestFile = `${legacyApiStem}.test.ts`
const obsoleteApiFiles = new Set([
  `${appDirectory}/${apiClientFile}`,
  `${libDirectory}/${legacyApiFile}`,
  `${libDirectory}/${legacyApiTestFile}`,
])
const obsoleteImportPattern = new RegExp(
  `${appDirectory}/${apiClientFile.replace('.ts', '')}|` +
    `${libDirectory}/${legacyApiFile.replace('.ts', '')}|` +
    'create' +
    'Api' +
    'Client',
)
const sourceModules = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

function sourcePath(modulePath: string) {
  return modulePath.replace(/^\.\.\//, '')
}

describe('generated API migration cleanup', () => {
  it('does not keep or reference the old handwritten API client', () => {
    const files = Object.entries(sourceModules).map(([path, content]) => ({
      content,
      path: sourcePath(path),
    }))
    const obsoleteFiles = files
      .map((file) => file.path)
      .filter((path) => obsoleteApiFiles.has(path))
    const oldClientReferences = files.flatMap(({ content, path }) => {
      if (path === 'app/api-contract-cleanup.test.ts') {
        return []
      }

      return obsoleteImportPattern.test(content) ? [path] : []
    })

    expect({ obsoleteFiles, oldClientReferences }).toEqual({
      obsoleteFiles: [],
      oldClientReferences: [],
    })
  })
})
