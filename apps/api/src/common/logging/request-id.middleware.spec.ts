import type { NextFunction, Request, Response } from 'express';

import {
  getRequestIdFromRequest,
  getRequestLogContext,
} from './request-context';
import { isValidRequestId, RequestIdMiddleware } from './request-id.middleware';

type MockResponse = Pick<Response, 'setHeader'>;

function createRequest(headers: Request['headers'] = {}): Request {
  return {
    headers,
    method: 'GET',
    originalUrl: '/api/users?page=1',
    url: '/users?page=1',
    ip: '203.0.113.10',
  } as Request;
}

function createResponse(): MockResponse {
  return {
    setHeader: jest.fn(),
  };
}

function runMiddleware(request: Request) {
  const middleware = new RequestIdMiddleware();
  const response = createResponse();
  const next: NextFunction = jest.fn();

  middleware.use(request, response as Response, next);

  return { response, next };
}

describe('RequestIdMiddleware', () => {
  it('accepts a valid x-request-id header', () => {
    const request = createRequest({ 'x-request-id': 'req.valid-123:abc' });

    const { response, next } = runMiddleware(request);

    expect(getRequestIdFromRequest(request)).toBe('req.valid-123:abc');
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'req.valid-123:abc',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces a missing x-request-id header', () => {
    const request = createRequest();

    const { response } = runMiddleware(request);

    const selectedId = getRequestIdFromRequest(request);
    expect(selectedId).toMatch(
      /^req_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', selectedId);
  });

  it('replaces invalid x-request-id headers with spaces or too-long values', () => {
    for (const incoming of ['has spaces', 'x'.repeat(129)]) {
      const request = createRequest({ 'x-request-id': incoming });

      const { response } = runMiddleware(request);
      const selectedId = getRequestIdFromRequest(request);

      expect(selectedId).not.toBe(incoming);
      expect(selectedId).toMatch(/^req_/);
      expect(response.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        selectedId,
      );
    }
  });

  it('replaces array-valued x-request-id headers', () => {
    const request = createRequest({ 'x-request-id': ['req_valid_1'] });

    const { response } = runMiddleware(request);
    const selectedId = getRequestIdFromRequest(request);

    expect(selectedId).not.toBe('req_valid_1');
    expect(selectedId).toMatch(/^req_/);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', selectedId);
  });

  it('validates only single string request ids', () => {
    expect(isValidRequestId('abc.DEF-12:34_ok')).toBe(true);
    expect(isValidRequestId('with spaces')).toBe(false);
    expect(isValidRequestId('x'.repeat(129))).toBe(false);
    expect(isValidRequestId(['req_valid_1'])).toBe(false);
  });

  it('exposes the selected request log context', () => {
    const request = createRequest({
      'x-request-id': 'req_context_123',
      'user-agent': 'Mozilla/5.0',
    });
    request.user = { sub: 'user_123' };

    runMiddleware(request);

    expect(getRequestLogContext(request)).toStrictEqual({
      requestId: 'req_context_123',
      method: 'GET',
      path: '/api/users?page=1',
      userId: 'user_123',
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    });
  });
});
