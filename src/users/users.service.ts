import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/db-errors';
import { CreateUserInput } from './dto/create-user.input';
import { UserEntity } from './user.entity';

const EMAIL_IN_USE = 'Já existe um usuário com este email.';

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

  findByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    const exists = await this.usersRepository.existsBy({ email: input.email });
    if (exists) {
      throw new ConflictException(EMAIL_IN_USE);
    }

    const user = this.usersRepository.create({
      ...input,
      password: await bcrypt.hash(input.password, 10),
    });

    let saved: UserEntity;
    try {
      saved = await this.usersRepository.save(user);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(EMAIL_IN_USE);
      throw error;
    }

    const { password: _password, ...safe } = saved;
    return safe as UserEntity;
  }
}
