import { prisma } from '../../config/prisma';
import { getSettings } from '../settings.service';
import type { RateInput, ServiceabilityResult, ShipmentRequest, ShipmentResult, ShippingProvider } from './types';

/** Adds business days, skipping Sundays. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++;
  }
  return d;
}

/** Zone-based delivery estimate from the Shahjahanpur warehouse when a pincode has no explicit override. */
function zoneDeliveryDays(pincode: string): number {
  if (pincode.startsWith('242')) return 2; // Shahjahanpur district
  const region = Number(pincode.slice(0, 2));
  if (region >= 20 && region <= 28) return 4; // Uttar Pradesh & Uttarakhand
  if (region >= 11 && region <= 19) return 5; // Delhi, Haryana, Punjab, HP, J&K
  if (region === 78 || region === 79 || region === 74 || region === 73) return 8; // North-east, Sikkim, Andaman
  return 6;
}

/**
 * Default in-house provider: flat fee with a free-shipping threshold, pincode overrides from the
 * serviceable_pincodes table and zone rules otherwise. Shipments are dispatched manually by the admin
 * (tracking number entered when marking the order SHIPPED).
 */
export class StandardShippingProvider implements ShippingProvider {
  readonly name = 'standard';

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const valid = /^[1-9][0-9]{5}$/.test(pincode);
    const override = valid ? await prisma.serviceablePincode.findUnique({ where: { pincode } }) : null;
    const deliveryDays = override?.deliveryDays ?? zoneDeliveryDays(pincode);
    return {
      pincode,
      serviceable: valid && (override?.isServiceable ?? true),
      codAvailable: valid && (override?.codAvailable ?? true),
      deliveryDays,
      estimatedDeliveryDate: addBusinessDays(new Date(), deliveryDays),
      city: override?.city,
      state: override?.state,
    };
  }

  async getRate(input: RateInput): Promise<{ fee: number }> {
    const s = await getSettings();
    if (input.orderValue <= 0) return { fee: 0 };
    return { fee: input.orderValue >= s.freeShippingThreshold ? 0 : s.flatShippingFee };
  }

  async createShipment(_request: ShipmentRequest): Promise<ShipmentResult> {
    return { provider: this.name };
  }

  trackingUrl(trackingNumber: string): string | undefined {
    return trackingNumber ? `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${encodeURIComponent(trackingNumber)}` : undefined;
  }
}
