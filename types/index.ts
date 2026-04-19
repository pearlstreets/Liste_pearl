export interface Currency {
  code: string;
  symbol: string;
  rate: number;
  name: string;
  flag: string;
  decimals?: number;
}

export interface Language {
  code: string;
  label: string;
  flag: string;
}

export interface UserProfile {
  id?: string | number;
  username?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  pseudo?: string;
  prenom?: string;
  nom?: string;
  phone?: string;
  photo?: string | null;
  gender?: string;
  dob?: string;
  addresses?: Address[];
  selectedAddressId?: string | null;
  address?: string;
  addressSupplement?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  role?: string;
}

export interface Address {
  id: string;
  address: string;
  addressSupplement?: string;
  city: string;
  postalCode: string;
  country: string;
  label?: string;
}

export interface CartItem {
  id: string;
  name: string;
  detail?: string;
  price: number;
  qty: number;
  shop?: string;
  unitPrice?: string;
}

export interface Order {
  id: number;
  date: string;
  items: CartItem[];
  total: number;
  status: string;
  mode?: 'delivery' | 'collect';
  address?: string;
  deliveryFee?: number;
}

export interface ProductImage {
  emoji: string;
  bg: string;
}

export interface ShopInfo {
  id: string | number;
  name: string;
  address?: string;
  city?: string;
  distance?: number | null;
  travelTime?: number | null;
  deliveryFee?: number;
  rating?: number;
  image?: string | null;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  message?: string;
}
