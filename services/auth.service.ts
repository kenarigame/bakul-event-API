import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import { config } from '../config';
import { generateReferralCode } from '../utils/response';

export class AuthService {
  async register(data: {
    name: string;
    email: string;
    password: string;
    role: 'CUSTOMER' | 'ORGANIZER';
    referralCode?: string;
  }) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new Error('Email already registered');

    const hashedPassword = await bcrypt.hash(data.password, config.bcrypt.saltRounds);
    const referralCode = generateReferralCode();
    
    let referredByUser = null;
    if (data.referralCode) {
      referredByUser = await prisma.user.findUnique({ where: { referralCode: data.referralCode } });
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          role: data.role,
          referralCode,
          referredBy: referredByUser?.id,
        },
      });

      if (data.role === 'ORGANIZER') {
        await tx.organizer.create({
          data: { userId: newUser.id, name: data.name },
        });
      }

      // Reward referrer with points
      if (referredByUser) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        await tx.point.create({
          data: {
            userId: referredByUser.id,
            amount: 10000,
            description: `Referral bonus for inviting ${data.name}`,
            expiresAt,
          },
        });
        // Give new user a coupon
        await tx.coupon.create({
          data: {
            userId: newUser.id,
            code: `WELCOME-${generateReferralCode()}`,
            discount: 10,
            isPercent: true,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return newUser;
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organizer: true },
    });
    if (!user) throw new Error('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error('Invalid credentials');

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = this.generateRefreshToken(user.id, user.email, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as { userId: string; email: string; role: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || user.refreshToken !== token) throw new Error('Invalid refresh token');

      const accessToken = this.generateAccessToken(user.id, user.email, user.role);
      const newRefreshToken = this.generateRefreshToken(user.id, user.email, user.role);

      await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });
      return { accessToken, refreshToken: newRefreshToken };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // Don't reveal if user exists

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    return { token, user };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) throw new Error('Invalid or expired reset token');

    const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
    });
  }

  async logout(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  }

  private generateAccessToken(userId: string, email: string, role: string) {
    return jwt.sign({ userId, email, role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  private generateRefreshToken(userId: string, email: string, role: string) {
    return jwt.sign({ userId, email, role }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }
}
