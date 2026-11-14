import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { ProductEntity } from './product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
  ) {}

  findAll(): Promise<ProductEntity[]> {
    return this.productsRepository.find({ order: { createdAt: 'ASC' } });
  }

  findOne(id: string): Promise<ProductEntity | null> {
    return this.productsRepository.findOneBy({ id });
  }

  create(input: CreateProductInput): Promise<ProductEntity> {
    const product = this.productsRepository.create(input);
    return this.productsRepository.save(product);
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductEntity> {
    const product = await this.findOrFail(id);
    Object.assign(product, input);
    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<ProductEntity> {
    const product = await this.findOrFail(id);
    // O TypeORM zera o `id` da instância em `remove()`, então devolvemos uma cópia.
    const removed = { ...product };
    await this.productsRepository.remove(product);
    return removed;
  }

  private async findOrFail(id: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado.`);
    }
    return product;
  }
}
