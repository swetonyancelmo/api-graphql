import { ArgsType, Field, ID, Int } from '@nestjs/graphql';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '../product.constants';

@ArgsType()
export class StockMovementsArgs {
  @Field(() => ID)
  @IsUUID('all', { message: 'O ID do produto não é válido.' })
  productId: string;

  @Field(() => Int, { defaultValue: 20, description: 'Máximo de registros.' })
  @IsInt()
  @Min(1, { message: 'O limite mínimo é 1.' })
  @Max(MAX_PAGE_SIZE, { message: `O limite máximo é ${MAX_PAGE_SIZE}.` })
  limit: number;

  @Field(() => Int, { defaultValue: 0, description: 'Registros a pular.' })
  @IsInt()
  @Min(0, { message: 'O deslocamento não pode ser negativo.' })
  offset: number;
}
