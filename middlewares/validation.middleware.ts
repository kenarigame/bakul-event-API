import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";
import { z } from "zod";

export const validate = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      sendError(res, "Validation Error", 400, errors);
      return;
    }

    req.body = result.data;
    next();
  };
};

// export const validateQuery = (schema: z.ZodType) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     const result = schema.safeParse(req.query);

//     if (!result.success) {
//       const errors = result.error.issues.map((e) => ({
//         field: e.path.join("."),
//         message: e.message,
//       }));

//       sendError(res, "Query Validation Error", 400, errors);
//       return;
//     }

//     req.query = result.data as typeof req.query;
//     next();
//   };
// };

export const validateQuery = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log("===== QUERY =====");
    console.log(req.query);

    const result = schema.safeParse(req.query);

    if (!result.success) {
      console.log("===== QUERY VALIDATION FAILED =====");
      console.log(result.error.issues);

      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      sendError(res, "Query Validation Error", 400, errors);
      return;
    }

    console.log("===== QUERY VALIDATION SUCCESS =====");
    console.log(result.data);

    req.query = result.data as typeof req.query;
    next();
  };
};