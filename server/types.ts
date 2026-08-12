export interface Booking {
  id: string;
  name: string;
  email: string;
  service: string;
  date: string;
  time: string;
  // structured address fields
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
}

export interface BookingPayload {
  name: string;
  email: string;
  service: string;
  date: string;
  time: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
}

export interface AdminLoginRequest {
  password: string;
}
