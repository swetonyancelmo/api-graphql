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

  findAll(ownerId: string): Promise<ProductEntity[]> {
    return this.productsRepository.find({
      where: { ownerId },
      order: { createdAt: 'ASC' },
    });
  }

  findOne(id: string, ownerId: string): Promise<ProductEntity | null> {
    return this.productsRepository.findOneBy({ id, ownerId });
  }

  create(ownerId: string, input: CreateProductInput): Promise<ProductEntity> {
    const product = this.productsRepository.create({ ...input, ownerId });
    return this.productsRepository.save(product);
  }

  async update(
    id: string,
    ownerId: string,
    input: UpdateProductInput,
  ): Promise<ProductEntity> {
    const product = await this.findOrFail(id, ownerId);
    Object.assign(product, input);
    return this.productsRepository.save(product);
  }

  async remove(id: string, ownerId: string): Promise<ProductEntity> {
    const product = await this.findOrFail(id, ownerId);
    const removed = { ...product };
    await this.productsRepository.remove(product);
    return removed;
  }

  private async findOrFail(
    id: string,
    ownerId: string,
  ): Promise<ProductEntity> {
    const product = await this.findOne(id, ownerId);
    if (!product) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado.`);
    }
    return product;
  }
}
