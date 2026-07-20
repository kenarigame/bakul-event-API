import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const user = await authService.register(req.body);
      sendSuccess(res, user, 'Registration successful', 201);
    } catch (err) {
      sendError(res, (err as Error).message, 400);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      sendSuccess(res, result, 'Login successful');
    } catch (err) {
      sendError(res, (err as Error).message, 401);
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const tokens = await authService.refreshToken(req.body.refreshToken);
      sendSuccess(res, tokens, 'Token refreshed');
    } catch (err) {
      sendError(res, (err as Error).message, 401);
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      await authService.forgotPassword(req.body.email);
      sendSuccess(res, null, 'If that email is registered, you will receive a reset link');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      sendSuccess(res, null, 'Password reset successful');
    } catch (err) {
      sendError(res, (err as Error).message, 400);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      await authService.logout(req.user!.userId);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await import('../config/database').then(m =>
        m.default.user.findUnique({
          where: { id: req.user!.userId },
          include: { organizer: true },
          omit: { password: true, refreshToken: true },
        })
      );
      sendSuccess(res, user, 'Profile retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }
}
