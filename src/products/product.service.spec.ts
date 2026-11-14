import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
  };

  const product = (): ProductEntity =>
    ({
      id: 'p-1',
      name: 'Teclado',
      description: 'Mecânico',
      quantity: 10,
      unitPriceCents: 19990,
    }) as ProductEntity;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(ProductEntity), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(ProductService);
  });

  describe('findAll', () => {
    it('lista os produtos ordenados por data de criação', async () => {
      const products = [product()];
      repository.find.mockResolvedValue(products);

      await expect(service.findAll()).resolves.toBe(products);
      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('retorna o produto encontrado', async () => {
      const found = product();
      repository.findOneBy.mockResolvedValue(found);

      await expect(service.findOne('p-1')).resolves.toBe(found);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'p-1' });
    });

    it('retorna null quando não existe', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('x')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('cria e salva o produto com os dados do input', async () => {
      const input = {
        name: 'Mouse',
        description: 'Sem fio',
        quantity: 5,
        unitPriceCents: 8990,
      };
      const entity = { ...input };
      const saved = { id: 'p-2', ...input };
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(saved);

      await expect(service.create(input)).resolves.toBe(saved);
      expect(repository.create).toHaveBeenCalledWith(input);
      expect(repository.save).toHaveBeenCalledWith(entity);
    });
  });

  describe('update', () => {
    it('atualiza apenas os campos informados', async () => {
      repository.findOneBy.mockResolvedValue(product());
      repository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update('p-1', { quantity: 7 });

      expect(result).toMatchObject({
        name: 'Teclado',
        quantity: 7,
        unitPriceCents: 19990,
      });
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('lança NotFoundException quando o produto não existe', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.update('x', { quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
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

      const result = await service.remove('p-1');

      expect(repository.remove).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('p-1');
      expect(result.name).toBe('Teclado');
    });

    it('lança NotFoundException quando o produto não existe', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('x')).rejects.toThrow(NotFoundException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
