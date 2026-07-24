import { Router } from "express";
import { EventController } from "../controllers/event.controller";
import {
  authenticate,
  authorize,
  optionalAuth,
} from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  createEventSchema,
  updateEventSchema,
} from "../validators/event.validator";

const router = Router();
const ctrl = new EventController();

router.get("/", optionalAuth, ctrl.getEvents.bind(ctrl));
router.get("/featured", ctrl.getFeaturedEvents.bind(ctrl));
router.get("/upcoming", ctrl.getUpcomingEvents.bind(ctrl));
router.get("/categories", ctrl.getCategories.bind(ctrl));
router.get(
  "/my-events",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.getOrganizerEvents.bind(ctrl),
);
router.get("/:slug", optionalAuth, ctrl.getEventBySlug.bind(ctrl));
router.get("/:id", authenticate, ctrl.getEventById.bind(ctrl));
router.post(
  "/",
  authenticate,
  authorize("ORGANIZER"),
  validate(createEventSchema),
  ctrl.createEvent.bind(ctrl),
);
router.put(
  "/:id",
  authenticate,
  authorize("ORGANIZER"),
  validate(updateEventSchema),
  ctrl.updateEvent.bind(ctrl),
);
router.patch(
  "/:id/publish",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.publishEvent.bind(ctrl),
);
router.delete(
  "/:id",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.deleteEvent.bind(ctrl),
);

export default router;
