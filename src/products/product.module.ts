import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './product.entity';
import { StockMovementEntity } from './stock-movement.entity';
import { ProductService } from './product.service';
import { ProductResolver } from './product.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, StockMovementEntity])],
  providers: [ProductResolver, ProductService],
})
export class ProductModule {}
