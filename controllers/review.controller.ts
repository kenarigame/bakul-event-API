import { Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/response";
import { prisma } from "../lib/prisma";

interface EventParams {
  eventId: string;
}
export class ReviewController {
  async createReview(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params as { eventId: string };
      const userId = req.user!.userId;

      const completedTx = await prisma.transaction.findFirst({
        where: {
          userId,
          eventId,
          status: "COMPLETED",
        },
      });

      if (!completedTx) {
        sendError(res, "You can only review events you have attended", 403);
        return;
      }

      const existing = await prisma.review.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (existing) {
        sendError(res, "You have already reviewed this event", 400);
        return;
      }

      const review = await prisma.review.create({
        data: {
          userId,
          eventId,
          rating: req.body.rating,
          comment: req.body.comment,
          images: req.body.images ?? [],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      sendSuccess(res, review, "Review submitted successfully", 201);
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getEventReviews(
    req: Request<EventParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { eventId } = req.params;
      const page = parseInt((req.query.page as string) || "1");
      const limit = parseInt((req.query.limit as string) || "10");
      const skip = (page - 1) * limit;

      const [reviews, total, avgRating] = await Promise.all([
        prisma.review.findMany({
          where: { eventId },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        }),
        prisma.review.count({ where: { eventId } }),
        prisma.review.aggregate({ where: { eventId }, _avg: { rating: true } }),
      ]);

      sendSuccess(
        res,
        { reviews, averageRating: avgRating._avg.rating || 0 },
        "Reviews retrieved",
        200,
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      );
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async updateReview(req: Request, res: Response): Promise<void> {
    try {
      const review = await prisma.review.findFirst({
        where: { id: req.params.id as string, userId: req.user!.userId },
      });
      if (!review) {
        sendError(res, "Review not found", 404);
        return;
      }

      const updated = await prisma.review.update({
        where: { id: req.params.id as string },
        data: {
          rating: req.body.rating,
          comment: req.body.comment,
          images: req.body.images,
        },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      });

      sendSuccess(res, updated, "Review updated");
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async deleteReview(req: Request, res: Response): Promise<void> {
    try {
      const review = await prisma.review.findFirst({
        where: { id: req.params.id as string, userId: req.user!.userId },
      });
      if (!review) {
        sendError(res, "Review not found", 404);
        return;
      }

      await prisma.review.delete({ where: { id: req.params.id as string } });
      sendSuccess(res, null, "Review deleted");
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }
}
