import type { INestApplication } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ErrorResponseDto } from './common/errors/error-response.dto';
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
  'getBasicSettings',
  'updateBasicSettings',
  'getUploadSettings',
  'updateUploadSettings',
  'refreshDictionaryCache',
  'getSystemInfo',
  'listAuditLogs',
  'getAuditLog',
] as const;

type SwaggerOperationLike = {
  operationId: string;
};

type OpenApiPathOperation = {
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: unknown }>;
    }
  >;
};

type OpenApiSchemaWithProperties = {
  properties?: Record<string, unknown>;
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

async function createTestOpenApiDocument(): Promise<{
  app: INestApplication;
  document: OpenAPIObject;
}> {
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
  await app.init();

  return { app, document: createOpenApiDocument(app) };
}

function getOperation(
  document: OpenAPIObject,
  path: string,
  method: string,
): OpenApiPathOperation {
  const pathItem = (document.paths as Record<string, Record<string, unknown>>)[
    path
  ];

  return pathItem?.[method] as OpenApiPathOperation;
}

function getSchemaProperty(
  document: OpenAPIObject,
  schemaName: string,
  propertyName: string,
) {
  const schema = document.components?.schemas?.[schemaName] as
    | OpenApiSchemaWithProperties
    | undefined;

  return schema?.properties?.[propertyName];
}

function getInlineSchemaProperty(schema: unknown, propertyName: string) {
  return (schema as OpenApiSchemaWithProperties | undefined)?.properties?.[
    propertyName
  ];
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

    try {
      expect(createOpenApiDocument(app)).toBe(document);
      expect(createDocumentSpy).toHaveBeenCalledWith(app, expect.any(Object), {
        ignoreGlobalPrefix: true,
        extraModels: [ErrorResponseDto],
      });

      const [, swaggerConfig] = createDocumentSpy.mock.calls[0];
      expect(swaggerConfig.info).toEqual(
        expect.objectContaining({
          title: 'Common Admin API',
          description: 'API for the common admin starter template',
          version: '0.1.0',
        }),
      );
    } finally {
      createDocumentSpy.mockRestore();
    }
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
        getSchemaProperty(document, 'UpdateRoleDto', 'description'),
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'RoleResponseDto', 'description'),
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

  it('documents nullable dictionary update fields', async () => {
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
        getSchemaProperty(document, 'UpdateDictionaryTypeDto', 'description'),
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'UpdateDictionaryItemDto', 'description'),
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'UpdateDictionaryItemDto', 'badgeVariant'),
      ).toEqual(
        expect.objectContaining({
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'UpdateDictionaryItemDto', 'metadata'),
      ).toEqual(
        expect.objectContaining({
          type: 'object',
          nullable: true,
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('documents file uploads as multipart form data with a binary file', async () => {
    const { app, document } = await createTestOpenApiDocument();

    try {
      const operation = getOperation(document, '/files', 'post');
      const multipartContent =
        operation.requestBody?.content?.['multipart/form-data'];

      expect(multipartContent).toBeDefined();
      expect(getInlineSchemaProperty(multipartContent?.schema, 'file')).toEqual(
        expect.objectContaining({
          type: 'string',
          format: 'binary',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('documents file downloads as binary content', async () => {
    const { app, document } = await createTestOpenApiDocument();

    try {
      const operation = getOperation(document, '/files/{id}/download', 'get');
      const okResponse = operation.responses?.['200'];
      const binaryContent = okResponse?.content?.['application/octet-stream'];

      expect(binaryContent).toBeDefined();
      expect(binaryContent?.schema).toEqual({
        type: 'string',
        format: 'binary',
      });
    } finally {
      await app.close();
    }
  });

  it('documents the shared error response schema on auth login validation errors', async () => {
    const { app, document } = await createTestOpenApiDocument();

    try {
      expect(document.components?.schemas?.ErrorResponseDto).toBeDefined();

      const operation = getOperation(document, '/auth/login', 'post');
      const badRequestResponse = operation.responses?.['400'];

      expect(badRequestResponse?.content?.['application/json']?.schema).toEqual(
        { $ref: '#/components/schemas/ErrorResponseDto' },
      );
    } finally {
      await app.close();
    }
  });

  it('documents nullable file string fields as strings', async () => {
    const { app, document } = await createTestOpenApiDocument();

    try {
      expect(
        getSchemaProperty(document, 'UpdateFileDto', 'description'),
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'FileResponseDto', 'description'),
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'FileResponseDto', 'extension'),
      ).toEqual(
        expect.objectContaining({
          type: 'string',
          nullable: true,
        }),
      );
      expect(
        getSchemaProperty(document, 'FileResponseDto', 'uploadedById'),
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
