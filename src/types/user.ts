export type UserRole = 'user' | 'organizer' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_verified: boolean;
  role: UserRole;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password_hash: string;
  role?: UserRole;
  terms_accepted: boolean;
}