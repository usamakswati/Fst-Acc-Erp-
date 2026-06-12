import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

// Import routers
import authRouter from './routes/auth';
import coaRouter from './routes/coa';
import journalsRouter from './routes/journals';
import invoicesRouter from './routes/invoices';
import billsRouter from './routes/bills';
import inventoryRouter from './routes/inventory';
import stockTransfersRouter from './routes/stockTransfers';
import manufacturingRouter from './routes/manufacturing';
import bankReconciliationRouter from './routes/bankReconciliation';
import ordersRouter from './routes/orders';
import receiptsRouter from './routes/receipts';
import chequesRouter from './routes/cheques';
import customersRouter from './routes/customers';
import purchaseOrdersRouter from './routes/purchaseOrders';
import paymentsRouter from './routes/payments';
import vendorChequesRouter from './routes/vendorCheques';
import suppliersRouter from './routes/suppliers';
import reportsRouter from './routes/reports';
import superadminRouter from './routes/superadmin';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend accessibility
app.use(cors({
  origin: '*', // Allow all origins for dev/testing ease
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/coa', coaRouter);
app.use('/api/journals', journalsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/bills', billsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/inventory/transfers', stockTransfersRouter);
app.use('/api/manufacturing', manufacturingRouter);
app.use('/api/bank-reconciliation', bankReconciliationRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/cheques', chequesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/vendor-cheques', vendorChequesRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/superadmin', superadminRouter);

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global error handler middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error occurred',
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`  Buraq Cloud SaaS ERP Backend Running!          `);
  console.log(`  Port: ${PORT}                                  `);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'} `);
  console.log(`=================================================`);
});
