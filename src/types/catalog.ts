export interface Game {
  id: number;
  name: string;
  category: string | null;
  is_active: boolean;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  region: string | null;
}