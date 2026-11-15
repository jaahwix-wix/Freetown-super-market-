export type ProductCategory =
  | 'Fresh Produce'
  | 'Pantry & Grains'
  | 'Bakery & Dairy'
  | 'Chilled & Beverages'
  | 'Cosmetics'
  | 'Drinks by Crate'
  | 'Water by Crate'
  | 'Household & Care';

export type OrderStatus =
  | 'confirmed'
  | 'packing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'card' | 'orange_money' | 'africell_money' | 'cod';
export type PaymentStatus = 'paid' | 'cod_pending';

export type EmailEventType =
  | 'order_confirmed'
  | 'status_packing'
  | 'status_out_for_delivery'
  | 'status_delivered'
  | 'status_cancelled';

export type InventoryReason =
  | 'customer_order'
  | 'manual_restock'
  | 'inventory_adjustment'
  | 'initial_seed';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  description: string;
  unit: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string;
  featured: boolean;
  active: boolean;
  lastOrderId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZone: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  itemsSummary: string;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItemRecord {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  customerId: string;
}

export interface EmailNotificationRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyPreview: string;
  eventType: EmailEventType;
  deliveryMode: 'smtp' | 'outbox_logged';
  deliveryStatus: 'sent' | 'queued';
  messageId: string;
  createdAt?: unknown;
}

export interface InventoryLogRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  previousStock: number;
  newStock: number;
  delta: number;
  reason: InventoryReason;
  actorUid: string;
  actorEmail: string;
  orderId: string;
  createdAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  defaultAddress?: string;
  defaultZone?: string;
  role: 'customer' | 'admin';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeliveryZoneOption {
  name: string;
  fee: number;
  eta: string;
}

export const FREETOWN_DELIVERY_ZONES: DeliveryZoneOption[] = [
  { name: 'Central Freetown & Tower Hill', fee: 25, eta: '45–60 mins' },
  { name: 'Wilkinson Road & Congo Cross', fee: 25, eta: '45–60 mins' },
  { name: 'Aberdeen & Lumley Beach', fee: 35, eta: '60–75 mins' },
  { name: 'Hill Station & Wilberforce', fee: 40, eta: '60–90 mins' },
  { name: 'Kissy & Wellington', fee: 45, eta: '75–100 mins' },
  { name: 'Goderich & Regent', fee: 50, eta: '80–110 mins' },
];

export const FREE_DELIVERY_THRESHOLD = 600;

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Fresh Produce',
  'Pantry & Grains',
  'Bakery & Dairy',
  'Chilled & Beverages',
  'Cosmetics',
  'Drinks by Crate',
  'Water by Crate',
  'Household & Care',
];
