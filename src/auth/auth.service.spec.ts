import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = { findByEmailWithPassword: jest.fn() };
  const jwtService = { signAsync: jest.fn() };

  const credentials = { email: 'ana@exemplo.com', password: 'segredo123' };

  beforeEach(async () => {
    jest.resetAllMocks();
    jwtService.signAsync.mockResolvedValue('token-assinado');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('retorna um token assinado com id e email quando as credenciais são válidas', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u-1',
      email: credentials.email,
      password: await bcrypt.hash(credentials.password, 4),
    });

    await expect(service.login(credentials)).resolves.toEqual({
      accessToken: 'token-assinado',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'u-1',
      email: credentials.email,
    });
  });

  it('rejeita senha incorreta sem assinar token', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u-1',
      email: credentials.email,
      password: await bcrypt.hash('outra-senha', 4),
    });

    await expect(service.login(credentials)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejeita email inexistente com a mesma mensagem da senha incorreta', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login(credentials)).rejects.toThrow(
      'Credenciais inválidas.',
    );

    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u-1',
      email: credentials.email,
      password: await bcrypt.hash('outra-senha', 4),
    });
    await expect(service.login(credentials)).rejects.toThrow(
      'Credenciais inválidas.',
    );

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
