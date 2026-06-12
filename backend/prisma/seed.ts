import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seeding default Super Admin User
  const superadminEmail = 'superadmin@buraq.cloud';
  let superuser = await prisma.superUser.findUnique({
    where: { email: superadminEmail },
  });

  if (!superuser) {
    const passwordHash = bcrypt.hashSync('superadmin123', 10);
    superuser = await prisma.superUser.create({
      data: {
        email: superadminEmail,
        passwordHash,
        name: 'Master Super Admin',
      },
    });
    console.log(`Created default SuperAdmin: ${superuser.email}`);
  } else {
    console.log(`SuperAdmin already exists: ${superuser.email}`);
  }

  // 1. Create Tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: 'Acme Enterprise Corp' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Acme Enterprise Corp',
        subscriptionTier: 'ENTERPRISE',
        currency: 'PKR',
        taxRate: 18.0, // 18% standard tax
        subscription: {
          create: {
            status: 'ACTIVE',
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            moduleAccounts: true,
            moduleManufacturing: true,
            moduleInventory: true,
            moduleSales: true,
          }
        }
      },
    });
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  } else {
    // Dynamically update existing tenant to use PKR and 18% GST
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        currency: 'PKR',
        taxRate: 18.0,
      },
    });
    console.log(`Updated existing tenant: ${tenant.name} to PKR / 18% GST`);

    // Ensure existing tenant has a subscription
    const existingSub = await prisma.tenantSubscription.findUnique({
      where: { tenantId: tenant.id }
    });
    if (!existingSub) {
      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          moduleAccounts: true,
          moduleManufacturing: true,
          moduleInventory: true,
          moduleSales: true,
        }
      });
      console.log(`Created default subscription for existing tenant: ${tenant.name}`);
    }
  }

  // 2. Create Admin User
  const adminEmail = 'admin@acme.com';
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!adminUser) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Admin User',
        role: 'ADMIN',
        tenantId: tenant.id,
      },
    });
    console.log(`Created admin user: ${adminUser.email}`);
  } else {
    console.log(`Admin user exists: ${adminUser.email}`);
  }

  // 3. Create Standard Chart of Accounts
  const standardAccounts = [
    // Assets
    { code: '10100', name: 'Cash in Hand', type: 'ASSET' },
    { code: '10200', name: 'Bank Current Account', type: 'ASSET' },
    { code: '12100', name: 'Accounts Receivable (AR)', type: 'ASSET' },
    { code: '13100', name: 'Inventory (Stock Asset)', type: 'ASSET' },
    // Liabilities
    { code: '20100', name: 'Accounts Payable (AP)', type: 'LIABILITY' },
    { code: '21100', name: 'Tax Payable (GST/VAT)', type: 'LIABILITY' },
    // Equity
    { code: '30100', name: 'Share Capital', type: 'EQUITY' },
    { code: '30200', name: 'Retained Earnings', type: 'EQUITY' },
    // Revenue
    { code: '40100', name: 'Sales Revenue', type: 'REVENUE' },
    // Expenses
    { code: '50100', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE' },
    { code: '50200', name: 'Direct Labor Expense', type: 'EXPENSE' },
    { code: '50300', name: 'Manufacturing Overheads', type: 'EXPENSE' },
    { code: '50400', name: 'General & Administrative Expense', type: 'EXPENSE' },
  ];

  for (const acc of standardAccounts) {
    const existing = await prisma.account.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: acc.code,
        },
      },
    });

    if (!existing) {
      await prisma.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          tenantId: tenant.id,
        },
      });
      console.log(`Created Account: [${acc.code}] ${acc.name}`);
    }
  }

  // 4. Create Standard Contacts
  const contacts = [
    { name: 'Global Tech Distributors', type: 'CUSTOMER', email: 'billing@globaltech.com', phone: '+923001234567', address: 'Plot 42, Sector G-9, Islamabad', ntn: '1234567-1', strn: '1234567890121' },
    { name: 'Silicon Components Inc', type: 'SUPPLIER', email: 'sales@siliconcomp.com', phone: '+923331122334', address: 'Street 4, I-9 Industrial Area, Islamabad', ntn: '7654321-2', strn: '9876543210982' },
    { name: 'Stark Logistics', type: 'BOTH', email: 'info@starklog.com', phone: '+923219876543', address: 'Logistics House, Port Qasim, Karachi', ntn: '8888888-8', strn: '1111222233334' }
  ];

  for (const c of contacts) {
    const existing = await prisma.contact.findFirst({
      where: {
        tenantId: tenant.id,
        name: c.name,
      },
    });

    if (!existing) {
      await prisma.contact.create({
        data: {
          ...c,
          tenantId: tenant.id,
        },
      });
      console.log(`Created Contact: ${c.name} (${c.type})`);
    }
  }

  // 5. Create Default Products
  const products = [
    { sku: 'RAW-CPU-01', name: 'Intel i7 CPU Processor', type: 'STOCK', salesPrice: 250.0, costPrice: 150.0, inventoryValuationMethod: 'FIFO', packSize: 'Tray of 10', hsCode: '8471.3010' },
    { sku: 'RAW-RAM-08', name: 'DDR4 8GB RAM Module', type: 'STOCK', salesPrice: 60.0, costPrice: 35.0, inventoryValuationMethod: 'FIFO', packSize: 'Box of 20', hsCode: '8473.3000' },
    { sku: 'RAW-CHA-01', name: 'ATX Computer Case Chassis', type: 'STOCK', salesPrice: 80.0, costPrice: 40.0, inventoryValuationMethod: 'WEIGHTED_AVERAGE', packSize: 'Single', hsCode: '8473.3000' },
    { sku: 'FG-DESK-01', name: 'Standard Business Desktop PC', type: 'STOCK', salesPrice: 650.0, costPrice: 225.0, inventoryValuationMethod: 'FIFO', packSize: 'Single', hsCode: '8471.4110' },
    { sku: 'SRV-ASSY-01', name: 'Standard Desktop Assembling Labor', type: 'SERVICE', salesPrice: 50.0, costPrice: 0.0, inventoryValuationMethod: 'FIFO', packSize: 'Hour', hsCode: '9801.0000' }
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({
      where: {
        tenantId_sku: {
          tenantId: tenant.id,
          sku: p.sku,
        },
      },
    });

    if (!existing) {
      const createdProduct = await prisma.product.create({
        data: {
          ...p,
          tenantId: tenant.id,
        },
      });
      console.log(`Created Product: [${p.sku}] ${p.name}`);

      // Seed initial stock transactions for RAW materials so users can run production immediately
      if (p.type === 'STOCK' && p.sku.startsWith('RAW-')) {
        await prisma.stockTransaction.create({
          data: {
            tenantId: tenant.id,
            productId: createdProduct.id,
            quantity: 50, // 50 items opening stock
            unitCost: p.costPrice,
            remainingQty: 50,
            referenceType: 'INITIAL_STOCK',
            referenceId: 'OPENING_BAL',
          },
        });
        console.log(`Seeded 50 units of opening stock for SKU: ${p.sku}`);
      }
    }
  }

  // 6. Seed a default Bill of Materials (BOM) for finished product
  const finishedProduct = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'FG-DESK-01' } },
  });
  const cpuItem = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'RAW-CPU-01' } },
  });
  const ramItem = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'RAW-RAM-08' } },
  });
  const chassisItem = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'RAW-CHA-01' } },
  });

  if (finishedProduct && cpuItem && ramItem && chassisItem) {
    const existingBOM = await prisma.billOfMaterials.findFirst({
      where: {
        tenantId: tenant.id,
        finishedProductId: finishedProduct.id,
      },
    });

    if (!existingBOM) {
      await prisma.billOfMaterials.create({
        data: {
          tenantId: tenant.id,
          finishedProductId: finishedProduct.id,
          name: 'Standard PC Assembly BOM',
          laborCost: 30.0, // Labor assembly fee
          overheadCost: 15.0, // Overhead charging
          items: {
            create: [
              { tenantId: tenant.id, rawProductId: cpuItem.id, quantity: 1.0 }, // 1 CPU
              { tenantId: tenant.id, rawProductId: ramItem.id, quantity: 2.0 }, // 2 RAM modules (16GB)
              { tenantId: tenant.id, rawProductId: chassisItem.id, quantity: 1.0 }, // 1 Case chassis
            ],
          },
        },
      });
      console.log('Created standard Bill of Materials (BOM) for Finished Desktop PC');
    }
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
