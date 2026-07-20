import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: Error & { statusCode?: number; errors?: unknown[] },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  sendError(res, message, statusCode, err.errors);
};

export const notFound = (_req: Request, res: Response): void => {
  sendError(res, 'Route not found', 404);
};
