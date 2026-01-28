import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';


export const validate = (
    schema: z.ZodType,
    source: 'body' | 'query' | 'params' = 'body'
) => {
    return (req: Request, res: Response, next: NextFunction) => {

        const data = source === 'body' ? req.body
            : source === 'query' ? req.query
                : req.params;

        const result = schema.safeParse(data);

        if (!result.success) {
            const errors = result.error.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message
            }));
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors
            });
            return;
        }

        if (source === 'body') {
            req.body = result.data;
        } else if (source === 'query') {
            (req.query as any) = result.data;
        } else {
            (req.params as any) = result.data;
        }
        next();
    };
}