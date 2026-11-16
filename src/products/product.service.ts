import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdjustStockInput } from './dto/adjust-stock.input';
import { CreateProductInput } from './dto/create-product.input';
import { StockMovementsArgs } from './dto/stock-movements.args';
import { UpdateProductInput } from './dto/update-product.input';
import { INITIAL_STOCK_REASON, MAX_QUANTITY } from './product.constants';
import { ProductEntity } from './product.entity';
import { StockMovementEntity } from './stock-movement.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
    @InjectRepository(StockMovementEntity)
    private readonly movementsRepository: Repository<StockMovementEntity>,
    private readonly dataSource: DataSource,
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

  /** Cria o produto e, se houver saldo inicial, registra a movimentação correspondente. */
  create(ownerId: string, input: CreateProductInput): Promise<ProductEntity> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        manager.create(ProductEntity, { ...input, ownerId }),
      );

      if (product.quantity > 0) {
        await manager.insert(StockMovementEntity, {
          productId: product.id,
          delta: product.quantity,
          quantityAfter: product.quantity,
          reason: INITIAL_STOCK_REASON,
        });
      }
      return product;
    });
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

  /**
   * Soma `delta` ao estoque em um único UPDATE atômico. A regra
   * (0 <= estoque <= MAX_QUANTITY) está no WHERE, então o banco decide e duas
   * requisições simultâneas nunca deixam o estoque negativo, o que não seria
   * garantido com "ler, somar e salvar".
   *
   * O UPDATE e o registro no histórico rodam na mesma transação: ou os dois
   * acontecem, ou nenhum. O UPDATE trava a linha do produto até o commit, o
   * que também serializa as movimentações do mesmo produto.
   */
  async adjustStock(
    id: string,
    ownerId: string,
    { delta, reason }: AdjustStockInput,
  ): Promise<ProductEntity> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ quantity: () => '"quantity" + :delta' })
        .where('"id" = :id AND "ownerId" = :ownerId', { id, ownerId })
        .andWhere('"quantity" + :delta BETWEEN 0 AND :max')
        .setParameters({ delta, max: MAX_QUANTITY })
        .returning('*')
        .execute();

      const [row] = result.raw as ProductEntity[];
      if (!row) return null;

      await manager.insert(StockMovementEntity, {
        productId: row.id,
        delta,
        quantityAfter: row.quantity,
        reason: reason ?? null,
      });
      return manager.create(ProductEntity, row);
    });

    if (updated) return updated;

    // Nenhuma linha atualizada: ou o produto não existe, ou a regra bloqueou.
    const product = await this.findOrFail(id, ownerId);
    throw new BadRequestException(
      delta < 0
        ? `Estoque insuficiente: há ${product.quantity} unidade(s) e a saída é de ${-delta}.`
        : `O estoque não pode ultrapassar ${MAX_QUANTITY} unidades.`,
    );
  }

  /** Histórico do produto, da movimentação mais recente para a mais antiga. */
  async findMovements(
    ownerId: string,
    { productId, limit, offset }: StockMovementsArgs,
  ): Promise<StockMovementEntity[]> {
    await this.findOrFail(productId, ownerId);
    return this.movementsRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
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
