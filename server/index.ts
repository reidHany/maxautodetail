import express from 'express';
import cors from 'cors';
import { join } from 'path';
import router from './routes';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const staticPath = join(process.cwd(), 'dist');

app.use(cors());
app.use(express.json());
app.use('/api', router);
app.use(express.static(staticPath));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (_req, res) => {
  res.sendFile(join(staticPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
