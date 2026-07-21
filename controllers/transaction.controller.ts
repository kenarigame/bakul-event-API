import { Request, Response } from 'express';
import { TransactionService } from '../services/transaction.service';
import { sendSuccess, sendError } from '../utils/response';

const transactionService = new TransactionService();

export class TransactionController {
  async checkout(req: Request, res: Response): Promise<void> {
    try {
      const transaction = await transactionService.checkout(req.user!.userId, req.body);
      sendSuccess(res, transaction, 'Checkout successful', 201);
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async uploadPaymentProof(req: Request, res: Response): Promise<void> {
    try {
      const imageUrl = req.file ? (req.file as Express.Multer.File & { path?: string }).path || req.file.filename : req.body.imageUrl;
      if (!imageUrl) { sendError(res, 'Payment proof image is required', 400); return; }
      const tx = await transactionService.uploadPaymentProof(req.params.id, req.user!.userId, imageUrl);
      sendSuccess(res, tx, 'Payment proof uploaded');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async approvePayment(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      const tx = await transactionService.approvePayment(req.params.id, organizer.id);
      sendSuccess(res, tx, 'Payment approved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async rejectPayment(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      const tx = await transactionService.rejectPayment(req.params.id, organizer.id, req.body.notes || '');
      sendSuccess(res, tx, 'Payment rejected');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async cancelTransaction(req: Request, res: Response): Promise<void> {
    try {
      const tx = await transactionService.cancelTransaction(req.params.id, req.user!.userId);
      sendSuccess(res, tx, 'Transaction cancelled');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string || '1');
      const limit = parseInt(req.query.limit as string || '10');
      const result = await transactionService.getUserTransactions(req.user!.userId, page, limit);
      sendSuccess(res, result.transactions, 'Transactions retrieved', 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getOrganizerTransactions(req: Request, res: Response): Promise<void> {
    try {
      const organizer = await import('../config/database').then(m =>
        m.default.organizer.findUnique({ where: { userId: req.user!.userId } })
      );
      if (!organizer) { sendError(res, 'Organizer not found', 404); return; }
      const page = parseInt(req.query.page as string || '1');
      const limit = parseInt(req.query.limit as string || '10');
      const result = await transactionService.getOrganizerTransactions(organizer.id, page, limit);
      sendSuccess(res, result.transactions, 'Transactions retrieved', 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }

  async getTransactionById(req: Request, res: Response): Promise<void> {
    try {
      const tx = await transactionService.getTransactionById(req.params.id, req.user!.userId);
      if (!tx) { sendError(res, 'Transaction not found', 404); return; }
      sendSuccess(res, tx, 'Transaction retrieved');
    } catch (err) {
      sendError(res, (err as Error).message);
    }
  }
}
