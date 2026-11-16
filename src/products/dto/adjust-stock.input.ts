import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
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

  @Field(() => String, {
    nullable: true,
    description: 'Motivo da movimentação (ex.: "Venda", "Compra", "Perda").',
  })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  @MaxLength(200, { message: 'O motivo pode ter no máximo 200 caracteres.' })
  reason?: string;
}
