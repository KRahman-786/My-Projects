import type { NextFunction, Request, Response } from 'express';
import type { ZodType, z } from 'zod';

/** Validates and replaces req.body with the parsed (typed, stripped) value. */
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}

/** Parses the query string with a schema (Express 5 query objects are read-only). */
export function parseQuery<S extends ZodType>(schema: S, req: Request): z.infer<S> {
  return schema.parse(req.query) as z.infer<S>;
}

export function parseParams<S extends ZodType>(schema: S, req: Request): z.infer<S> {
  return schema.parse(req.params) as z.infer<S>;
}
