import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { assertPrefixFreeOpenApiPaths, createOpenApiDocument } from './openapi';

jest.mock('@nestjs/swagger', () => {
  const actual =
    jest.requireActual<typeof import('@nestjs/swagger')>('@nestjs/swagger');

  return {
    ...actual,
    SwaggerModule: {
      ...actual.SwaggerModule,
      createDocument: jest.fn(),
    },
  };
});

const mockedSwaggerModule = jest.mocked(SwaggerModule);

describe('openapi helpers', () => {
  it('exports a document factory', () => {
    expect(createOpenApiDocument).toEqual(expect.any(Function));
  });

  it('creates the shared OpenAPI document without the runtime global prefix', () => {
    const app = {} as Parameters<typeof createOpenApiDocument>[0];
    const document: OpenAPIObject = {
      openapi: '3.0.0',
      info: {
        title: 'Common Admin API',
        version: '0.1.0',
      },
      paths: {},
    };
    mockedSwaggerModule.createDocument.mockReturnValue(document);

    expect(createOpenApiDocument(app)).toBe(document);
    expect(mockedSwaggerModule.createDocument).toHaveBeenCalledWith(
      app,
      expect.any(Object),
      { ignoreGlobalPrefix: true },
    );

    const [, swaggerConfig] = mockedSwaggerModule.createDocument.mock.calls[0];
    expect(swaggerConfig.info).toEqual(
      expect.objectContaining({
        title: 'Common Admin API',
        description: 'API for the common admin starter template',
        version: '0.1.0',
      }),
    );
  });

  it('rejects generated paths that include the runtime API prefix', () => {
    expect(() =>
      assertPrefixFreeOpenApiPaths({ paths: { '/api/users': {} } }),
    ).toThrow('/api/users');
  });
});
