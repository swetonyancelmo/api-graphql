import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserInput } from './dto/create-user.input';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  findAll(): Promise<UserEntity[]> {
    return this.usersRepository.find({ order: { createdAt: 'ASC' } });
  }

  findOne(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    const exists = await this.usersRepository.existsBy({ email: input.email });
    if (exists) {
      throw new ConflictException('Já existe um usuário com este email.');
    }

    const user = this.usersRepository.create({
      ...input,
      password: await bcrypt.hash(input.password, 10),
    });
    
    const saved = await this.usersRepository.save(user);

    const { password: _password, ...safe } = saved;
    return safe as UserEntity;
  }
}
