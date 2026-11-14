import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'O email não é válido.' })
  email: string;

  @Field()
  @IsNotEmpty({ message: 'A senha não pode estar vazia.' })
  password: string;
}
