import { logger } from '../config/logger';
import { expireStaleOrders } from '../services/order.service';
import { reconcileOrderPayment } from '../services/payments/payment.service';

let timer: NodeJS.Timeout | null = null;
let running = false;

/** Periodically releases stock held by unpaid online orders (after checking the gateway for late payments). */
export function startJobs(intervalMs = 60_000) {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const expired = await expireStaleOrders(reconcileOrderPayment);
      if (expired) logger.info(`Expired ${expired} unpaid order(s) and released their stock`);
    } catch (error) {
      logger.error('Order expiry job failed', { error: (error as Error).message });
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, intervalMs);
  timer.unref();
  void tick();
}

export function stopJobs() {
  if (timer) clearInterval(timer);
  timer = null;
}
