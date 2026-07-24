import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  venue: z.string().min(2, 'Venue is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  province: z.string().optional(),
  googleMapsUrl: z.string().url().optional().or(z.literal('')),
  startDate: z.string(),
  endDate: z.string(),
  registrationDeadline: z.string(),
  capacity: z.number().int().positive('Capacity must be positive'),
  terms: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  tickets: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['FREE', 'PAID']),
    price: z.number().min(0),
    quantity: z.number().int().positive(),
    maxPerOrder: z.number().int().positive().default(10),
  })).min(1, 'At least one ticket type is required'),
});

export const updateEventSchema = createEventSchema.partial();

export const eventQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  limit: z.string().optional().transform(v => parseInt(v || '12')),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  city: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  maxPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  isFree: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
  organizerId: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(['startDate', 'createdAt', 'name', 'capacity']).optional().default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});
