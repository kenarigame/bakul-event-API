import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { AdminController } from "../controllers/admin.controller";
import { categorySchema } from "../validators/auth.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();
const ctrl = new AdminController();

router.post(
  "/categories",
  authenticate,
  authorize("ADMIN"),
  validate(categorySchema),
  ctrl.createCategory.bind(ctrl),
);

export default router;
