import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, Max, Min, NotEquals } from 'class-validator';
import { MAX_STOCK_DELTA } from '../product.constants';

@InputType()
export class AdjustStockInput {
  @Field(() => Int, {
    description:
      'Variação do estoque: positiva para entrada, negativa para saída.',
  })
  @IsInt({ message: 'A variação deve ser um número inteiro.' })
  @NotEquals(0, { message: 'A variação não pode ser zero.' })
  @Min(-MAX_STOCK_DELTA, {
    message: `A variação mínima é -${MAX_STOCK_DELTA}.`,
  })
  @Max(MAX_STOCK_DELTA, { message: `A variação máxima é ${MAX_STOCK_DELTA}.` })
  delta: number;
}
