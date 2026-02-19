export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  isActive: boolean;
  createdAt: string;
}

export interface Personnel {
  id: string;
  tcKimlikNo?: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
  username?: string;
  cardNumber: string;
  department?: string;
  title?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  lastAccessTime?: string;
  lastDirection?: 'in' | 'out';
}

export interface WorkSchedule {
  id: string;
  name: string;
  workStartTime: string;
  workEndTime: string;
  isFlexible: boolean;
  flexGraceMinutes: number | null;
  calculationMode: 'firstLast' | 'paired';
  locationCount?: number;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  description?: string;
  isActive: boolean;
  devicesCount?: number;
  workScheduleId?: string | null;
  workSchedule?: WorkSchedule | null;
}

export interface Device {
  id: string;
  name: string;
  serialNumber?: string;
  ipAddress: string;
  port: number;
  locationId?: string;
  location?: Location;
  direction: 'in' | 'out' | 'both';
  commKey?: string;
  isOnline: boolean;
  lastSyncAt?: string;
  isActive: boolean;
}

export interface AccessLog {
  id: string;
  personnelId?: string;
  personnel?: Personnel;
  deviceId: string;
  device?: Device;
  locationId?: string;
  location?: Location;
  deviceUserId?: number;
  eventTime: string;
  direction?: 'in' | 'out';
  source: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardSummary {
  totalPersonnel: number;
  todayArrived: number;
  currentlyInside: number;
  devicesOnline: number;
  devicesTotal: number;
}
