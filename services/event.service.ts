
import { generateSlug } from "../utils/response";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";

interface EventFilters {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  isFree?: boolean;
  organizerId?: string;
  status?: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export class EventService {
  async createEvent(
    organizerId: string,
    data: {
      name: string;
      description: string;
      categoryId: string;
      venue: string;
      address: string;
      city: string;
      province?: string;
      googleMapsUrl?: string;
      startDate: string;
      endDate: string;
      registrationDeadline: string;
      capacity: number;
      terms?: string;
      contactEmail?: string;
      contactPhone?: string;
      tickets: Array<{
        name: string;
        description?: string;
        type: "FREE" | "PAID";
        price: number;
        quantity: number;
        maxPerOrder: number;
      }>;
    },
  ) {
    const slug = generateSlug(data.name);

    return prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organizerId,
          categoryId: data.categoryId,
          name: data.name,
          slug,
          description: data.description,
          venue: data.venue,
          address: data.address,
          city: data.city,
          province: data.province,
          googleMapsUrl: data.googleMapsUrl,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          registrationDeadline: new Date(data.registrationDeadline),
          capacity: data.capacity,
          availableSeats: data.capacity,
          terms: data.terms,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
        },
      });

      await tx.ticket.createMany({
        data: data.tickets.map((t) => ({
          eventId: event.id,
          name: t.name,
          description: t.description,
          type: t.type,
          price: t.price,
          quantity: t.quantity,
          available: t.quantity,
          maxPerOrder: t.maxPerOrder,
        })),
      });

      return tx.event.findUnique({
        where: { id: event.id },
        include: { category: true, organizer: true, tickets: true },
      });
    });
  }

  async getEvents(filters: EventFilters) {
    const {
      page,
      limit,
      search,
      categoryId,
      city,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      isFree,
      organizerId,
      status,
      sortBy,
      sortOrder,
    } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.EventWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { venue: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (startDate) where.startDate = { gte: new Date(startDate) };
    if (endDate) where.endDate = { lte: new Date(endDate) };
    if (organizerId) where.organizerId = organizerId;
    if (status)
      where.status = status as
        | "DRAFT"
        | "PUBLISHED"
        | "CANCELLED"
        | "COMPLETED";
    else where.status = "PUBLISHED";

    if (isFree !== undefined) {
      if (isFree) {
        where.tickets = { some: { type: "FREE" } };
      } else {
        where.tickets = { some: { type: "PAID" } };
      }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.tickets = {
        some: {
          price: {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
          },
        },
      };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: true,
          organizer: { select: { id: true, name: true, logo: true } },
          tickets: true,
          _count: { select: { reviews: true, transactions: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getEventById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        category: true,
        organizer: true,
        tickets: true,
        vouchers: {
          where: {
            endDate: { gte: new Date() },
            usedCount: { lt: prisma.voucher.fields.maxUses },
          },
        },
        reviews: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { reviews: true } },
      },
    });
    return event;
  }

  async getEventBySlug(slug: string) {
    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        category: true,
        organizer: true,
        tickets: true,
        vouchers: { where: { endDate: { gte: new Date() } } },
        reviews: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { reviews: true } },
      },
    });
    return event;
  }

  async updateEvent(
    eventId: string,
    organizerId: string,
    data: Partial<Parameters<EventService["createEvent"]>[1]>,
  ) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
    });
    if (!event) throw new Error("Event not found or unauthorized");

    const { tickets, ...eventData } = data;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          ...eventData,
          ...(eventData.startDate && {
            startDate: new Date(eventData.startDate),
          }),
          ...(eventData.endDate && { endDate: new Date(eventData.endDate) }),
          ...(eventData.registrationDeadline && {
            registrationDeadline: new Date(eventData.registrationDeadline),
          }),
        },
      });

      if (tickets && tickets.length > 0) {
        await tx.ticket.deleteMany({ where: { eventId } });
        await tx.ticket.createMany({
          data: tickets.map((t) => ({
            eventId,
            name: t.name,
            description: t.description,
            type: t.type,
            price: t.price,
            quantity: t.quantity,
            available: t.quantity,
            maxPerOrder: t.maxPerOrder,
          })),
        });
      }

      return tx.event.findUnique({
        where: { id: eventId },
        include: { category: true, tickets: true },
      });
    });
  }

  async deleteEvent(eventId: string, organizerId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
    });
    if (!event) throw new Error("Event not found or unauthorized");
    if (["CONFIRMED", "COMPLETED"].includes(event.status))
      throw new Error("Cannot delete event with confirmed transactions");

    await prisma.event.delete({ where: { id: eventId } });
  }

  async publishEvent(eventId: string, organizerId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId },
    });
    if (!event) throw new Error("Event not found or unauthorized");
    return prisma.event.update({
      where: { id: eventId },
      data: { status: "PUBLISHED" },
    });
  }

  async getFeaturedEvents(limit = 6) {
    return prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        isFeatured: true,
        startDate: { gte: new Date() },
      },
      take: limit,
      orderBy: { startDate: "asc" },
      include: {
        category: true,
        organizer: { select: { id: true, name: true, logo: true } },
        tickets: true,
      },
    });
  }

  async getUpcomingEvents(limit = 8) {
    return prisma.event.findMany({
      where: { status: "PUBLISHED", startDate: { gte: new Date() } },
      take: limit,
      orderBy: { startDate: "asc" },
      include: {
        category: true,
        organizer: { select: { id: true, name: true, logo: true } },
        tickets: true,
      },
    });
  }
}
