import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const repository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    existsBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const input = {
    name: 'Ana',
    email: 'ana@exemplo.com',
    password: 'segredo123',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('findAll', () => {
    it('lista os usuários ordenados por data de criação', async () => {
      const users = [{ id: '1' }, { id: '2' }];
      repository.find.mockResolvedValue(users);

      await expect(service.findAll()).resolves.toBe(users);
      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('busca o usuário pelo id', async () => {
      const user = { id: '1', name: 'Ana' };
      repository.findOneBy.mockResolvedValue(user);

      await expect(service.findOne('1')).resolves.toBe(user);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: '1' });
    });

    it('retorna null quando o usuário não existe', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('inexistente')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    beforeEach(() => {
      repository.existsBy.mockResolvedValue(false);
      repository.create.mockImplementation((data: object) => data);
      repository.save.mockImplementation((user) =>
        Promise.resolve({ id: 'uuid-1', createdAt: new Date(), ...user }),
      );
    });

    it('grava a senha como hash bcrypt, nunca em texto puro', async () => {
      await service.create(input);

      const [saved] = repository.create.mock.calls[0];
      expect(saved.password).not.toBe(input.password);
      await expect(
        bcrypt.compare(input.password, saved.password),
      ).resolves.toBe(true);
    });

    it('não devolve a senha no retorno', async () => {
      const result = await service.create(input);

      expect(result).toMatchObject({
        id: 'uuid-1',
        name: 'Ana',
        email: input.email,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('rejeita email já cadastrado sem salvar nada', async () => {
      repository.existsBy.mockResolvedValue(true);

      await expect(service.create(input)).rejects.toThrow(ConflictException);
      expect(repository.existsBy).toHaveBeenCalledWith({ email: input.email });
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
