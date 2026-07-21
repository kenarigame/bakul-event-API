import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { checkoutSchema } from "../validators/transaction.validator";

const router = Router();
const ctrl = new TransactionController();

router.post(
  "/checkout",
  authenticate,
  authorize("CUSTOMER"),
  validate(checkoutSchema),
  ctrl.checkout.bind(ctrl),
);
router.get("/my", authenticate, ctrl.getUserTransactions.bind(ctrl));
router.get(
  "/organizer",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.getOrganizerTransactions.bind(ctrl),
);
router.get("/:id", authenticate, ctrl.getTransactionById.bind(ctrl));
router.post(
  "/:id/payment-proof",
  authenticate,
  ctrl.uploadPaymentProof.bind(ctrl),
);
router.patch(
  "/:id/approve",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.approvePayment.bind(ctrl),
);
router.patch(
  "/:id/reject",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.rejectPayment.bind(ctrl),
);
router.patch("/:id/cancel", authenticate, ctrl.cancelTransaction.bind(ctrl));

export default router;
