import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

interface ServiceRequest {
  name: string;
  email: string;
  service: string;
  notes?: string;
}

app.use(cors());
app.use(express.json());

app.post('/api/requests', (req: express.Request<{}, {}, ServiceRequest>, res: express.Response) => {
  const request = req.body;
  console.log('New service request:', request);
  res.status(201).json({ message: 'Request received', request });
});

app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
