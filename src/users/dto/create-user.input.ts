import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  @IsNotEmpty({ message: 'O nome não pode estar vazio.' })
  name: string;

  @Field()
  @IsEmail({}, { message: 'O email não é válido.' })
  email: string;

  @Field()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password: string;
}
