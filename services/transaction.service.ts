import prisma from '../config/database';
import { addHours, addDays } from '../utils/response';

const POINTS_TO_IDR = 1; // 1 point = Rp 1

export class TransactionService {
  async checkout(userId: string, data: {
    eventId: string;
    tickets: Array<{ ticketId: string; quantity: number }>;
    voucherCode?: string;
    pointsToUse: number;
  }) {
    return prisma.$transaction(async (tx) => {
      // Validate event
      const event = await tx.event.findUnique({
        where: { id: data.eventId, status: 'PUBLISHED' },
        include: { tickets: true },
      });
      if (!event) throw new Error('Event not found or not available');
      if (new Date() > event.registrationDeadline) throw new Error('Registration deadline has passed');

      // Validate and calculate tickets
      let subtotal = 0;
      const ticketDetails = [];

      for (const item of data.tickets) {
        const ticket = event.tickets.find(t => t.id === item.ticketId);
        if (!ticket) throw new Error(`Ticket ${item.ticketId} not found`);
        if (ticket.available < item.quantity) throw new Error(`Not enough seats for ticket: ${ticket.name}`);
        if (item.quantity > ticket.maxPerOrder) throw new Error(`Max ${ticket.maxPerOrder} tickets per order for: ${ticket.name}`);

        const itemSubtotal = parseFloat(ticket.price.toString()) * item.quantity;
        subtotal += itemSubtotal;
        ticketDetails.push({ ticket, quantity: item.quantity, price: parseFloat(ticket.price.toString()), subtotal: itemSubtotal });
      }

      // Apply voucher
      let voucherDiscount = 0;
      let voucherId = null;
      if (data.voucherCode) {
        const voucher = await tx.voucher.findUnique({
          where: { eventId_code: { eventId: data.eventId, code: data.voucherCode.toUpperCase() } },
        });
        if (!voucher) throw new Error('Invalid voucher code');
        if (new Date() < voucher.startDate || new Date() > voucher.endDate) throw new Error('Voucher has expired');
        if (voucher.usedCount >= voucher.maxUses) throw new Error('Voucher usage limit reached');
        if (voucher.minPurchase && subtotal < parseFloat(voucher.minPurchase.toString())) {
          throw new Error(`Minimum purchase of Rp ${voucher.minPurchase} required`);
        }

        if (voucher.isPercent) {
          voucherDiscount = subtotal * (parseFloat(voucher.discount.toString()) / 100);
          if (voucher.maxDiscount) voucherDiscount = Math.min(voucherDiscount, parseFloat(voucher.maxDiscount.toString()));
        } else {
          voucherDiscount = parseFloat(voucher.discount.toString());
        }
        voucherId = voucher.id;
        await tx.voucher.update({ where: { id: voucher.id }, data: { usedCount: { increment: 1 } } });
      }

      // Apply points
      let pointsDiscount = 0;
      if (data.pointsToUse > 0) {
        const userPoints = await tx.point.findMany({
          where: { userId, isExpired: false, expiresAt: { gte: new Date() } },
          orderBy: { expiresAt: 'asc' },
        });
        const totalAvailablePoints = userPoints.reduce((sum, p) => sum + p.amount, 0);
        if (data.pointsToUse > totalAvailablePoints) throw new Error('Insufficient points');

        pointsDiscount = data.pointsToUse * POINTS_TO_IDR;
        // Deduct points (from oldest first)
        let remaining = data.pointsToUse;
        for (const point of userPoints) {
          if (remaining <= 0) break;
          if (point.amount <= remaining) {
            await tx.point.update({ where: { id: point.id }, data: { isExpired: true } });
            remaining -= point.amount;
          } else {
            await tx.point.update({ where: { id: point.id }, data: { amount: { decrement: remaining } } });
            remaining = 0;
          }
        }
      }

      const total = Math.max(0, subtotal - voucherDiscount - pointsDiscount);
      const paymentDeadline = addHours(new Date(), 2);

      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          userId,
          eventId: data.eventId,
          voucherId,
          subtotal,
          voucherDiscount,
          pointsUsed: data.pointsToUse,
          pointsDiscount,
          total,
          paymentDeadline,
          status: total === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT',
        },
      });

      // Create transaction details and deduct seats
      for (const detail of ticketDetails) {
        await tx.transactionDetail.create({
          data: {
            transactionId: transaction.id,
            ticketId: detail.ticket.id,
            quantity: detail.quantity,
            price: detail.price,
            subtotal: detail.subtotal,
          },
        });
        await tx.ticket.update({
          where: { id: detail.ticket.id },
          data: { available: { decrement: detail.quantity } },
        });
      }

      // Deduct event available seats
      const totalTickets = ticketDetails.reduce((sum, d) => sum + d.quantity, 0);
      await tx.event.update({
        where: { id: data.eventId },
        data: { availableSeats: { decrement: totalTickets } },
      });

      return tx.transaction.findUnique({
        where: { id: transaction.id },
        include: { details: { include: { ticket: true } }, event: true, voucher: true },
      });
    });
  }

  async uploadPaymentProof(transactionId: string, userId: string, imageUrl: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId, status: 'PENDING_PAYMENT' },
    });
    if (!transaction) throw new Error('Transaction not found');
    if (new Date() > transaction.paymentDeadline) throw new Error('Payment deadline has expired');

    return prisma.$transaction(async (tx) => {
      await tx.paymentProof.create({ data: { transactionId, imageUrl } });
      return tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'WAITING_CONFIRMATION' },
      });
    });
  }

  async approvePayment(transactionId: string, organizerId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, status: 'WAITING_CONFIRMATION', event: { organizer: { id: organizerId } } },
    });
    if (!transaction) throw new Error('Transaction not found');

    return prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
  }

  async rejectPayment(transactionId: string, organizerId: string, notes: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, status: 'WAITING_CONFIRMATION', event: { organizer: { id: organizerId } } },
      include: { details: true },
    });
    if (!transaction) throw new Error('Transaction not found');

    return this.cancelTransactionAndRestore(transactionId, 'REJECTED', notes);
  }

  async cancelTransaction(transactionId: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId, status: { in: ['PENDING_PAYMENT', 'WAITING_CONFIRMATION'] } },
    });
    if (!transaction) throw new Error('Transaction not found or cannot be cancelled');

    return this.cancelTransactionAndRestore(transactionId, 'CANCELLED');
  }

  private async cancelTransactionAndRestore(transactionId: string, status: 'CANCELLED' | 'REJECTED' | 'EXPIRED', notes?: string) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { details: true },
      });
      if (!transaction) throw new Error('Transaction not found');

      // Restore seats
      for (const detail of transaction.details) {
        await tx.ticket.update({
          where: { id: detail.ticketId },
          data: { available: { increment: detail.quantity } },
        });
      }
      const totalSeats = transaction.details.reduce((sum, d) => sum + d.quantity, 0);
      await tx.event.update({ where: { id: transaction.eventId }, data: { availableSeats: { increment: totalSeats } } });

      // Restore voucher usage
      if (transaction.voucherId) {
        await tx.voucher.update({ where: { id: transaction.voucherId }, data: { usedCount: { decrement: 1 } } });
      }

      // Restore points
      if (transaction.pointsUsed > 0) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        await tx.point.create({
          data: {
            userId: transaction.userId,
            amount: transaction.pointsUsed,
            description: `Points restored from cancelled transaction`,
            expiresAt,
          },
        });
      }

      return tx.transaction.update({
        where: { id: transactionId },
        data: { status, cancelledAt: new Date(), notes },
      });
    });
  }

  async getUserTransactions(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: { include: { category: true } },
          details: { include: { ticket: true } },
          paymentProofs: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);
    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrganizerTransactions(organizerId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { event: { organizer: { id: organizerId } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          event: true,
          details: { include: { ticket: true } },
          paymentProofs: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        },
      }),
      prisma.transaction.count({ where: { event: { organizer: { id: organizerId } } } }),
    ]);
    return { transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async completeTransaction(transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, status: 'CONFIRMED' },
    });
    if (!transaction) throw new Error('Transaction not found');

    return prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async expireOldTransactions() {
    const expiredTransactions = await prisma.transaction.findMany({
      where: { status: 'PENDING_PAYMENT', paymentDeadline: { lt: new Date() } },
    });

    for (const tx of expiredTransactions) {
      await this.cancelTransactionAndRestore(tx.id, 'EXPIRED');
    }
  }

  async getTransactionById(transactionId: string, userId: string) {
    return prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        event: { include: { organizer: true, category: true } },
        details: { include: { ticket: true } },
        paymentProofs: { orderBy: { uploadedAt: 'desc' } },
        voucher: true,
      },
    });
  }
}
