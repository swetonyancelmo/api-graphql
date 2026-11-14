import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  description: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  // Preço em centavos: evita erros de arredondamento de ponto flutuante.
  @Column({ type: 'int' })
  unitPriceCents: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
