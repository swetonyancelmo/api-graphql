import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MAX_QUANTITY } from './product.constants';
import { ProductEntity } from './product.entity';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  // Query builder encadeável: cada método devolve o próprio builder.
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
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
    for (const fn of Object.values(queryBuilder)) {
      if (fn !== queryBuilder.execute) fn.mockReturnThis();
    }
    repository.createQueryBuilder.mockReturnValue(queryBuilder);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(ProductEntity), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(ProductService);
  });

  describe('findAll', () => {
    it('lista apenas os produtos do dono, ordenados por criação', async () => {
      const products = [product()];
      repository.find.mockResolvedValue(products);

      await expect(service.findAll(OWNER)).resolves.toBe(products);
      expect(repository.find).toHaveBeenCalledWith({
        where: { ownerId: OWNER },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('busca o produto filtrando por id e dono', async () => {
      const found = product();
      repository.findOneBy.mockResolvedValue(found);

      await expect(service.findOne('p-1', OWNER)).resolves.toBe(found);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 'p-1',
        ownerId: OWNER,
      });
    });

    it('retorna null quando não existe ou pertence a outro usuário', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('x', OWNER)).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('cria o produto associado ao dono informado', async () => {
      const input = {
        name: 'Mouse',
        description: 'Sem fio',
        quantity: 5,
        unitPriceCents: 8990,
      };
      const entity = { ...input, ownerId: OWNER };
      const saved = { id: 'p-2', ...entity };
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(saved);

      await expect(service.create(OWNER, input)).resolves.toBe(saved);
      expect(repository.create).toHaveBeenCalledWith({
        ...input,
        ownerId: OWNER,
      });
      expect(repository.save).toHaveBeenCalledWith(entity);
    });
  });

  describe('update', () => {
    it('atualiza apenas os campos informados', async () => {
      repository.findOneBy.mockResolvedValue(product());
      repository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update('p-1', OWNER, { quantity: 7 });

      expect(result).toMatchObject({
        name: 'Teclado',
        quantity: 7,
        unitPriceCents: 19990,
      });
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 'p-1',
        ownerId: OWNER,
      });
    });

    it('lança NotFoundException quando o produto não existe para esse dono', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.update('x', OWNER, { quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('adjustStock', () => {
    it('aplica o ajuste em um único UPDATE restrito ao dono e à faixa válida', async () => {
      queryBuilder.execute.mockResolvedValue({
        raw: [{ ...product(), quantity: 7 }],
      });
      repository.create.mockImplementation((row: object) => row);

      const result = await service.adjustStock('p-1', OWNER, { delta: -3 });

      expect(result.quantity).toBe(7);
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
      // Atômico: nenhuma leitura nem save separados no caminho feliz.
      expect(repository.findOneBy).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o produto não existe para esse dono', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.adjustStock('x', OWNER, { delta: -1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita saída maior que o estoque, informando o saldo atual', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });
      repository.findOneBy.mockResolvedValue({ ...product(), quantity: 2 });

      const promise = service.adjustStock('p-1', OWNER, { delta: -5 });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(/há 2 unidade\(s\).*saída é de 5/);
    });

    it('rejeita entrada que ultrapassaria o estoque máximo', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });
      repository.findOneBy.mockResolvedValue({
        ...product(),
        quantity: MAX_QUANTITY,
      });

      await expect(
        service.adjustStock('p-1', OWNER, { delta: 1 }),
      ).rejects.toThrow(/não pode ultrapassar/);
    });
  });

  describe('remove', () => {
    it('remove o produto e devolve uma cópia com o id preservado', async () => {
      repository.findOneBy.mockResolvedValue(product());
      // O TypeORM zera o id da instância ao remover.
      repository.remove.mockImplementation((p) => {
        p.id = undefined;
        return Promise.resolve(p);
      });

      const result = await service.remove('p-1', OWNER);

      expect(repository.remove).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('p-1');
      expect(result.name).toBe('Teclado');
    });

    it('lança NotFoundException e não remove nada quando não é do dono', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('x', OWNER)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findOneBy).toHaveBeenCalledWith({
        id: 'x',
        ownerId: OWNER,
      });
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
