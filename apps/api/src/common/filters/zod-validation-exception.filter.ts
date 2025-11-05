import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { Response } from 'express';

@Catch(ZodError, BadRequestException)
export class ZodValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodValidationExceptionFilter.name);

  catch(exception: ZodError | BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Check if it's a ZodError or if BadRequestException contains ZodError
    let zodError: ZodError | null = null;
    
    if (exception instanceof ZodError) {
      zodError = exception;
    } else if (exception instanceof BadRequestException) {
      const responseData = exception.getResponse();
      // Check if the response contains ZodError information
      if (typeof responseData === 'object' && responseData !== null) {
        const data = responseData as any;
        if (data.issues && Array.isArray(data.issues)) {
          // It's already formatted by nestjs-zod
          this.logger.error(
            `Validation failed for ${request.method} ${request.url}`,
            {
              errors: data.issues,
              body: request.body,
            },
          );
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Validation failed',
            errors: data.issues.map((err: any) => ({
              path: err.path?.join('.') || '',
              message: err.message,
            })),
            issues: data.issues,
          });
        }
      }
      // Check if the exception message contains Zod error info
      this.logger.error(
        `BadRequestException for ${request.method} ${request.url}`,
        {
          exception: exception.getResponse(),
          body: request.body,
        },
      );
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message || 'Validation failed',
        errors: [],
      });
    }

    if (zodError) {
      const errors = zodError.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      this.logger.error(
        `Validation failed for ${request.method} ${request.url}`,
        {
          errors,
          body: request.body,
        },
      );

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: errors,
        issues: zodError.errors,
      });
    }

    // Fallback
    this.logger.error(
      `Unknown validation error for ${request.method} ${request.url}`,
      {
        exception,
        body: request.body,
      },
    );
    
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
    });
  }
}

