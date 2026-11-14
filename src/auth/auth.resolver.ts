import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthPayloadDto } from './auth-payload.object-type';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginInput } from './dto/login.input';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => AuthPayloadDto, { name: 'login' })
  login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }
}
