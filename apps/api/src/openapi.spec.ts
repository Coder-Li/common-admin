import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { assertPrefixFreeOpenApiPaths, createOpenApiDocument } from './openapi';
import { PrismaService } from './prisma/prisma.service';

const expectedOperationIds = [
  'checkHealth',
  'login',
  'refreshSession',
  'logout',
  'changePassword',
  'getCurrentUser',
  'listUsers',
  'getUser',
  'createUser',
  'updateUser',
  'deleteUser',
  'replaceUserRoles',
  'resetUserPassword',
  'listRoles',
  'getRole',
  'createRole',
  'updateRole',
  'deleteRole',
  'replaceRolePermissions',
  'listPermissions',
  'listPermissionModules',
  'getDictionaryOptionsMap',
  'getDictionaryOptions',
  'listDictionaryTypes',
  'getDictionaryType',
  'createDictionaryType',
  'updateDictionaryType',
  'deleteDictionaryType',
  'listDictionaryItems',
  'getDictionaryItem',
  'createDictionaryItem',
  'updateDictionaryItem',
  'deleteDictionaryItem',
  'listFiles',
  'getFile',
  'uploadFile',
  'updateFile',
  'deleteFile',
  'downloadFile',
  'listAuditLogs',
  'getAuditLog',
] as const;

type SwaggerOperationLike = {
  operationId: string;
};

function hasOperationId(value: unknown): value is SwaggerOperationLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'operationId' in value &&
    typeof (value as { operationId?: unknown }).operationId === 'string'
  );
}

function collectOperationIds(document: OpenAPIObject): string[] {
  const paths = document.paths as Record<
    string,
    Record<string, unknown> | undefined
  >;

  return Object.values(paths).flatMap((pathItem) =>
    Object.values(pathItem ?? {}).flatMap((operation) =>
      hasOperationId(operation) ? [operation.operationId] : [],
    ),
  );
}

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
    const createDocumentSpy = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue(document);

    expect(createOpenApiDocument(app)).toBe(document);
    expect(createDocumentSpy).toHaveBeenCalledWith(app, expect.any(Object), {
      ignoreGlobalPrefix: true,
    });

    const [, swaggerConfig] = createDocumentSpy.mock.calls[0];
    expect(swaggerConfig.info).toEqual(
      expect.objectContaining({
        title: 'Common Admin API',
        description: 'API for the common admin starter template',
        version: '0.1.0',
      }),
    );

    createDocumentSpy.mockRestore();
  });

  it('rejects generated paths that include the runtime API prefix', () => {
    expect(() =>
      assertPrefixFreeOpenApiPaths({ paths: { '/api/users': {} } }),
    ).toThrow('/api/users');
  });
});

describe('OpenAPI operation ids', () => {
  it('defines each generated endpoint operation id exactly once', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');

    try {
      await app.init();
      const document = createOpenApiDocument(app);
      const operationIds = collectOperationIds(document);
      const operationIdCounts = operationIds.reduce<Record<string, number>>(
        (counts, operationId) => ({
          ...counts,
          [operationId]: (counts[operationId] ?? 0) + 1,
        }),
        {},
      );

      expect(operationIds).toHaveLength(expectedOperationIds.length);
      for (const operationId of expectedOperationIds) {
        expect(operationIdCounts[operationId]).toBe(1);
      }
    } finally {
      await app.close();
    }
  });

  it('documents nullable role descriptions as strings', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');

    try {
      await app.init();
      const document = createOpenApiDocument(app);

      expect(
        document.components?.schemas?.UpdateRoleDto?.properties?.description,
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        document.components?.schemas?.RoleResponseDto?.properties?.description,
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
    } finally {
      await app.close();
    }
  });
});
