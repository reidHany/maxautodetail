import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Booking } from './types';

const dataFile = join(process.cwd(), 'server', 'bookings.json');

export async function readBookings(): Promise<Booking[]> {
  try {
    const raw = await readFile(dataFile, 'utf8');
    return JSON.parse(raw) as Booking[];
  } catch {
    await writeFile(dataFile, '[]', 'utf8');
    return [];
  }
}

export async function writeBookings(bookings: Booking[]) {
  await writeFile(dataFile, JSON.stringify(bookings, null, 2), 'utf8');
}
