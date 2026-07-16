import { prisma } from '@spravka/shared/db';
import { formatCertNumber, counterId, certYear } from '@spravka/shared/core';

/**
 * Atomically allocate the next certificate number for a firm+year and return
 * both the sequence and the formatted "DDMMYYYY/NN" string.
 */
export async function nextCertNumber(
  firmId: string,
  issueDate: Date,
): Promise<{ seq: number; number: string }> {
  const id = counterId(firmId, certYear(issueDate));
  const counter = await prisma.counter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });
  return { seq: counter.value, number: formatCertNumber(issueDate, counter.value) };
}
