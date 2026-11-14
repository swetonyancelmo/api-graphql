import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AuthPayload')
export class AuthPayloadDto {
  @Field({
    description: 'JWT para enviar no header `Authorization: Bearer <token>`.',
  })
  accessToken: string;
}
