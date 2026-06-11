-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN "costCenter" TEXT;
ALTER TABLE "JournalLine" ADD COLUMN "projectCode" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BillLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "discountPercent" REAL NOT NULL DEFAULT 0.0,
    "taxPercent" REAL NOT NULL DEFAULT 0.0,
    "taxAmount" REAL NOT NULL DEFAULT 0.0,
    "whtAmount" REAL NOT NULL DEFAULT 0.0,
    "lineTotal" REAL NOT NULL DEFAULT 0.0,
    CONSTRAINT "BillLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BillLine" ("billId", "discountPercent", "id", "lineTotal", "productId", "quantity", "taxAmount", "taxPercent", "tenantId", "unitCost") SELECT "billId", "discountPercent", "id", "lineTotal", "productId", "quantity", "taxAmount", "taxPercent", "tenantId", "unitCost" FROM "BillLine";
DROP TABLE "BillLine";
ALTER TABLE "new_BillLine" RENAME TO "BillLine";
CREATE TABLE "new_InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discountPercent" REAL NOT NULL DEFAULT 0.0,
    "taxPercent" REAL NOT NULL DEFAULT 0.0,
    "taxAmount" REAL NOT NULL DEFAULT 0.0,
    "whtAmount" REAL NOT NULL DEFAULT 0.0,
    "lineTotal" REAL NOT NULL DEFAULT 0.0,
    CONSTRAINT "InvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceLine" ("discountPercent", "id", "invoiceId", "lineTotal", "productId", "quantity", "taxAmount", "taxPercent", "tenantId", "unitPrice") SELECT "discountPercent", "id", "invoiceId", "lineTotal", "productId", "quantity", "taxAmount", "taxPercent", "tenantId", "unitPrice" FROM "InvoiceLine";
DROP TABLE "InvoiceLine";
ALTER TABLE "new_InvoiceLine" RENAME TO "InvoiceLine";
CREATE TABLE "new_StockTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "remainingQty" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "warehouse" TEXT NOT NULL DEFAULT 'Main Warehouse',
    "batchNumber" TEXT,
    "mfgDate" DATETIME,
    "expiryDate" DATETIME,
    "landedCostAllocation" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StockTransaction" ("createdAt", "date", "id", "productId", "quantity", "referenceId", "referenceType", "remainingQty", "tenantId", "unitCost", "warehouse") SELECT "createdAt", "date", "id", "productId", "quantity", "referenceId", "referenceType", "remainingQty", "tenantId", "unitCost", "warehouse" FROM "StockTransaction";
DROP TABLE "StockTransaction";
ALTER TABLE "new_StockTransaction" RENAME TO "StockTransaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
