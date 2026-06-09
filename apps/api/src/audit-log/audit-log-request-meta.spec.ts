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

    expect(buildAuditActor(user)).toEqual({
      userId: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
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

    expect(getAuditRequestMeta(request)).toEqual({
      ipAddress: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    });
  });
});
