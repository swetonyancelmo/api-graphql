import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { INITIAL_STOCK_REASON, MAX_QUANTITY } from './product.constants';
import { ProductEntity } from './product.entity';
import { ProductService } from './product.service';
import { StockMovementEntity } from './stock-movement.entity';

describe('ProductService', () => {
  let service: ProductService;

  const productsRepository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const movementsRepository = { find: jest.fn() };

  // Query builder encadeável: cada método devolve o próprio builder.
  const queryBuilder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    setParameters: jest.fn(),
    returning: jest.fn(),
    execute: jest.fn(),
  };

  // EntityManager da transação.
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    insert: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  const OWNER = 'owner-1';

  const product = (): ProductEntity =>
    ({
      id: 'p-1',
      ownerId: OWNER,
      name: 'Teclado',
      description: 'Mecânico',
      quantity: 10,
      unitPriceCents: 19990,
    }) as ProductEntity;

  beforeEach(async () => {
    jest.resetAllMocks();
    for (const [name, fn] of Object.entries(queryBuilder)) {
      if (name !== 'execute') fn.mockReturnThis();
    }
    manager.createQueryBuilder.mockReturnValue(queryBuilder);
    dataSource.transaction.mockImplementation((work: (m: unknown) => unknown) =>
      work(manager),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: productsRepository,
        },
        {
          provide: getRepositoryToken(StockMovementEntity),
          useValue: movementsRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(ProductService);
  });

  describe('findAll', () => {
    it('lista apenas os produtos do dono, ordenados por criação', async () => {
      const products = [product()];
      productsRepository.find.mockResolvedValue(products);

      await expect(service.findAll(OWNER)).resolves.toBe(products);
      expect(productsRepository.find).toHaveBeenCalledWith({
        where: { ownerId: OWNER },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('busca o produto filtrando por id e dono', async () => {
      const found = product();
      productsRepository.findOneBy.mockResolvedValue(found);

      await expect(service.findOne('p-1', OWNER)).resolves.toBe(found);
      expect(productsRepository.findOneBy).toHaveBeenCalledWith({
        id: 'p-1',
        ownerId: OWNER,
      });
    });

    it('retorna null quando não existe ou pertence a outro usuário', async () => {
      productsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('x', OWNER)).resolves.toBeNull();
    });
  });

  describe('create', () => {
    const input = {
      name: 'Mouse',
      description: 'Sem fio',
      quantity: 5,
      unitPriceCents: 8990,
    };

    it('cria o produto do dono e registra o estoque inicial na mesma transação', async () => {
      const entity = { ...input, ownerId: OWNER };
      manager.create.mockReturnValue(entity);
      manager.save.mockResolvedValue({ id: 'p-2', ...entity });

      const result = await service.create(OWNER, input);

      expect(result.id).toBe('p-2');
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.create).toHaveBeenCalledWith(ProductEntity, {
        ...input,
        ownerId: OWNER,
      });
      expect(manager.insert).toHaveBeenCalledWith(StockMovementEntity, {
        productId: 'p-2',
        delta: 5,
        quantityAfter: 5,
        reason: INITIAL_STOCK_REASON,
      });
    });

    it('não registra movimentação quando o estoque inicial é zero', async () => {
      manager.create.mockReturnValue({ ...input, quantity: 0 });
      manager.save.mockResolvedValue({ id: 'p-3', ...input, quantity: 0 });

      await service.create(OWNER, { ...input, quantity: 0 });

      expect(manager.insert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('atualiza apenas os campos informados', async () => {
      productsRepository.findOneBy.mockResolvedValue(product());
      productsRepository.save.mockImplementation((p: object) =>
        Promise.resolve(p),
      );

      const result = await service.update('p-1', OWNER, {
        unitPriceCents: 25000,
      });

      expect(result).toMatchObject({
        name: 'Teclado',
        quantity: 10,
        unitPriceCents: 25000,
      });
      expect(productsRepository.findOneBy).toHaveBeenCalledWith({
        id: 'p-1',
        ownerId: OWNER,
      });
    });

    it('lança NotFoundException quando o produto não existe para esse dono', async () => {
      productsRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('x', OWNER, { name: 'Novo' }),
      ).rejects.toThrow(NotFoundException);
      expect(productsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('adjustStock', () => {
    it('atualiza o saldo e grava a movimentação na mesma transação', async () => {
      queryBuilder.execute.mockResolvedValue({
        raw: [{ ...product(), quantity: 7 }],
      });
      manager.create.mockImplementation((_e: unknown, row: object) => row);

      const result = await service.adjustStock('p-1', OWNER, {
        delta: -3,
        reason: 'Venda',
      });

      expect(result.quantity).toBe(7);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        '"id" = :id AND "ownerId" = :ownerId',
        { id: 'p-1', ownerId: OWNER },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '"quantity" + :delta BETWEEN 0 AND :max',
      );
      expect(queryBuilder.setParameters).toHaveBeenCalledWith({
        delta: -3,
        max: MAX_QUANTITY,
      });
      expect(manager.insert).toHaveBeenCalledWith(StockMovementEntity, {
        productId: 'p-1',
        delta: -3,
        quantityAfter: 7,
        reason: 'Venda',
      });
      // Caminho feliz: nenhuma leitura fora da transação.
      expect(productsRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('grava reason como null quando não informado', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [product()] });
      manager.create.mockImplementation((_e: unknown, row: object) => row);

      await service.adjustStock('p-1', OWNER, { delta: 1 });

      expect(manager.insert).toHaveBeenCalledWith(
        StockMovementEntity,
        expect.objectContaining({ reason: null }),
      );
    });

    it('lança NotFoundException e não grava histórico quando o produto não existe', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });
      productsRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.adjustStock('x', OWNER, { delta: -1 }),
      ).rejects.toThrow(NotFoundException);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('rejeita saída maior que o estoque, sem gravar histórico', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });
      productsRepository.findOneBy.mockResolvedValue({
        ...product(),
        quantity: 2,
      });

      const promise = service.adjustStock('p-1', OWNER, { delta: -5 });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(/há 2 unidade\(s\).*saída é de 5/);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('rejeita entrada que ultrapassaria o estoque máximo', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });
      productsRepository.findOneBy.mockResolvedValue({
        ...product(),
        quantity: MAX_QUANTITY,
      });

      await expect(
        service.adjustStock('p-1', OWNER, { delta: 1 }),
      ).rejects.toThrow(/não pode ultrapassar/);
    });
  });

  describe('findMovements', () => {
    const args = { productId: 'p-1', limit: 20, offset: 0 };

    it('lista as movimentações do produto, da mais recente para a mais antiga', async () => {
      const movements = [{ id: 'm-2' }, { id: 'm-1' }];
      productsRepository.findOneBy.mockResolvedValue(product());
      movementsRepository.find.mockResolvedValue(movements);

      await expect(service.findMovements(OWNER, args)).resolves.toBe(movements);
      expect(movementsRepository.find).toHaveBeenCalledWith({
        where: { productId: 'p-1' },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('confere que o produto é do dono antes de listar', async () => {
      productsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findMovements(OWNER, args)).rejects.toThrow(
        NotFoundException,
      );
      expect(productsRepository.findOneBy).toHaveBeenCalledWith({
        id: 'p-1',
        ownerId: OWNER,
      });
      expect(movementsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('remove o produto e devolve uma cópia com o id preservado', async () => {
      productsRepository.findOneBy.mockResolvedValue(product());
      // O TypeORM zera o id da instância ao remover.
      productsRepository.remove.mockImplementation((p: { id?: string }) => {
        p.id = undefined;
        return Promise.resolve(p);
      });

      const result = await service.remove('p-1', OWNER);

      expect(productsRepository.remove).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('p-1');
      expect(result.name).toBe('Teclado');
    });

    it('lança NotFoundException e não remove nada quando não é do dono', async () => {
      productsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('x', OWNER)).rejects.toThrow(
        NotFoundException,
      );
      expect(productsRepository.remove).not.toHaveBeenCalled();
    });
  });
});
