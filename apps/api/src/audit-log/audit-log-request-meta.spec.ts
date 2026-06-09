import type { JwtUserPayload } from '../user/user.types';

import { buildAuditActor, getAuditRequestMeta } from './audit-log-request-meta';

describe('audit log request helpers', () => {
  it('maps JWT user payload to an audit actor', () => {
    const user: JwtUserPayload = {
      sub: 'user-1',
      sid: 'session-1',
      email: 'admin@example.com',
      username: 'Admin User',
    };

    expect(buildAuditActor(user)).toStrictEqual({
      userId: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
    });
  });

  it('omits optional audit actor fields when they are missing', () => {
    const user: JwtUserPayload = {
      sub: 'user-1',
      sid: 'session-1',
    };

    expect(buildAuditActor(user)).toStrictEqual({
      userId: 'user-1',
    });
  });

  it('extracts only IP address and user agent from the request', () => {
    const request = {
      ip: '203.0.113.10',
      headers: {
        'user-agent': 'Mozilla/5.0',
        authorization: 'Bearer secret',
      },
    };

    expect(getAuditRequestMeta(request)).toStrictEqual({
      ipAddress: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('omits request metadata fields when they are missing', () => {
    expect(
      getAuditRequestMeta({
        ip: undefined,
        headers: {},
      }),
    ).toStrictEqual({});

    expect(
      getAuditRequestMeta({
        ip: '203.0.113.10',
        headers: {},
      }),
    ).toStrictEqual({
      ipAddress: '203.0.113.10',
    });

    expect(
      getAuditRequestMeta({
        ip: undefined,
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      }),
    ).toStrictEqual({
      userAgent: 'Mozilla/5.0',
    });
  });

  it('omits array user agent headers', () => {
    expect(
      getAuditRequestMeta({
        ip: '203.0.113.10',
        headers: {
          'user-agent': ['Mozilla/5.0'],
        },
      }),
    ).toStrictEqual({
      ipAddress: '203.0.113.10',
    });
  });
});
