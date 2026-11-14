import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

@InputType()
export class CreateProductInput {
  @Field()
  @IsNotEmpty({ message: 'O nome não pode estar vazio.' })
  name: string;

  @Field()
  @IsString({ message: 'A descrição deve ser um texto.' })
  description: string;

  @Field(() => Int)
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(0, { message: 'A quantidade não pode ser negativa.' })
  quantity: number;

  @Field(() => Int, { description: 'Preço unitário em centavos.' })
  @IsInt({ message: 'O preço deve ser um número inteiro de centavos.' })
  @Min(0, { message: 'O preço não pode ser negativo.' })
  unitPriceCents: number;
}
