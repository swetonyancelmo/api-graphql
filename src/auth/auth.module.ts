import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const MIN_SECRET_LENGTH = 32;

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (secret.length < MIN_SECRET_LENGTH) {
          throw new Error(
            `JWT_SECRET deve ter pelo menos ${MIN_SECRET_LENGTH} caracteres.`,
          );
        }
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: config.get<string>(
              'JWT_EXPIRES_IN',
              '1h',
            ) as JwtSignOptions['expiresIn'],
          },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
