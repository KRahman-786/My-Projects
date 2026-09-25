import { StandardShippingProvider } from './standard.provider';
import type { ShippingProvider } from './types';

const providers: Record<string, ShippingProvider> = {
  standard: new StandardShippingProvider(),
  // Register additional couriers here, e.g. shiprocket: new ShiprocketProvider(env.SHIPROCKET_EMAIL, ...)
};

export function getShippingProvider(name = process.env.SHIPPING_PROVIDER ?? 'standard'): ShippingProvider {
  return providers[name] ?? providers.standard!;
}

export async function checkPincode(pincode: string) {
  return getShippingProvider().checkServiceability(pincode);
}
