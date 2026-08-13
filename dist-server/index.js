"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = require("express-rate-limit");
const path_1 = require("path");
const routes_1 = __importDefault(require("./routes"));
const storage_1 = require("./storage");
const app = (0, express_1.default)();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const staticPath = (0, path_1.join)(process.cwd(), 'dist');
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production') {
    const required = ['ADMIN_PASSWORD', 'RESEND_API_KEY', 'SENDER_EMAIL', 'ALLOWED_ORIGINS'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length)
        throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
    if (process.env.SENDER_EMAIL === 'onboarding@resend.dev') {
        console.warn('SENDER_EMAIL is using Resend onboarding mode. Email delivery is limited to the address associated with the Resend account until a custom domain is verified.');
    }
}
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
    },
}));
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin))
            return callback(null, true);
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '32kb' }));
app.use('/api', (0, express_rate_limit_1.rateLimit)({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', routes_1.default);
app.use(express_1.default.static(staticPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    setHeaders(res, filePath) {
        // Vite's hashed bundles can be cached permanently. Sequence frames keep a
        // shorter cache lifetime because their filenames are intentionally stable.
        if (process.env.NODE_ENV === 'production' && filePath.includes(`${(0, path_1.join)('dist', 'assets')}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));
app.get('/api/health', (_req, res) => {
    try {
        (0, storage_1.checkDatabase)();
        res.json({ status: 'ok', database: 'ok' });
    }
    catch {
        res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
});
app.get('*', (_req, res) => {
    res.sendFile((0, path_1.join)(staticPath, 'index.html'));
});
app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: 'An unexpected server error occurred.' });
});
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
