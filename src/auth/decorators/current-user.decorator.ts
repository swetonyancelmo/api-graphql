import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { UserEntity } from '../../users/user.entity';
import type { AuthenticatedRequest } from '../authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserEntity => {
    const { req } = GqlExecutionContext.create(context).getContext<{
      req: AuthenticatedRequest;
    }>();
    return req.user as UserEntity;
  },
);
