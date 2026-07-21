import { Router } from "express";
import { VoucherController } from "../controllers/voucher.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { createVoucherSchema } from "../validators/transaction.validator";

const router = Router();
const ctrl = new VoucherController();

router.post(
  "/event/:eventId",
  authenticate,
  authorize("ORGANIZER"),
  validate(createVoucherSchema),
  ctrl.createVoucher.bind(ctrl),
);
router.get(
  "/event/:eventId",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.getEventVouchers.bind(ctrl),
);
router.delete(
  "/:id",
  authenticate,
  authorize("ORGANIZER"),
  ctrl.deleteVoucher.bind(ctrl),
);
router.get("/validate/:eventId/:code", ctrl.validateVoucher.bind(ctrl));

export default router;
