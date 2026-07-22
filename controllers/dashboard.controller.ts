import { Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/response";
import { prisma } from "../lib/prisma";

export class DashboardController {
  async getCustomerDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const [
        totalTransactions,
        upcomingEvents,
        recentTransactions,
        totalPoints,
        userCoupons,
      ] = await Promise.all([
        prisma.transaction.count({ where: { userId } }),
        prisma.transaction.count({
          where: {
            userId,
            status: "CONFIRMED",
            event: { startDate: { gte: new Date() } },
          },
        }),
        prisma.transaction.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            event: {
              select: {
                id: true,
                name: true,
                thumbnail: true,
                startDate: true,
              },
            },
          },
        }),
        prisma.point.aggregate({
          where: { userId, isExpired: false, expiresAt: { gte: new Date() } },
          _sum: { amount: true },
        }),
        prisma.coupon.findMany({
          where: { userId, isUsed: false, expiresAt: { gte: new Date() } },
        }),
      ]);

      sendSuccess(
        res,
        {
          totalTransactions,
          upcomingEvents,
          recentTransactions,
          totalPoints: totalPoints._sum.amount || 0,
          availableCoupons: userCoupons.length,
          coupons: userCoupons,
        },
        "Dashboard data retrieved",
      );
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getOrganizerDashboard(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await prisma.organizer.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!organizer) {
        sendError(res, "Organizer not found", 404);
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalEvents,
        activeEvents,
        totalTransactions,
        pendingConfirmations,
        revenueData,
        recentTransactions,
      ] = await Promise.all([
        prisma.event.count({ where: { organizerId: organizer.id } }),
        prisma.event.count({
          where: {
            organizerId: organizer.id,
            status: "PUBLISHED",
            startDate: { gte: new Date() },
          },
        }),
        prisma.transaction.count({
          where: {
            event: { organizerId: organizer.id },
            status: { in: ["CONFIRMED", "COMPLETED"] },
          },
        }),
        prisma.transaction.count({
          where: {
            event: { organizerId: organizer.id },
            status: "WAITING_CONFIRMATION",
          },
        }),
        prisma.transaction.aggregate({
          where: {
            event: { organizerId: organizer.id },
            status: { in: ["CONFIRMED", "COMPLETED"] },
          },
          _sum: { total: true },
        }),
        prisma.transaction.findMany({
          where: { event: { organizerId: organizer.id } },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            event: { select: { id: true, name: true } },
          },
        }),
      ]);

      sendSuccess(
        res,
        {
          totalEvents,
          activeEvents,
          totalTransactions,
          pendingConfirmations,
          totalRevenue: revenueData._sum.total || 0,
          recentTransactions,
        },
        "Organizer dashboard retrieved",
      );
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getAdminDashboard(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalUsers,
        totalEvents,
        totalTransactions,
        totalRevenue,
        recentUsers,
        recentEvents,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.event.count(),
        prisma.transaction.count({
          where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        }),
        prisma.transaction.aggregate({
          where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
          _sum: { total: true },
        }),
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.event.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            organizer: { select: { name: true } },
            category: { select: { name: true } },
          },
        }),
      ]);

      sendSuccess(
        res,
        {
          totalUsers,
          totalEvents,
          totalTransactions,
          totalRevenue: totalRevenue._sum.total || 0,
          recentUsers,
          recentEvents,
        },
        "Admin dashboard retrieved",
      );
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getUserPoints(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt((req.query.page as string) || "1");
      const limit = parseInt((req.query.limit as string) || "10");
      const skip = (page - 1) * limit;

      const [points, total, totalPoints] = await Promise.all([
        prisma.point.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.point.count({ where: { userId } }),
        prisma.point.aggregate({
          where: { userId, isExpired: false, expiresAt: { gte: new Date() } },
          _sum: { amount: true },
        }),
      ]);

      sendSuccess(
        res,
        { points, totalPoints: totalPoints._sum.amount || 0 },
        "Point history retrieved",
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
}
