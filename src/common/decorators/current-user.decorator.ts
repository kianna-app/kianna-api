import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser, AuthenticatedRequest } from '../types/authenticated-request';

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthUser | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[keyof AuthUser] | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
