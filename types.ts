
export enum AppTab {
  HOME = 'home',
  MONITORING = 'monitoring',
  EDUCATION = 'education',
  PARTICIPATION = 'participation',
  CULTURE = 'culture',
  CHAT = 'chat'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface EnvironmentalReport {
  id: number;
  type: 'fauna' | 'flora' | 'emergency';
  title: string;
  user: string;
  date: string;
  description: string;
  timestamp: Date;
  coords: [number, number];
  imageUrl: string;
  remoteId?: string;
  ownerId?: string;
}

export interface UserProfile {
  name: string;
  bio: string;
  avatar: string;
  level: string;
  reportsCount: number;
  points: number;
}

export interface WeatherData {
  temp: number | string;
  humidity: number | string;
  wind: number | string;
}

export interface Species {
  id: string;
  name: string;
  scientificName: string;
  category: 'ave' | 'planta' | 'mamifero' | 'anfibio';
  description: string;
  imageUrl: string;
}
