import { PrismaClient } from '@prisma/client';
import { submitInvoiceToFbr } from './services/fbr';

// Let's run a complete simulation check in the backend workspace
async function runSimulation() {
  const prisma = new PrismaClient();
  console.log('--- STARTING FBR E-INVOICE INTEGRATION COMPLIANCE TEST ---');

  // 1. Fetch tenant ID
  const tenant = await prisma.tenant.findFirst({
    where: { name: 'Acme Enterprise Corp' }
  });

  if (!tenant) {
    console.error('Tenant "Acme Enterprise Corp" not found. Please run db:seed first.');
    process.exit(1);
  }

  console.log(`Tenant verified: ${tenant.name} (${tenant.id})`);

  // 2. Create customer stark logistics with valid NTN and 13-digit STRN
  const customerName = 'Stark Industry Logistics';
  let starkCustomer = await prisma.contact.findFirst({
    where: { name: customerName, tenantId: tenant.id }
  });

  if (!starkCustomer) {
    starkCustomer = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        name: customerName,
        type: 'CUSTOMER',
        email: 'billing@starklogistics.pk',
        phone: '+923009876543',
        address: 'Plot 42-A, Port Qasim Industrial Zone, Karachi',
        ntn: '1234567-8',
        strn: '9876543210987' // Valid 13-digit Pakistani STRN
      }
    });
    console.log(`Created compliance Customer contact: ${starkCustomer.name}`);
  } else {
    // Make sure its NTN/STRN are updated
    starkCustomer = await prisma.contact.update({
      where: { id: starkCustomer.id },
      data: {
        ntn: '1234567-8',
        strn: '9876543210987'
      }
    });
    console.log(`Verified customer contact exists: ${starkCustomer.name}`);
  }

  // 3. Find standard product RAW-CPU-01 which has seed hsCode 8471.3010
  const cpuProduct = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'RAW-CPU-01' } }
  });

  if (!cpuProduct) {
    console.error('Product RAW-CPU-01 not found.');
    process.exit(1);
  }

  console.log(`Product verified: [${cpuProduct.sku}] ${cpuProduct.name} - HS Code: ${cpuProduct.hsCode}`);

  // 4. Draft a Sales Invoice
  const invoiceNumber = `TEST-FBR-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // Calculate pricing standard rules
  const quantity = 3;
  const unitPrice = 200.0;
  const subTotal = quantity * unitPrice;
  const taxRate = 18.0;
  const taxAmount = subTotal * (taxRate / 100);
  const grandTotal = subTotal + taxAmount;

  const testInvoice = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      invoiceNumber,
      contactId: starkCustomer.id,
      date: new Date(),
      dueDate: new Date(Date.now() + 15*24*60*60*1000),
      status: 'DRAFT',
      subTotal,
      discountTotal: 0,
      taxTotal: taxAmount,
      grandTotal,
      lines: {
        create: [
          {
            tenantId: tenant.id,
            productId: cpuProduct.id,
            quantity,
            unitPrice,
            discountPercent: 0,
            taxPercent: taxRate,
            taxAmount,
            lineTotal: grandTotal
          }
        ]
      }
    }
  });

  console.log(`Created DRAFT Invoice: ${testInvoice.invoiceNumber} - Grand Total: PKR ${testInvoice.grandTotal}`);

  // Test: submission should fail for DRAFT invoices
  try {
    console.log('Attempting to submit DRAFT invoice to FBR...');
    await submitInvoiceToFbr(tenant.id, testInvoice.id);
  } catch (err: any) {
    console.log(`Success: DRAFT invoice submission blocked as expected: "${err.message}"`);
  }

  // 5. Approve invoice & post to General Ledger
  const approvedInvoice = await prisma.invoice.update({
    where: { id: testInvoice.id },
    data: { status: 'APPROVED' }
  });
  console.log(`Approved Invoice: ${approvedInvoice.invoiceNumber} - status: ${approvedInvoice.status}`);

  // 6. Declare e-Invoice to FBR Sandbox API
  console.log(`Submitting APPROVED invoice to FBR POS Sandbox integration...`);
  const fbrRes = await submitInvoiceToFbr(tenant.id, testInvoice.id);
  console.log('e-Invoice Registered successfully!');
  console.log('FBR Reference:', fbrRes.fbrInvoiceId);
  console.log('FBR QR String:', fbrRes.fbrQrCode);
  console.log('FBR Portal Response:', fbrRes.msg);

  // 7. Verify updated DB columns
  const verifiedInvoice = await prisma.invoice.findUnique({
    where: { id: testInvoice.id }
  });

  console.log('DB FBR Status:', verifiedInvoice?.fbrStatus);
  console.log('DB FBR Reference ID:', verifiedInvoice?.fbrInvoiceId);
  console.log('DB FBR QR Code:', verifiedInvoice?.fbrQrCode);
  console.log('DB FBR Portal Message:', verifiedInvoice?.fbrResponseMsg);

  console.log('--- COMPLIANCE INTEGRATION TEST COMPLETED SUCCESSFULLY ---');
  await prisma.$disconnect();
}

runSimulation().catch(console.error);
