import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdjustStockInput } from './dto/adjust-stock.input';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { MAX_QUANTITY } from './product.constants';
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

  async adjustStock(
    id: string,
    ownerId: string,
    { delta }: AdjustStockInput,
  ): Promise<ProductEntity> {
    const result = await this.productsRepository
      .createQueryBuilder()
      .update(ProductEntity)
      .set({ quantity: () => '"quantity" + :delta' })
      .where('"id" = :id AND "ownerId" = :ownerId', { id, ownerId })
      .andWhere('"quantity" + :delta BETWEEN 0 AND :max')
      .setParameters({ delta, max: MAX_QUANTITY })
      .returning('*')
      .execute();

    const [row] = result.raw as ProductEntity[];
    if (row) {
      return this.productsRepository.create(row);
    }

    const product = await this.findOrFail(id, ownerId);
    throw new BadRequestException(
      delta < 0
        ? `Estoque insuficiente: há ${product.quantity} unidade(s) e a saída é de ${-delta}.`
        : `O estoque não pode ultrapassar ${MAX_QUANTITY} unidades.`,
    );
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
