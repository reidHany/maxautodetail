"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = require("path");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const staticPath = (0, path_1.join)(process.cwd(), 'dist');
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.use(express_1.default.static(staticPath));
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.get('*', (_req, res) => {
    res.sendFile((0, path_1.join)(staticPath, 'index.html'));
});
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
