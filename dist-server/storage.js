"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readBookings = readBookings;
exports.writeBookings = writeBookings;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const dataFile = (0, path_1.join)(process.cwd(), 'server', 'bookings.json');
async function readBookings() {
    try {
        const raw = await (0, promises_1.readFile)(dataFile, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        await (0, promises_1.writeFile)(dataFile, '[]', 'utf8');
        return [];
    }
}
async function writeBookings(bookings) {
    await (0, promises_1.writeFile)(dataFile, JSON.stringify(bookings, null, 2), 'utf8');
}
