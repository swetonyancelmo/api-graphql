import type { Request } from 'express';
import type { UserEntity } from '../users/user.entity';

export interface AuthenticatedRequest extends Request {
  user?: UserEntity;
}

export interface JwtPayload {
  sub: string;
  email: string;
}
