import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListQueryDto } from '../common/dto/list-query.dto';

describe('ListQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: ListQueryDto,
    });

  it('defaults page and pageSize for empty query input', async () => {
    await expect(transformQuery({})).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it.each([
    { page: 0 },
    { page: 'abc' },
    { pageSize: 101 },
    { sort: 'createdAt:sideways' },
  ])('rejects invalid list query %p', async (query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
