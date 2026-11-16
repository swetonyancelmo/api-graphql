import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException('O ID informado não é um UUID válido.'),
});
