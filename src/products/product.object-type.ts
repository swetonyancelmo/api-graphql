import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Product')
export class ProductDto {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Int, { description: 'Preço unitário em centavos.' })
  unitPriceCents: number;
}
