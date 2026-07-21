import { z } from 'zod';

export const createVoucherSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').toUpperCase(),
  discount: z.number().positive('Discount must be positive'),
  isPercent: z.boolean().default(true),
  maxUses: z.number().int().positive('Max uses must be positive'),
  minPurchase: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const checkoutSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  tickets: z.array(z.object({
    ticketId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1, 'At least one ticket is required'),
  voucherCode: z.string().optional(),
  pointsToUse: z.number().int().min(0).default(0),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  images: z.array(z.string().url()).optional(),
});
