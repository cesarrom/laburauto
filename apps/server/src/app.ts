
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});



// Routes
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';
import bookingRoutes from './routes/bookings';
import notificationRoutes from './routes/notifications';
import uploadRoutes from './routes/upload';
import aiRoutes from './routes/ai';
import vehiclesDbRoutes from './routes/vehicles-db';
import navigationRoutes from './routes/navigation';
import applicationsRoutes from './routes/applications';
import renterDocumentsRoutes from './routes/renter-documents';
import publisherDocumentsRoutes from './routes/publisher-documents';
import paymentsRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import contractRoutes from './routes/contracts';
import auditRoutes from './routes/photo-audits';
import auditReportRoutes from './routes/audit-report';

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/vehicles-db', vehiclesDbRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/renter-documents', renterDocumentsRoutes);
app.use('/api/publisher-documents', publisherDocumentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/audit-report', auditReportRoutes);

app.get([/\/api\/files\/(.*)/, /\/api\/(uploads|private_documents|public_vehicles|contracts)\/(.*)/], (req, res) => {
  // If it matched the second regex, params[0] is the folder, params[1] is the file
  // If it matched the first regex, params[0] is the whole path
  const path = req.params[1] ? `${req.params[0]}/${req.params[1]}` : req.params[0];

  try {
    const { getSignedUrl } = require('./services/bytescale');
    const signedUrl = getSignedUrl('/' + path);
    res.redirect(signedUrl);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

export default app;
