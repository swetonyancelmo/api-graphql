import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const jwtService = { verifyAsync: jest.fn() };
  const usersService = { findOne: jest.fn() };
  let guard: JwtAuthGuard;

  const contextWith = (authorization?: string) => {
    const req: { headers: Record<string, string>; user?: unknown } = {
      headers: authorization ? { authorization } : {},
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as unknown as GqlExecutionContext);
    return { context, req };
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
      usersService as unknown as UsersService,
    );
  });

  it('libera rotas marcadas com @Public() sem verificar token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = contextWith();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejeita requisição sem header Authorization', async () => {
    const { context } = contextWith();

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token de acesso ausente.',
    );
  });

  it('rejeita esquema diferente de Bearer', async () => {
    const { context } = contextWith('Basic abc123');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejeita token inválido ou expirado', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context } = contextWith('Bearer token-ruim');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token inválido ou expirado.',
    );
  });

  it('rejeita token de um usuário que não existe mais', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u-1', email: 'a@b.com' });
    usersService.findOne.mockResolvedValue(null);
    const { context } = contextWith('Bearer token-ok');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('autentica e anexa o usuário à requisição', async () => {
    const user = { id: 'u-1', email: 'a@b.com' };
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u-1', email: 'a@b.com' });
    usersService.findOne.mockResolvedValue(user);
    const { context, req } = contextWith('Bearer token-ok');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-ok');
    expect(usersService.findOne).toHaveBeenCalledWith('u-1');
    expect(req.user).toBe(user);
  });
});
