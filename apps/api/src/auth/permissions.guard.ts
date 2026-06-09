import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../permission/permission.service';
import type { JwtUserPayload } from '../user/user.types';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload }>();

    if (!request.user?.sub) {
      return false;
    }

    const permissionContext =
      await this.permissionService.resolveUserPermissionContext(
        request.user.sub,
      );

    if (permissionContext.isSuperAdmin) {
      return true;
    }

    return required.every((permission) =>
      permissionContext.permissionCodes.includes(permission),
    );
  }
}
