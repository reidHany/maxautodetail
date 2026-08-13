"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readBookings = readBookings;
exports.readBlockedTimesForDate = readBlockedTimesForDate;
exports.setBlockedTime = setBlockedTime;
exports.createBookingRecord = createBookingRecord;
exports.cancelBookingRecord = cancelBookingRecord;
exports.checkDatabase = checkDatabase;
exports.closeDatabase = closeDatabase;
require("dotenv/config");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const serviceCatalog_1 = require("./serviceCatalog");
const serverDirectory = (0, node_path_1.join)(process.cwd(), 'server');
const databasePath = (0, node_path_1.resolve)(process.env.DATABASE_PATH || (0, node_path_1.join)(serverDirectory, 'bookings.sqlite'));
const database = new better_sqlite3_1.default(databasePath);
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
const bookingColumns = database.prepare('PRAGMA table_info(bookings)').all();
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
function mapBooking(row) {
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
        durationMinutes: Number(row.duration_minutes || (0, serviceCatalog_1.getService)(String(row.service))?.durationMinutes || 60),
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
function insertBookingValues(booking) {
    return insertBooking.run(booking.id, booking.name, booking.email, booking.service, booking.date, booking.time, booking.address ?? null, booking.addressLine1 ?? null, booking.addressLine2 ?? null, booking.city ?? null, booking.state ?? null, booking.zip ?? null, booking.transportService ? 1 : 0, booking.notes ?? null, booking.durationMinutes, booking.status);
}
function migrateJsonData() {
    const name = 'json-storage-v1';
    if (database.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name))
        return;
    database.exec('BEGIN IMMEDIATE');
    try {
        try {
            const bookings = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(serverDirectory, 'bookings.json'), 'utf8'));
            for (const booking of bookings) {
                try {
                    insertBookingValues({
                        ...booking,
                        transportService: Boolean(booking.transportService),
                        durationMinutes: booking.durationMinutes || (0, serviceCatalog_1.getService)(booking.service)?.durationMinutes || 60,
                        status: booking.status || 'confirmed',
                    });
                }
                catch { /* duplicate */ }
            }
        }
        catch { /* no legacy bookings */ }
        try {
            const blocked = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(serverDirectory, 'availability.json'), 'utf8'));
            const statement = database.prepare('INSERT OR IGNORE INTO blocked_times (date, time) VALUES (?, ?)');
            for (const [date, times] of Object.entries(blocked))
                for (const time of times)
                    statement.run(date, time);
        }
        catch { /* no legacy availability */ }
        database.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
        database.exec('COMMIT');
    }
    catch (error) {
        database.exec('ROLLBACK');
        throw error;
    }
}
migrateJsonData();
async function readBookings() {
    return database.prepare('SELECT * FROM bookings ORDER BY date, time').all().map(mapBooking);
}
async function readBlockedTimesForDate(date) {
    return database.prepare('SELECT time FROM blocked_times WHERE date = ? ORDER BY time').all(date).map((row) => row.time);
}
async function setBlockedTime(date, time, blocked) {
    if (blocked)
        database.prepare('INSERT OR IGNORE INTO blocked_times (date, time) VALUES (?, ?)').run(date, time);
    else
        database.prepare('DELETE FROM blocked_times WHERE date = ? AND time = ?').run(date, time);
}
async function createBookingRecord(booking) {
    database.exec('BEGIN IMMEDIATE');
    try {
        const requestedStart = (0, serviceCatalog_1.timeToMinutes)(booking.time);
        const requestedEnd = requestedStart + booking.durationMinutes;
        const blockedTimes = database.prepare('SELECT time FROM blocked_times WHERE date = ?').all(booking.date);
        const bookings = database.prepare("SELECT time, duration_minutes FROM bookings WHERE date = ? AND status = 'confirmed'").all(booking.date);
        const overlapsBlocked = blockedTimes.some(({ time }) => {
            const start = (0, serviceCatalog_1.timeToMinutes)(time);
            return requestedStart < start + 60 && requestedEnd > start;
        });
        const overlapsBooking = bookings.some((existing) => {
            const start = (0, serviceCatalog_1.timeToMinutes)(existing.time);
            return requestedStart < start + existing.duration_minutes && requestedEnd > start;
        });
        if (overlapsBlocked || overlapsBooking) {
            database.exec('ROLLBACK');
            return false;
        }
        insertBookingValues(booking);
        database.exec('COMMIT');
        return true;
    }
    catch (error) {
        database.exec('ROLLBACK');
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed'))
            return false;
        throw error;
    }
}
async function cancelBookingRecord(id, reason) {
    const result = database.prepare(`
    UPDATE bookings
    SET status = 'cancelled', cancellation_reason = ?, cancelled_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'confirmed'
    RETURNING *
  `).get(reason, id);
    return result ? mapBooking(result) : null;
}
function checkDatabase() {
    database.prepare('SELECT 1').get();
    return true;
}
function closeDatabase() {
    database.close();
}
