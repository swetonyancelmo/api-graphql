import { unwrapResolverError } from '@apollo/server/errors';
import { HttpException, Logger } from '@nestjs/common';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

export const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor.';
export const VALIDATION_ERROR_MESSAGE = 'Dados de entrada inválidos.';

const HTTP_STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

const logger = new Logger('GraphQL');

function extractValidationErrors(error: HttpException): string[] | undefined {
  const response = error.getResponse();
  if (typeof response === 'object' && 'message' in response) {
    const { message } = response;
    if (Array.isArray(message)) return message.map(String);
  }
  return undefined;
}

export function formatGraphQLError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const original = unwrapResolverError(error);
  const { locations, path } = formatted;

  if (original instanceof HttpException && original.getStatus() < 500) {
    const validationErrors = extractValidationErrors(original);
    return {
      message: validationErrors ? VALIDATION_ERROR_MESSAGE : original.message,
      locations,
      path,
      extensions: {
        code: HTTP_STATUS_TO_CODE[original.getStatus()] ?? 'BAD_REQUEST',
        ...(validationErrors && { validationErrors }),
      },
    };
  }

  if (original instanceof GraphQLError) {
    return {
      message: formatted.message,
      locations,
      path,
      extensions: { code: formatted.extensions?.code ?? 'BAD_REQUEST' },
    };
  }

  logger.error(
    `Erro inesperado em ${path?.join('.') ?? 'operação desconhecida'}`,
    original instanceof Error ? original.stack : String(original),
  );
  return {
    message: INTERNAL_ERROR_MESSAGE,
    locations,
    path,
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}
