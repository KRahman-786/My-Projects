export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  /** Business days from dispatch to delivery */
  deliveryDays: number;
  estimatedDeliveryDate: Date;
  city?: string | null;
  state?: string | null;
}

export interface RateInput {
  pincode?: string;
  /** Order value after discounts, paise */
  orderValue: number;
  weightGrams: number;
}

export interface ShipmentRequest {
  orderNumber: string;
  pincode: string;
  weightGrams: number;
  codAmount: number;
}

export interface ShipmentResult {
  provider: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/**
 * Contract every courier integration implements (Shiprocket, Delhivery, India Post, ...).
 * The order system only talks to this interface, so adding a courier means adding a provider class
 * and registering it in shipping.service.ts — no order-flow changes.
 */
export interface ShippingProvider {
  readonly name: string;
  checkServiceability(pincode: string): Promise<ServiceabilityResult>;
  getRate(input: RateInput): Promise<{ fee: number }>;
  /** Books a shipment with the courier. Providers without an API return no tracking number (manual dispatch). */
  createShipment(request: ShipmentRequest): Promise<ShipmentResult>;
  trackingUrl(trackingNumber: string): string | undefined;
}
