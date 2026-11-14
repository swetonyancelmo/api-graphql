import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserDto } from './user.object-type';
import { CreateUserInput } from './dto/create-user.input';
import { UsersService } from './users.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserEntity } from './user.entity';

@Resolver(() => UserDto)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserDto], { name: 'users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Query(() => UserDto, { name: 'user', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.usersService.findOne(id);
  }

  @Query(() => UserDto, { name: 'me', description: 'Usuário autenticado.' })
  me(@CurrentUser() user: UserEntity) {
    return user;
  }

  @Public()
  @Mutation(() => UserDto, { name: 'createUser' })
  createUser(@Args('input') createUserInput: CreateUserInput) {
    return this.usersService.create(createUserInput);
  }
}
