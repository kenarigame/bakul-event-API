import { Router } from "express";
import { ReviewController } from "../controllers/review.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { reviewSchema } from "../validators/transaction.validator";

const router = Router();
const ctrl = new ReviewController();

router.get("/event/:eventId", ctrl.getEventReviews.bind(ctrl));
router.post(
  "/event/:eventId",
  authenticate,
  authorize("CUSTOMER"),
  validate(reviewSchema),
  ctrl.createReview.bind(ctrl),
);
router.put(
  "/:id",
  authenticate,
  validate(reviewSchema),
  ctrl.updateReview.bind(ctrl),
);
router.delete("/:id", authenticate, ctrl.deleteReview.bind(ctrl));

export default router;
