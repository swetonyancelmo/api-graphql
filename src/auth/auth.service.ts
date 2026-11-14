import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './authenticated-request';
import { LoginInput } from './dto/login.input';

@Injectable()
export class AuthService {
  private readonly dummyHash = bcrypt.hashSync('senha-inexistente', 10);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login({
    email,
    password,
  }: LoginInput): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmailWithPassword(email);
    const passwordMatches = await bcrypt.compare(
      password,
      user?.password ?? this.dummyHash,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
