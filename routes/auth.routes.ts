import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "../validators/auth.validator";

const router = Router();
const ctrl = new AuthController();

router.post("/register", validate(registerSchema), ctrl.register.bind(ctrl));
router.post("/login", validate(loginSchema), ctrl.login.bind(ctrl));
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  ctrl.refreshToken.bind(ctrl),
);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  ctrl.forgotPassword.bind(ctrl),
);
router.post("/reset-password", ctrl.resetPassword.bind(ctrl));
router.post("/logout", authenticate, ctrl.logout.bind(ctrl));
router.get("/profile", authenticate, ctrl.getProfile.bind(ctrl));

export default router;
