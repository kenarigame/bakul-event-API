import { Request, Response } from 'express';
import { EventService } from '../services/event.service';
import { sendSuccess, sendError } from '../utils/response';

const eventService = new EventService();

export class EventController {
  async createEvent(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer profile not found', 404); return; }
      const event = await eventService.createEvent(organizer.id, req.body);
      sendSuccess(res, event, 'Event created successfully', 201);
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const result = await eventService.getEvents(req.query as Parameters<EventService['getEvents']>[0]);
      sendSuccess(res, result.events, 'Events retrieved', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getEventBySlug(req: Request, res: Response): Promise<void> {
    try {
      const event = await eventService.getEventBySlug(req.params.slug);
      if (!event) { sendError(res, 'Event not found', 404); return; }
      sendSuccess(res, event, 'Event retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const event = await eventService.getEventById(req.params.id);
      if (!event) { sendError(res, 'Event not found', 404); return; }
      sendSuccess(res, event, 'Event retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      const event = await eventService.updateEvent(req.params.id, organizer.id, req.body);
      sendSuccess(res, event, 'Event updated successfully');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      await eventService.deleteEvent(req.params.id, organizer.id);
      sendSuccess(res, null, 'Event deleted successfully');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async publishEvent(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      const event = await eventService.publishEvent(req.params.id, organizer.id);
      sendSuccess(res, event, 'Event published successfully');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getFeaturedEvents(_req: Request, res: Response): Promise<void> {
    try {
      const events = await eventService.getFeaturedEvents();
      sendSuccess(res, events, 'Featured events retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getUpcomingEvents(_req: Request, res: Response): Promise<void> {
    try {
      const events = await eventService.getUpcomingEvents();
      sendSuccess(res, events, 'Upcoming events retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getCategories(_req: Request, res: Response): Promise<void> {
    try {
      const categories = await import('../config/database').then(m =>
        m.default.category.findMany({ orderBy: { name: 'asc' } })
      );
      sendSuccess(res, categories, 'Categories retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getOrganizerEvents(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      const page = parseInt(req.query.page as string || '1');
      const limit = parseInt(req.query.limit as string || '10');
      const result = await eventService.getEvents({ page, limit, organizerId: organizer.id, sortBy: 'createdAt', sortOrder: 'desc', status: req.query.status as string });
      sendSuccess(res, result.events, 'Organizer events retrieved', 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }
}
