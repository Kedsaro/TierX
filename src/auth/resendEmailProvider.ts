import { EmailAccountProvider } from './authService';

interface VerificationCode {
  code: string;
  expiresAt: number;
}

// In-memory storage for verification codes (in production, use a proper database)
const verificationCodes = new Map<string, VerificationCode>();
const passwordResetCodes = new Map<string, VerificationCode>();
const loginCodes = new Map<string, VerificationCode>();

const CODE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CODE_LENGTH = 6;

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isCodeExpired(code: VerificationCode): boolean {
  return Date.now() > code.expiresAt;
}

export function createResendEmailProvider(): EmailAccountProvider {
  const apiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY;
  
  if (!apiKey) {
    console.warn('RESEND_API_KEY not found. Email provider will not work.');
  }

  async function sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error(`Invalid email format: ${to}`);
    }

    // Clean the email (remove spaces, trim)
    const cleanEmail = to.trim().toLowerCase();

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: [cleanEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Email sent successfully:', data);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  return {
    async sendVerificationCode(email: string): Promise<void> {
      const code = generateSixDigitCode();
      const expiresAt = Date.now() + CODE_TTL;
      
      verificationCodes.set(email, { code, expiresAt });
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your TierX Account</h2>
          <p>Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `;

      await sendEmail(email, 'TierX Verification Code', htmlContent);
    },

    async verifyCode(email: string, code: string): Promise<void> {
      const storedCode = verificationCodes.get(email);
      
      if (!storedCode) {
        throw new Error('Invalid or expired verification code');
      }

      if (isCodeExpired(storedCode)) {
        verificationCodes.delete(email);
        throw new Error('Verification code has expired');
      }

      if (storedCode.code !== code) {
        throw new Error('Invalid verification code');
      }

      // Code is valid, remove it
      verificationCodes.delete(email);
    },

    async sendPasswordResetCode(email: string): Promise<void> {
      const code = generateSixDigitCode();
      const expiresAt = Date.now() + CODE_TTL;
      
      passwordResetCodes.set(email, { code, expiresAt });
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your TierX Password</h2>
          <p>Your password reset code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `;

      await sendEmail(email, 'TierX Password Reset Code', htmlContent);
    },

    async verifyPasswordResetCode(email: string, code: string): Promise<void> {
      const storedCode = passwordResetCodes.get(email);
      
      if (!storedCode) {
        throw new Error('Invalid or expired reset code');
      }

      if (isCodeExpired(storedCode)) {
        passwordResetCodes.delete(email);
        throw new Error('Reset code has expired');
      }

      if (storedCode.code !== code) {
        throw new Error('Invalid reset code');
      }

      // Code is valid, remove it
      passwordResetCodes.delete(email);
    },

    async sendLoginCode(email: string): Promise<void> {
      const code = generateSixDigitCode();
      const expiresAt = Date.now() + CODE_TTL;
      
      loginCodes.set(email, { code, expiresAt });
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">TierX Login Verification</h2>
          <p>Your login verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't attempt to log in, please ignore this email.</p>
        </div>
      `;

      await sendEmail(email, 'TierX Login Verification Code', htmlContent);
    },

    async verifyLoginCode(email: string, code: string): Promise<void> {
      const storedCode = loginCodes.get(email);
      
      if (!storedCode) {
        throw new Error('Invalid or expired login code');
      }

      if (isCodeExpired(storedCode)) {
        loginCodes.delete(email);
        throw new Error('Login code has expired');
      }

      if (storedCode.code !== code) {
        throw new Error('Invalid login code');
      }

      // Code is valid, remove it
      loginCodes.delete(email);
    },
  };
}
