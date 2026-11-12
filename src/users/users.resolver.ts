import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserDto } from './user.object-type';
import { CreateUserInput } from './dto/create-user.input';
import { UsersService } from './users.service';

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

  @Mutation(() => UserDto, { name: 'createUser' })
  createUser(@Args('input') createUserInput: CreateUserInput) {
    return this.usersService.create(createUserInput);
  }
}
