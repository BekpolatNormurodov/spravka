import { prisma } from './index';
import { certDay, counterId, formatCertNumber } from '../core/numbering';

/**
 * Allocate the next certificate number for a firm on a given day: «DDMMYYYY/NN», NN restarting at
 * 01 each day.
 *
 * One implementation, in shared, because three apps carried a copy of it and only one was ever
 * called — a numbering rule for a legal document identifier is not a thing to keep three versions
 * of.
 *
 * The allocation is an atomic increment and the number it returns is never reused: a row that is
 * created and then abandoned leaves a gap in the day's sequence. That is why nothing writes a
 * Certificate row until someone asks it to.
 */
export async function nextCertNumber(
  firmId: string,
  issueDate: Date,
): Promise<{ seq: number; number: string }> {
  const day = certDay(issueDate);
  const id = counterId(firmId, day);

  /*
    The sequence used to count the firm's whole year, so a day already has numbers in it that this
    counter knows nothing about. Starting a fresh day's counter at 1 would mint «20072026/01» when
    a certificate of that name already exists, and `Certificate.number` is unique — the save would
    fail, on a day chosen by whenever the switch happened.

    So a day's counter starts past whatever that day already issued. It only costs a query the
    first time each day is used, and only days that predate the change are ever above zero.
  */
  const known = await prisma.counter.findUnique({ where: { id }, select: { id: true } });
  let start = 0;
  if (!known) {
    /*
      Read the numbers, not `seq`. They are the thing that must not repeat, and the two can differ:
      a row carrying `ZZ-EIMZO/TEST` with seq 994 sits on one of these days, and going by seq would
      have made the next real certificate «16072026/995». Anything not shaped «DDMMYYYY/NN» is not
      competing for a number and is skipped.
    */
    const prefix = formatCertNumber(issueDate, 0).slice(0, 8);
    const sameDay = await prisma.certificate.findMany({
      where: { firmId, number: { startsWith: `${prefix}/` } },
      select: { number: true },
    });
    for (const { number } of sameDay) {
      const nn = Number(number.slice(prefix.length + 1));
      if (Number.isInteger(nn) && nn > start) start = nn;
    }
  }

  // upsert rather than create-then-increment: two saves racing on a day's first certificate both
  // reach this, and the loser must increment what the winner created rather than fail.
  const counter = await prisma.counter.upsert({
    where: { id },
    create: { id, value: start + 1 },
    update: { value: { increment: 1 } },
  });

  return { seq: counter.value, number: formatCertNumber(issueDate, counter.value) };
}
