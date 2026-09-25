/** One-off run of the order expiry job (useful as a cron task on platforms without long-lived workers). */
import { prisma } from '../config/prisma';
import { expireStaleOrders } from '../services/order.service';
import { reconcileOrderPayment } from '../services/payments/payment.service';

expireStaleOrders(reconcileOrderPayment)
  .then((n) => console.log(`Expired ${n} order(s)`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
