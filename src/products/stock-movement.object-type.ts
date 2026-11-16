import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('StockMovement')
export class StockMovementDto {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field(() => Int, {
    description:
      'Variação aplicada: positiva para entrada, negativa para saída.',
  })
  delta: number;

  @Field(() => Int, { description: 'Saldo do produto após esta movimentação.' })
  quantityAfter: number;

  @Field(() => String, { nullable: true })
  reason: string | null;

  @Field()
  createdAt: Date;
}
