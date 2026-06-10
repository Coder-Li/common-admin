import { defineConfig } from 'orval'

export default defineConfig({
  adminApi: {
    input: {
      target: '../api/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/generated/api/endpoints',
      schemas: 'src/generated/api/schemas',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      formatter: 'prettier',
      override: {
        mutator: {
          path: './src/app/api-mutator.ts',
          name: 'apiMutator',
        },
        operations: {
          downloadFile: {
            requestOptions: {
              responseType: 'blob',
            },
          },
        },
      },
    },
  },
})
