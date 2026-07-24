import { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/response";
import { prisma } from "../lib/prisma";

export class AdminController {
  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await prisma.category.create({
        data: {
          name: req.body.name,
          slug: req.body.slug,
          icon: req.body.icon,
          color: req.body.color,
          description: req.body.description,
        },
      });

      sendSuccess(res, category, "Category created", 201);
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }
}
