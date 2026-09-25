import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import type { AddressInput } from '../validators/address.validators';

export async function listAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
}

export async function getOwnedAddress(userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw AppError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
  return address;
}

export async function createAddress(userId: string, input: AddressInput) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= 20) throw AppError.badRequest('You can save up to 20 addresses', 'ADDRESS_LIMIT');
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...input, userId, isDefault: makeDefault } });
  });
}

export async function updateAddress(userId: string, id: string, input: Partial<AddressInput>) {
  await getOwnedAddress(userId, id);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data: { ...input, isDefault: input.isDefault === false ? undefined : input.isDefault } });
  });
}

export async function setDefaultAddress(userId: string, id: string) {
  return updateAddress(userId, id, { isDefault: true });
}

export async function deleteAddress(userId: string, id: string) {
  const address = await getOwnedAddress(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}
