import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserEntity } from '../users/user.entity';
import { AdjustStockInput } from './dto/adjust-stock.input';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { StockMovementsArgs } from './dto/stock-movements.args';
import { ProductDto } from './product.object-type';
import { ProductService } from './product.service';
import { StockMovementDto } from './stock-movement.object-type';

@Resolver(() => ProductDto)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => [ProductDto], {
    name: 'products',
    description: 'Produtos do usuário autenticado.',
  })
  findAll(@CurrentUser() user: UserEntity) {
    return this.productService.findAll(user.id);
  }

  @Query(() => ProductDto, { name: 'product', nullable: true })
  findOne(
    @CurrentUser() user: UserEntity,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.productService.findOne(id, user.id);
  }

  @Query(() => [StockMovementDto], {
    name: 'stockMovements',
    description:
      'Histórico de entradas e saídas de um produto, da mais recente para a mais antiga.',
  })
  stockMovements(
    @CurrentUser() user: UserEntity,
    @Args() args: StockMovementsArgs,
  ) {
    return this.productService.findMovements(user.id, args);
  }

  @Mutation(() => ProductDto, { name: 'createProduct' })
  createProduct(
    @CurrentUser() user: UserEntity,
    @Args('input') createProductInput: CreateProductInput,
  ) {
    return this.productService.create(user.id, createProductInput);
  }

  @Mutation(() => ProductDto, { name: 'updateProduct' })
  updateProduct(
    @CurrentUser() user: UserEntity,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateProductInput: UpdateProductInput,
  ) {
    return this.productService.update(id, user.id, updateProductInput);
  }

  @Mutation(() => ProductDto, {
    name: 'adjustStock',
    description:
      'Soma uma variação ao estoque de forma atômica. Falha se o estoque ficaria negativo.',
  })
  adjustStock(
    @CurrentUser() user: UserEntity,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: AdjustStockInput,
  ) {
    return this.productService.adjustStock(id, user.id, input);
  }

  @Mutation(() => ProductDto, { name: 'deleteProduct' })
  deleteProduct(
    @CurrentUser() user: UserEntity,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.productService.remove(id, user.id);
  }
}
