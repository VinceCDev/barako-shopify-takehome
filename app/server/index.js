import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './auth.js';
import { verifyRequest } from './verifyRequest.js';
import { dashboardRouter } from './routes/dashboard.js';
import { inventoryRouter } from './routes/inventory.js';
import { customersRouter } from './routes/customers.js';
import { ordersRouter } from './routes/orders.js';
import { activityRouter } from './routes/activity.js';
import { syncRouter } from './routes/sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Unauthenticated: the OAuth handshake itself (a merchant can't have a
// session token yet if they're still authenticating).
app.use(authRouter);

// Everything under /api (except /api/auth/*) requires a valid App Bridge
// session token — see verifyRequest.js.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) {
    next();
    return;
  }
  verifyRequest(req, res, next);
});
app.use(dashboardRouter);
app.use(inventoryRouter);
app.use(customersRouter);
app.use(ordersRouter);
app.use(activityRouter);
app.use(syncRouter);

// Serves the built Vite frontend in production. In development, run the
// Vite dev server separately (see client/package.json) and it'll proxy
// /api requests here — see client/vite.config.js.
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Barako Merchant Tools server listening on port ${PORT}`);
});
