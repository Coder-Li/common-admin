import { defineConfig } from 'orval'
import type { GeneratorVerbOptions, GetterProp } from 'orval'

function useDirectUploadFormData(
  verb: GeneratorVerbOptions,
): GeneratorVerbOptions {
  if (verb.operationId !== 'uploadFile') {
    return verb
  }

  return {
    ...verb,
    body: {
      ...verb.body,
      definition: 'FormData',
      implementation: 'formData',
      imports: [],
      schemas: [],
      formData: undefined,
    },
    props: verb.props.map((prop): GetterProp =>
      prop.type === 'body'
        ? {
            ...prop,
            name: 'formData',
            definition: 'FormData',
            implementation: 'formData: FormData',
          }
        : prop,
    ),
  }
}

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
        transformer: useDirectUploadFormData,
        mutator: {
          path: './src/app/api-mutator.ts',
          name: 'apiMutator',
        },
        operations: {
          uploadFile: {
            formData: false,
          },
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
