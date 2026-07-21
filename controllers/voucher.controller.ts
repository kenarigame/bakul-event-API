import { Request, Response } from "express";
import prisma from "../config/database";
import { sendSuccess, sendError } from "../utils/response";

export class VoucherController {
  async createVoucher(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await prisma.organizer.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!organizer) {
        sendError(res, "Organizer not found", 404);
        return;
      }

      const event = await prisma.event.findFirst({
        where: { id: req.params.eventId, organizerId: organizer.id },
      });
      if (!event) {
        sendError(res, "Event not found", 404);
        return;
      }

      const voucher = await prisma.voucher.create({
        data: {
          eventId: event.id,
          code: req.body.code.toUpperCase(),
          discount: req.body.discount,
          isPercent: req.body.isPercent,
          maxUses: req.body.maxUses,
          minPurchase: req.body.minPurchase,
          maxDiscount: req.body.maxDiscount,
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate),
        },
      });

      sendSuccess(res, voucher, "Voucher created", 201);
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getEventVouchers(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await prisma.organizer.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!organizer) {
        sendError(res, "Organizer not found", 404);
        return;
      }

      const vouchers = await prisma.voucher.findMany({
        where: {
          eventId: req.params.eventId,
          event: { organizerId: organizer.id },
        },
        orderBy: { createdAt: "desc" },
      });

      sendSuccess(res, vouchers, "Vouchers retrieved");
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async deleteVoucher(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await prisma.organizer.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!organizer) {
        sendError(res, "Organizer not found", 404);
        return;
      }

      const voucher = await prisma.voucher.findFirst({
        where: { id: req.params.id, event: { organizerId: organizer.id } },
      });
      if (!voucher) {
        sendError(res, "Voucher not found", 404);
        return;
      }

      await prisma.voucher.delete({ where: { id: req.params.id } });
      sendSuccess(res, null, "Voucher deleted");
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async validateVoucher(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, code } = req.params;
      const voucher = await prisma.voucher.findUnique({
        where: { eventId_code: { eventId, code: code.toUpperCase() } },
      });

      if (!voucher) {
        sendError(res, "Invalid voucher code", 404);
        return;
      }
      if (new Date() < voucher.startDate || new Date() > voucher.endDate) {
        sendError(res, "Voucher has expired", 400);
        return;
      }
      if (voucher.usedCount >= voucher.maxUses) {
        sendError(res, "Voucher usage limit reached", 400);
        return;
      }

      sendSuccess(res, voucher, "Voucher is valid");
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }
}
