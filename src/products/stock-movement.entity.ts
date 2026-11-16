import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from './product.entity';

/**
 * Livro-razão do estoque: cada linha é uma entrada ou saída. A soma dos
 * `delta` de um produto é sempre igual ao `quantity` atual dele.
 */
@Entity('stock_movements')
@Index(['productId', 'createdAt'])
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Ao remover o produto, o histórico dele vai junto.
  @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @Column({ type: 'uuid' })
  productId: string;

  /** Variação aplicada: positiva para entrada, negativa para saída. */
  @Column({ type: 'int' })
  delta: number;

  /** Saldo do produto logo após esta movimentação. */
  @Column({ type: 'int' })
  quantityAfter: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;

  // `clock_timestamp()` (e não `now()`, que é o início da transação) garante que
  // a ordem dos registros siga a ordem em que os ajustes foram realmente aplicados.
  @CreateDateColumn({ default: () => 'clock_timestamp()' })
  createdAt: Date;
}
