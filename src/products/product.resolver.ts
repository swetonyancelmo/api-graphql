import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ProductDto } from './product.object-type';
import { ProductService } from './product.service';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';

@Resolver(() => ProductDto)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => [ProductDto], { name: 'products' })
  findAll() {
    return this.productService.findAll();
  }

  @Query(() => ProductDto, { name: 'product', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.productService.findOne(id);
  }

  @Mutation(() => ProductDto, { name: 'createProduct' })
  createProduct(@Args('input') createProductInput: CreateProductInput) {
    return this.productService.create(createProductInput);
  }

  @Mutation(() => ProductDto, { name: 'updateProduct' })
  updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateProductInput: UpdateProductInput,
  ) {
    return this.productService.update(id, updateProductInput);
  }

  @Mutation(() => ProductDto, { name: 'deleteProduct' })
  deleteProduct(@Args('id', { type: () => ID }) id: string) {
    return this.productService.remove(id);
  }
}
