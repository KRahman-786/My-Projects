export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, errorCode = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, message, errorCode, details);
  }
  static unauthorized(message = 'Please log in to continue', errorCode = 'UNAUTHORIZED') {
    return new AppError(401, message, errorCode);
  }
  static forbidden(message = 'You do not have permission to perform this action', errorCode = 'FORBIDDEN') {
    return new AppError(403, message, errorCode);
  }
  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new AppError(404, message, errorCode);
  }
  static conflict(message: string, errorCode = 'CONFLICT', details?: unknown) {
    return new AppError(409, message, errorCode, details);
  }
  static unprocessable(message: string, errorCode = 'UNPROCESSABLE', details?: unknown) {
    return new AppError(422, message, errorCode, details);
  }
  static serviceUnavailable(message: string, errorCode = 'SERVICE_UNAVAILABLE') {
    return new AppError(503, message, errorCode);
  }
}
