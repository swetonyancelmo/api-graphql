import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import {
  formatGraphQLError,
  INTERNAL_ERROR_MESSAGE,
  VALIDATION_ERROR_MESSAGE,
} from './graphql-error.formatter';

describe('formatGraphQLError', () => {
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);

  beforeEach(() => loggerError.mockClear());
  afterAll(() => loggerError.mockRestore());

  /** Simula o que o Apollo entrega: um GraphQLError que embrulha o erro do resolver. */
  const fromResolver = (original: unknown) => {
    const error = new GraphQLError('mensagem do graphql', {
      path: ['createProduct'],
      originalError: original as Error,
    });
    const formatted: GraphQLFormattedError = {
      message: error.message,
      locations: [{ line: 1, column: 12 }],
      path: ['createProduct'],
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        stacktrace: ['at algum/arquivo.ts:10'],
        originalError: { statusCode: 500 },
      },
    };
    return formatGraphQLError(formatted, error);
  };

  it.each([
    [new BadRequestException('x'), 'BAD_REQUEST'],
    [new UnauthorizedException('x'), 'UNAUTHENTICATED'],
    [new ForbiddenException('x'), 'FORBIDDEN'],
    [new NotFoundException('x'), 'NOT_FOUND'],
    [new ConflictException('x'), 'CONFLICT'],
    [new HttpException('x', 429), 'TOO_MANY_REQUESTS'],
    [new HttpException('x', 418), 'BAD_REQUEST'],
  ])('mapeia %p para o código %s', (exception, code) => {
    expect(fromResolver(exception).extensions?.code).toBe(code);
  });

  it('mantém a mensagem de domínio, o local e o caminho', () => {
    const result = fromResolver(
      new NotFoundException('Produto não encontrado.'),
    );

    expect(result.message).toBe('Produto não encontrado.');
    expect(result.locations).toEqual([{ line: 1, column: 12 }]);
    expect(result.path).toEqual(['createProduct']);
  });

  it('não vaza stacktrace nem o erro original nas extensões', () => {
    const { extensions } = fromResolver(new ConflictException('duplicado'));

    expect(extensions).toEqual({ code: 'CONFLICT' });
  });

  it('lista os erros de validação em extensions.validationErrors', () => {
    const result = fromResolver(
      new BadRequestException({
        message: ['O nome não pode estar vazio.', 'O email não é válido.'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    );

    expect(result.message).toBe(VALIDATION_ERROR_MESSAGE);
    expect(result.extensions).toEqual({
      code: 'BAD_REQUEST',
      validationErrors: [
        'O nome não pode estar vazio.',
        'O email não é válido.',
      ],
    });
  });

  it('não cria validationErrors para um BadRequest com mensagem simples', () => {
    const result = fromResolver(
      new BadRequestException('Estoque insuficiente.'),
    );

    expect(result.message).toBe('Estoque insuficiente.');
    expect(result.extensions).toEqual({ code: 'BAD_REQUEST' });
  });

  it('deixa passar erros do próprio GraphQL (sintaxe, schema) com o código original', () => {
    const error = new GraphQLError(
      'Cannot query field "password" on type "User".',
      {
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      },
    );
    const result = formatGraphQLError(
      {
        message: error.message,
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED', stacktrace: ['x'] },
      },
      error,
    );

    expect(result.message).toBe(
      'Cannot query field "password" on type "User".',
    );
    expect(result.extensions).toEqual({ code: 'GRAPHQL_VALIDATION_FAILED' });
  });

  describe('erros inesperados', () => {
    it('escondem a mensagem interna e devolvem um erro genérico', () => {
      const result = fromResolver(
        new Error('connection refused to 10.0.0.5:5432 as user admin'),
      );

      expect(result.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(result.extensions).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
      expect(JSON.stringify(result)).not.toContain('10.0.0.5');
    });

    it('são registrados no log com o stack original', () => {
      const original = new Error('falha no banco');

      fromResolver(original);

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('createProduct'),
        original.stack,
      );
    });

    it('tratam exceções HTTP 5xx como internas, sem expor a mensagem', () => {
      const result = fromResolver(
        new InternalServerErrorException('detalhe sensível'),
      );

      expect(result.message).toBe(INTERNAL_ERROR_MESSAGE);
      expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('não registram no log erros esperados (4xx)', () => {
      fromResolver(new NotFoundException('x'));
      fromResolver(new BadRequestException('x'));

      expect(loggerError).not.toHaveBeenCalled();
    });
  });
});
