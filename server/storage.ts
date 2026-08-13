import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { Booking } from './types';
import { getService, timeToMinutes } from './serviceCatalog';

const serverDirectory = join(process.cwd(), 'server');
const databasePath = resolve(process.env.DATABASE_PATH || join(serverDirectory, 'bookings.sqlite'));
const database = new Database(databasePath);

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    service TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
    address TEXT, address_line_1 TEXT, address_line_2 TEXT,
    city TEXT, state TEXT, zip TEXT,
    transport_service INTEGER NOT NULL DEFAULT 0, notes TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'confirmed',
    cancellation_reason TEXT, cancelled_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS blocked_times (
    date TEXT NOT NULL, time TEXT NOT NULL, PRIMARY KEY (date, time)
  );
  CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
`);

const bookingColumns = database.prepare('PRAGMA table_info(bookings)').all() as Array<{ name: string }>;
if (!bookingColumns.some((column) => column.name === 'duration_minutes')) {
  database.exec('ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60');
}
if (!bookingColumns.some((column) => column.name === 'status')) {
  database.exec("ALTER TABLE bookings ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'");
}
if (!bookingColumns.some((column) => column.name === 'cancellation_reason')) {
  database.exec('ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT');
}
if (!bookingColumns.some((column) => column.name === 'cancelled_at')) {
  database.exec('ALTER TABLE bookings ADD COLUMN cancelled_at TEXT');
}
database.prepare("UPDATE bookings SET duration_minutes = 120 WHERE duration_minutes = 60 AND service IN ('Exterior Detail', 'Interior Detail', 'Exterior Refresh', 'Interior Refresh')").run();
database.prepare("UPDATE bookings SET duration_minutes = 180 WHERE duration_minutes = 60 AND service IN ('Ceramic Coating', 'Complete Refresh')").run();

if (!database.prepare("SELECT 1 FROM migrations WHERE name = 'booking-status-v1'").get()) {
  database.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE bookings_rebuilt (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
      service TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
      address TEXT, address_line_1 TEXT, address_line_2 TEXT,
      city TEXT, state TEXT, zip TEXT,
      transport_service INTEGER NOT NULL DEFAULT 0, notes TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'confirmed',
      cancellation_reason TEXT, cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO bookings_rebuilt SELECT
      id, name, email, service, date, time, address, address_line_1,
      address_line_2, city, state, zip, transport_service, notes,
      duration_minutes, status, cancellation_reason, cancelled_at, created_at
    FROM bookings;
    DROP TABLE bookings;
    ALTER TABLE bookings_rebuilt RENAME TO bookings;
    CREATE UNIQUE INDEX unique_confirmed_booking_start ON bookings(date, time) WHERE status = 'confirmed';
    INSERT INTO migrations(name) VALUES ('booking-status-v1');
    COMMIT;
  `);
}

function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id), name: String(row.name), email: String(row.email),
    service: String(row.service), date: String(row.date), time: String(row.time),
    address: row.address ? String(row.address) : undefined,
    addressLine1: row.address_line_1 ? String(row.address_line_1) : undefined,
    addressLine2: row.address_line_2 ? String(row.address_line_2) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    zip: row.zip ? String(row.zip) : undefined,
    transportService: Boolean(row.transport_service),
    durationMinutes: Number(row.duration_minutes || getService(String(row.service))?.durationMinutes || 60),
    status: row.status === 'cancelled' ? 'cancelled' : 'confirmed',
    cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : undefined,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

const insertBooking = database.prepare(`
  INSERT INTO bookings (
    id, name, email, service, date, time, address, address_line_1,
    address_line_2, city, state, zip, transport_service, notes, duration_minutes, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function insertBookingValues(booking: Booking) {
  return insertBooking.run(
    booking.id, booking.name, booking.email, booking.service, booking.date, booking.time,
    booking.address ?? null, booking.addressLine1 ?? null, booking.addressLine2 ?? null,
    booking.city ?? null, booking.state ?? null, booking.zip ?? null,
    booking.transportService ? 1 : 0, booking.notes ?? null, booking.durationMinutes, booking.status,
  );
}

function migrateJsonData() {
  const name = 'json-storage-v1';
  if (database.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name)) return;
  database.exec('BEGIN IMMEDIATE');
  try {
    try {
      const bookings = JSON.parse(readFileSync(join(serverDirectory, 'bookings.json'), 'utf8')) as Booking[];
      for (const booking of bookings) {
        try {
          insertBookingValues({
            ...booking,
            transportService: Boolean(booking.transportService),
            durationMinutes: booking.durationMinutes || getService(booking.service)?.durationMinutes || 60,
            status: booking.status || 'confirmed',
          });
        } catch { /* duplicate */ }
      }
    } catch { /* no legacy bookings */ }
    try {
      const blocked = JSON.parse(readFileSync(join(serverDirectory, 'availability.json'), 'utf8')) as Record<string, string[]>;
      const statement = database.prepare('INSERT OR IGNORE INTO blocked_times (date, time) VALUES (?, ?)');
      for (const [date, times] of Object.entries(blocked)) for (const time of times) statement.run(date, time);
    } catch { /* no legacy availability */ }
    database.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

migrateJsonData();

export async function readBookings(): Promise<Booking[]> {
  return (database.prepare('SELECT * FROM bookings ORDER BY date, time').all() as Record<string, unknown>[]).map(mapBooking);
}

export async function readBlockedTimesForDate(date: string): Promise<string[]> {
  return (database.prepare('SELECT time FROM blocked_times WHERE date = ? ORDER BY time').all(date) as Array<{ time: string }>).map((row) => row.time);
}

export async function setBlockedTime(date: string, time: string, blocked: boolean) {
  if (blocked) database.prepare('INSERT OR IGNORE INTO blocked_times (date, time) VALUES (?, ?)').run(date, time);
  else database.prepare('DELETE FROM blocked_times WHERE date = ? AND time = ?').run(date, time);
}

export async function createBookingRecord(booking: Booking): Promise<boolean> {
  database.exec('BEGIN IMMEDIATE');
  try {
    const requestedStart = timeToMinutes(booking.time);
    const requestedEnd = requestedStart + booking.durationMinutes;
    const blockedTimes = database.prepare('SELECT time FROM blocked_times WHERE date = ?').all(booking.date) as Array<{ time: string }>;
    const bookings = database.prepare("SELECT time, duration_minutes FROM bookings WHERE date = ? AND status = 'confirmed'").all(booking.date) as Array<{ time: string; duration_minutes: number }>;
    const overlapsBlocked = blockedTimes.some(({ time }) => {
      const start = timeToMinutes(time);
      return requestedStart < start + 60 && requestedEnd > start;
    });
    const overlapsBooking = bookings.some((existing) => {
      const start = timeToMinutes(existing.time);
      return requestedStart < start + existing.duration_minutes && requestedEnd > start;
    });
    if (overlapsBlocked || overlapsBooking) {
      database.exec('ROLLBACK');
      return false;
    }
    insertBookingValues(booking);
    database.exec('COMMIT');
    return true;
  } catch (error) {
    database.exec('ROLLBACK');
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return false;
    throw error;
  }
}

export async function cancelBookingRecord(id: string, reason: string): Promise<Booking | null> {
  const result = database.prepare(`
    UPDATE bookings
    SET status = 'cancelled', cancellation_reason = ?, cancelled_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'confirmed'
    RETURNING *
  `).get(reason, id) as Record<string, unknown> | undefined;
  return result ? mapBooking(result) : null;
}

export function checkDatabase() {
  database.prepare('SELECT 1').get();
  return true;
}

export function closeDatabase() {
  database.close();
}
