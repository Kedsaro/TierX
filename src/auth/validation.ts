export interface RegistrationValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationValues, string>>;

export function validateRegistration(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const username = values.username.trim();
  const email = values.email.trim();

  if (username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    errors.username = 'Use 3–24 letters, numbers, dots, underscores or hyphens.';
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.password.length < 10 || values.password.length > 128) {
    errors.password = 'Use a password between 10 and 128 characters.';
  } else if (!/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = 'Include at least one lowercase letter, one uppercase letter and one number.';
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (!values.acceptedTerms) {
    errors.acceptedTerms = 'Accept the terms to create an account.';
  }

  return errors;
}

export function validateLogin(login: string, password: string): string | null {
  if (!login.trim()) return 'Enter your username or email.';
  if (!password) return 'Enter your password.';
  return null;
}

export function validateVerificationCode(code: string): string | null {
  return /^\d{6}$/.test(code) ? null : 'Enter the 6-digit verification code.';
}