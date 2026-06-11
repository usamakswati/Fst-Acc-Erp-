import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import {
  BarChart3,
  Settings,
  Download,
  Printer,
  Search,
  Calendar,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Edit3,
  RefreshCw,
  FileText,
  ChevronRight,
  ChevronDown,
  BookOpen,
  FileSpreadsheet,
  Layers,
  Landmark,
  Scale,
  Receipt,
  Percent,
  ShieldAlert,
  Wrench,
  X,
  FileCheck,
  DollarSign
} from 'lucide-react';

interface ReportsHubProps {
  currency: string;
}

interface ColumnConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'uuid';
  visible: boolean;
  customLabel: string;
  voucherType?: 'invoice' | 'bill' | 'journal' | 'receipt' | 'payment';
}

interface ReportDefinition {
  id: string;
  name: string;
  endpoint: string;
  description: string;
  defaultColumns: ColumnConfig[];
}

interface ReportSection {
  title: string;
  icon: any;
  reports: ReportDefinition[];
}

export default function ReportsHub({ currency }: ReportsHubProps) {
  // --- Available Report Types Schema (21 Reports) ---
  const sections: ReportSection[] = useMemo(() => [
    {
      title: 'Financial & Management',
      icon: Scale,
      reports: [
        {
          id: 'profit-loss',
          name: 'Profit & Loss',
          endpoint: 'financial/profit-loss',
          description: 'Revenue, Cost of Sales, and Operating Expenses statements with gross/net profit margins.',
          defaultColumns: [
            { key: 'code', label: 'Account Code', type: 'text', visible: true, customLabel: 'Account Code' },
            { key: 'name', label: 'Account Name', type: 'text', visible: true, customLabel: 'Account Name' },
            { key: 'type', label: 'Type', type: 'text', visible: true, customLabel: 'Type' },
            { key: 'group', label: 'Group', type: 'text', visible: true, customLabel: 'Group' },
            { key: 'balance', label: 'Balance', type: 'currency', visible: true, customLabel: 'Balance' }
          ]
        },
        {
          id: 'balance-sheet',
          name: 'Balance Sheet',
          endpoint: 'financial/balance-sheet',
          description: 'Assets, Liabilities, and Equity balances with prior period comparisons.',
          defaultColumns: [
            { key: 'code', label: 'Account Code', type: 'text', visible: true, customLabel: 'Account Code' },
            { key: 'name', label: 'Account Name', type: 'text', visible: true, customLabel: 'Account Name' },
            { key: 'type', label: 'Type', type: 'text', visible: true, customLabel: 'Type' },
            { key: 'balance', label: 'Current Balance', type: 'currency', visible: true, customLabel: 'Current Balance' },
            { key: 'priorBalance', label: 'Prior Balance', type: 'currency', visible: true, customLabel: 'Prior Balance' },
            { key: 'variance', label: 'Variance', type: 'currency', visible: true, customLabel: 'Variance' },
            { key: 'variancePct', label: 'Variance %', type: 'percent', visible: true, customLabel: 'Variance %' }
          ]
        },
        {
          id: 'trial-balance',
          name: 'Trial Balance',
          endpoint: 'financial/trial-balance',
          description: 'Summarized opening balances, periodic movements, and closing positions.',
          defaultColumns: [
            { key: 'code', label: 'Account Code', type: 'text', visible: true, customLabel: 'Account Code' },
            { key: 'name', label: 'Account Name', type: 'text', visible: true, customLabel: 'Account Name' },
            { key: 'type', label: 'Type', type: 'text', visible: true, customLabel: 'Type' },
            { key: 'openingDebit', label: 'Opening Debit', type: 'currency', visible: true, customLabel: 'Opening Debit' },
            { key: 'openingCredit', label: 'Opening Credit', type: 'currency', visible: true, customLabel: 'Opening Credit' },
            { key: 'movementDebit', label: 'Movement Debit', type: 'currency', visible: true, customLabel: 'Movement Debit' },
            { key: 'movementCredit', label: 'Movement Credit', type: 'currency', visible: true, customLabel: 'Movement Credit' },
            { key: 'closingDebit', label: 'Closing Debit', type: 'currency', visible: true, customLabel: 'Closing Debit' },
            { key: 'closingCredit', label: 'Closing Credit', type: 'currency', visible: true, customLabel: 'Closing Credit' }
          ]
        },
        {
          id: 'general-ledger',
          name: 'General Ledger Detail',
          endpoint: 'financial/general-ledger',
          description: 'Granular chronological transaction ledger lines for a specific account.',
          defaultColumns: [
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'voucherNo', label: 'Voucher No', type: 'text', visible: true, customLabel: 'Voucher No' },
            { key: 'voucherId', label: 'Voucher UUID', type: 'uuid', voucherType: 'journal', visible: false, customLabel: 'Voucher UUID' },
            { key: 'accountCode', label: 'Account Code', type: 'text', visible: true, customLabel: 'Account Code' },
            { key: 'accountName', label: 'Account Name', type: 'text', visible: true, customLabel: 'Account Name' },
            { key: 'narration', label: 'Narration', type: 'text', visible: true, customLabel: 'Narration' },
            { key: 'debit', label: 'Debit', type: 'currency', visible: true, customLabel: 'Debit' },
            { key: 'credit', label: 'Credit', type: 'currency', visible: true, customLabel: 'Credit' },
            { key: 'runningBalance', label: 'Running Balance', type: 'currency', visible: true, customLabel: 'Running Balance' },
            { key: 'projectCode', label: 'Project Code', type: 'text', visible: true, customLabel: 'Project Code' },
            { key: 'costCenter', label: 'Cost Center', type: 'text', visible: true, customLabel: 'Cost Center' }
          ]
        }
      ]
    },
    {
      title: 'Sales & Accounts Receivable',
      icon: DollarSign,
      reports: [
        {
          id: 'sales-invoices',
          name: 'Sales Invoices Summaries',
          endpoint: 'sales/invoices',
          description: 'Summary and line details of customer sales invoices with region & rep attributes.',
          defaultColumns: [
            { key: 'invoiceNumber', label: 'Invoice No', type: 'text', visible: true, customLabel: 'Invoice No' },
            { key: 'id', label: 'Invoice UUID', type: 'uuid', voucherType: 'invoice', visible: false, customLabel: 'Invoice UUID' },
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'customerName', label: 'Customer Name', type: 'text', visible: true, customLabel: 'Customer' },
            { key: 'productSku', label: 'SKU', type: 'text', visible: true, customLabel: 'SKU' },
            { key: 'productName', label: 'Product Name', type: 'text', visible: true, customLabel: 'Product' },
            { key: 'quantity', label: 'Qty', type: 'number', visible: true, customLabel: 'Qty' },
            { key: 'unitPrice', label: 'Unit Price', type: 'currency', visible: true, customLabel: 'Unit Price' },
            { key: 'discount', label: 'Discount', type: 'currency', visible: true, customLabel: 'Discount' },
            { key: 'tax', label: 'Tax', type: 'currency', visible: true, customLabel: 'Tax' },
            { key: 'wht', label: 'WHT', type: 'currency', visible: true, customLabel: 'WHT' },
            { key: 'netTotal', label: 'Net Total', type: 'currency', visible: true, customLabel: 'Net Total' },
            { key: 'status', label: 'Status', type: 'text', visible: true, customLabel: 'Status' },
            { key: 'region', label: 'Region', type: 'text', visible: true, customLabel: 'Region' },
            { key: 'salesRep', label: 'Sales Rep', type: 'text', visible: true, customLabel: 'Sales Rep' }
          ]
        },
        {
          id: 'debtors-aging',
          name: 'Debtor Aging Buckets',
          endpoint: 'sales/debtors-aging',
          description: 'Outstanding customer receivables distributed into age brackets (0-30, 31-60, 61-90, 91+).',
          defaultColumns: [
            { key: 'customerName', label: 'Customer Name', type: 'text', visible: true, customLabel: 'Customer' },
            { key: 'bucket0_30', label: '0-30 Days', type: 'currency', visible: true, customLabel: '0-30 Days' },
            { key: 'bucket31_60', label: '31-60 Days', type: 'currency', visible: true, customLabel: '31-60 Days' },
            { key: 'bucket61_90', label: '61-90 Days', type: 'currency', visible: true, customLabel: '61-90 Days' },
            { key: 'bucket91_plus', label: '91+ Days', type: 'currency', visible: true, customLabel: '91+ Days' },
            { key: 'totalOutstanding', label: 'Total Outstanding', type: 'currency', visible: true, customLabel: 'Total Owed' }
          ]
        },
        {
          id: 'recovery',
          name: 'Sales Recovery Logs',
          endpoint: 'sales/recovery',
          description: 'Payment receipts logs, bank destination routing, and withholding tax (WHT) deductions.',
          defaultColumns: [
            { key: 'receiptNumber', label: 'Receipt No', type: 'text', visible: true, customLabel: 'Receipt No' },
            { key: 'id', label: 'Receipt UUID', type: 'uuid', voucherType: 'receipt', visible: false, customLabel: 'Receipt UUID' },
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'customerName', label: 'Customer Name', type: 'text', visible: true, customLabel: 'Customer' },
            { key: 'paymentMethod', label: 'Payment Method', type: 'text', visible: true, customLabel: 'Method' },
            { key: 'destinationAccount', label: 'Destination GL Account', type: 'text', visible: true, customLabel: 'Bank/Cash Account' },
            { key: 'reference', label: 'Reference', type: 'text', visible: true, customLabel: 'Ref No' },
            { key: 'narration', label: 'Narration', type: 'text', visible: true, customLabel: 'Narration' },
            { key: 'grossAmount', label: 'Gross Amount', type: 'currency', visible: true, customLabel: 'Gross Amount' },
            { key: 'whtAmount', label: 'WHT Deducted', type: 'currency', visible: true, customLabel: 'WHT' },
            { key: 'netReceived', label: 'Net Received', type: 'currency', visible: true, customLabel: 'Net Received' }
          ]
        },
        {
          id: 'customer-profitability',
          name: 'Customer Profitability',
          endpoint: 'sales/profitability',
          description: 'Gross profit margins and COGS calculations per customer profile.',
          defaultColumns: [
            { key: 'customerName', label: 'Customer Name', type: 'text', visible: true, customLabel: 'Customer' },
            { key: 'totalRevenue', label: 'Total Revenue', type: 'currency', visible: true, customLabel: 'Revenue' },
            { key: 'calculatedCogs', label: 'Calculated COGS', type: 'currency', visible: true, customLabel: 'COGS' },
            { key: 'grossMargin', label: 'Gross Margin', type: 'currency', visible: true, customLabel: 'Gross Margin' },
            { key: 'marginPercent', label: 'Margin %', type: 'percent', visible: true, customLabel: 'Margin %' }
          ]
        }
      ]
    },
    {
      title: 'Purchases & Accounts Payable',
      icon: Landmark,
      reports: [
        {
          id: 'supplier-bills',
          name: 'Supplier Bills & POs',
          endpoint: 'purchases/bills',
          description: 'Combined status list of supplier liabilities and purchase orders.',
          defaultColumns: [
            { key: 'docNumber', label: 'Document No', type: 'text', visible: true, customLabel: 'Doc No' },
            { key: 'id', label: 'Document UUID', type: 'uuid', voucherType: 'bill', visible: false, customLabel: 'Doc UUID' },
            { key: 'voucherType', label: 'Voucher Type', type: 'text', visible: true, customLabel: 'Voucher Type' },
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'supplierName', label: 'Supplier Name', type: 'text', visible: true, customLabel: 'Supplier' },
            { key: 'amount', label: 'Total Amount', type: 'currency', visible: true, customLabel: 'Amount' },
            { key: 'status', label: 'Status', type: 'text', visible: true, customLabel: 'Status' }
          ]
        },
        {
          id: 'creditors-aging',
          name: 'Creditor Aging Buckets',
          endpoint: 'purchases/creditors-aging',
          description: 'Aged supplier payables and aging allocations.',
          defaultColumns: [
            { key: 'supplierName', label: 'Supplier Name', type: 'text', visible: true, customLabel: 'Supplier' },
            { key: 'bucket0_30', label: '0-30 Days', type: 'currency', visible: true, customLabel: '0-30 Days' },
            { key: 'bucket31_60', label: '31-60 Days', type: 'currency', visible: true, customLabel: '31-60 Days' },
            { key: 'bucket61_90', label: '61-90 Days', type: 'currency', visible: true, customLabel: '61-90 Days' },
            { key: 'bucket91_plus', label: '91+ Days', type: 'currency', visible: true, customLabel: '91+ Days' },
            { key: 'totalOutstanding', label: 'Total Outstanding', type: 'currency', visible: true, customLabel: 'Total Payable' }
          ]
        },
        {
          id: 'payments-history',
          name: 'Payments & Advances History',
          endpoint: 'purchases/payments-history',
          description: 'Chronological payments history and auto-matched advance allocations.',
          defaultColumns: [
            { key: 'paymentNumber', label: 'Payment No', type: 'text', visible: true, customLabel: 'Payment No' },
            { key: 'id', label: 'Payment UUID', type: 'uuid', voucherType: 'payment', visible: false, customLabel: 'Payment UUID' },
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'supplierName', label: 'Supplier Name', type: 'text', visible: true, customLabel: 'Supplier' },
            { key: 'paymentMethod', label: 'Payment Method', type: 'text', visible: true, customLabel: 'Method' },
            { key: 'sourceAccount', label: 'Source GL Account', type: 'text', visible: true, customLabel: 'Source Bank/Cash' },
            { key: 'reference', label: 'Reference', type: 'text', visible: true, customLabel: 'Ref No' },
            { key: 'grossAmount', label: 'Gross Paid', type: 'currency', visible: true, customLabel: 'Gross Paid' },
            { key: 'allocatedAdvance', label: 'Allocated Advance', type: 'currency', visible: true, customLabel: 'Advance Portion' },
            { key: 'settledBillsLog', label: 'Settlement Log', type: 'text', visible: true, customLabel: 'Matching Details' }
          ]
        }
      ]
    },
    {
      title: 'Inventory & Valuation',
      icon: Layers,
      reports: [
        {
          id: 'stock-valuation',
          name: 'Stock Status & Valuation',
          endpoint: 'inventory/valuation',
          description: 'Real-time SKU quantities, low stock indicators, and comparative FIFO vs Average costing values.',
          defaultColumns: [
            { key: 'sku', label: 'SKU', type: 'text', visible: true, customLabel: 'SKU' },
            { key: 'name', label: 'Product Name', type: 'text', visible: true, customLabel: 'Product Name' },
            { key: 'quantityOnHand', label: 'Qty On Hand', type: 'number', visible: true, customLabel: 'Stock Qty' },
            { key: 'lowStockAlert', label: 'Stock Alert', type: 'text', visible: true, customLabel: 'Status' },
            { key: 'fifoCostValue', label: 'FIFO Valuation', type: 'currency', visible: true, customLabel: 'FIFO Val' },
            { key: 'averageCostValue', label: 'Average Valuation', type: 'currency', visible: true, customLabel: 'Avg Val' },
            { key: 'unitCostPrice', label: 'Unit Cost', type: 'currency', visible: true, customLabel: 'Unit Cost' },
            { key: 'packSize', label: 'Pack Size', type: 'text', visible: true, customLabel: 'Pack Size' },
            { key: 'hsCode', label: 'HS Code', type: 'text', visible: true, customLabel: 'HS Code' }
          ]
        },
        {
          id: 'movement-log',
          name: 'Stock Movement Log',
          endpoint: 'inventory/movement-log',
          description: 'Sequential ledger entries tracking stock movements from GRN to delivery notes.',
          defaultColumns: [
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'sku', label: 'SKU', type: 'text', visible: true, customLabel: 'SKU' },
            { key: 'productName', label: 'Product Name', type: 'text', visible: true, customLabel: 'Product Name' },
            { key: 'voucherType', label: 'Voucher Type', type: 'text', visible: true, customLabel: 'Voucher Type' },
            { key: 'voucherNumber', label: 'Voucher No', type: 'text', visible: true, customLabel: 'Voucher No' },
            { key: 'warehouse', label: 'Warehouse', type: 'text', visible: true, customLabel: 'Warehouse' },
            { key: 'inflowQty', label: 'Inflow Qty', type: 'number', visible: true, customLabel: 'Inflow Qty' },
            { key: 'outflowQty', label: 'Outflow Qty', type: 'number', visible: true, customLabel: 'Outflow Qty' },
            { key: 'runningStockBalance', label: 'Running Balance', type: 'number', visible: true, customLabel: 'Balance Qty' },
            { key: 'unitCost', label: 'Unit Cost', type: 'currency', visible: true, customLabel: 'Unit Cost' }
          ]
        },
        {
          id: 'batches-expiry',
          name: 'Batch & Expiry Monitor',
          endpoint: 'inventory/batches',
          description: 'Monitor batch numbers, manufacturing dates, and warnings for near-expiry stocks.',
          defaultColumns: [
            { key: 'batchNumber', label: 'Batch No', type: 'text', visible: true, customLabel: 'Batch No' },
            { key: 'sku', label: 'SKU', type: 'text', visible: true, customLabel: 'SKU' },
            { key: 'productName', label: 'Product Name', type: 'text', visible: true, customLabel: 'Product Name' },
            { key: 'quantity', label: 'Qty', type: 'number', visible: true, customLabel: 'Qty' },
            { key: 'manufacturingDate', label: 'Mfg Date', type: 'date', visible: true, customLabel: 'Mfg Date' },
            { key: 'expiryDate', label: 'Expiry Date', type: 'date', visible: true, customLabel: 'Expiry Date' },
            { key: 'daysToExpiry', label: 'Days to Expiry', type: 'number', visible: true, customLabel: 'Days to Exp' },
            { key: 'expiryStatus', label: 'Expiry Status', type: 'text', visible: true, customLabel: 'Status' },
            { key: 'warehouse', label: 'Warehouse', type: 'text', visible: true, customLabel: 'Warehouse' }
          ]
        },
        {
          id: 'landed-cost-allocation',
          name: 'Landed Cost allocation',
          endpoint: 'inventory/landed-cost',
          description: 'Landed cost allocation weights and margins adjusted by freight/duties expenses.',
          defaultColumns: [
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'sku', label: 'SKU', type: 'text', visible: true, customLabel: 'SKU' },
            { key: 'productName', label: 'Product Name', type: 'text', visible: true, customLabel: 'Product Name' },
            { key: 'warehouse', label: 'Warehouse', type: 'text', visible: true, customLabel: 'Warehouse' },
            { key: 'quantity', label: 'Quantity', type: 'number', visible: true, customLabel: 'Qty' },
            { key: 'purchaseUnitCost', label: 'Purchase Cost', type: 'currency', visible: true, customLabel: 'Purchase Cost' },
            { key: 'landedCostAllocated', label: 'Landed Cost Allocated', type: 'currency', visible: true, customLabel: 'Allocated Cost' },
            { key: 'totalLandedUnitCost', label: 'Total Landed Cost', type: 'currency', visible: true, customLabel: 'Landed Cost' },
            { key: 'referenceNumber', label: 'Reference No', type: 'text', visible: true, customLabel: 'Ref No' }
          ]
        }
      ]
    },
    {
      title: 'Manufacturing & Assemblies',
      icon: Wrench,
      reports: [
        {
          id: 'job-cost',
          name: 'Job Cost Summary',
          endpoint: 'manufacturing/job-cost',
          description: 'Finished products assembly job costs containing raw materials, labor, and overhead ratios.',
          defaultColumns: [
            { key: 'jobNo', label: 'Job No', type: 'text', visible: true, customLabel: 'Job No' },
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'finishedProductSku', label: 'Finished SKU', type: 'text', visible: true, customLabel: 'Finished SKU' },
            { key: 'finishedProductName', label: 'Finished Product Name', type: 'text', visible: true, customLabel: 'Finished Product' },
            { key: 'quantityProduced', label: 'Qty Produced', type: 'number', visible: true, customLabel: 'Qty Produced' },
            { key: 'rawMaterialCostAllocated', label: 'Raw Material Cost', type: 'currency', visible: true, customLabel: 'Material Cost' },
            { key: 'laborCostAllocated', label: 'Labor Cost', type: 'currency', visible: true, customLabel: 'Labor Cost' },
            { key: 'overheadCostAllocated', label: 'Overhead Cost', type: 'currency', visible: true, customLabel: 'Overhead Cost' },
            { key: 'totalJobCost', label: 'Total Job Cost', type: 'currency', visible: true, customLabel: 'Total Cost' },
            { key: 'status', label: 'Status', type: 'text', visible: true, customLabel: 'Status' }
          ]
        },
        {
          id: 'bom-variance',
          name: 'BOM Variance analysis',
          endpoint: 'manufacturing/variance',
          description: 'Variance logs reporting standard formula recipes vs actual consumption.',
          defaultColumns: [
            { key: 'jobNo', label: 'Job No', type: 'text', visible: true, customLabel: 'Job No' },
            { key: 'finishedProduct', label: 'Finished Product', type: 'text', visible: true, customLabel: 'Finished Product' },
            { key: 'rawMaterialSku', label: 'Raw Material SKU', type: 'text', visible: true, customLabel: 'Raw SKU' },
            { key: 'rawMaterialName', label: 'Raw Material Name', type: 'text', visible: true, customLabel: 'Raw Material' },
            { key: 'standardFormulaQty', label: 'Standard Qty', type: 'number', visible: true, customLabel: 'Standard Qty' },
            { key: 'actualConsumedQty', label: 'Actual Consumed', type: 'number', visible: true, customLabel: 'Actual Consumed' },
            { key: 'varianceQty', label: 'Variance Qty', type: 'number', visible: true, customLabel: 'Variance Qty' },
            { key: 'variancePercent', label: 'Variance %', type: 'percent', visible: true, customLabel: 'Variance %' }
          ]
        }
      ]
    },
    {
      title: 'Cash & Reconciliation',
      icon: BookOpen,
      reports: [
        {
          id: 'bank-activity',
          name: 'Bank Activity summaries',
          endpoint: 'cash-bank/activity',
          description: 'Flow analysis logs across petty cash, cash registers, and bank accounts.',
          defaultColumns: [
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'voucherNumber', label: 'Voucher No', type: 'text', visible: true, customLabel: 'Voucher No' },
            { key: 'accountCode', label: 'Account Code', type: 'text', visible: true, customLabel: 'Account Code' },
            { key: 'accountName', label: 'Account Name', type: 'text', visible: true, customLabel: 'Account Name' },
            { key: 'description', label: 'Description', type: 'text', visible: true, customLabel: 'Description' },
            { key: 'inflowAmount', label: 'Debit (Inflow)', type: 'currency', visible: true, customLabel: 'Debit (+)' },
            { key: 'outflowAmount', label: 'Credit (Outflow)', type: 'currency', visible: true, customLabel: 'Credit (-)' },
            { key: 'netImpact', label: 'Net Impact', type: 'currency', visible: true, customLabel: 'Net Impact' }
          ]
        },
        {
          id: 'bank-reconciliation-status',
          name: 'Bank Reconciliation status',
          endpoint: 'cash-bank/reconciliation',
          description: 'Overview of imported statement lines highlighting matched transactions vs deviations.',
          defaultColumns: [
            { key: 'statementFile', label: 'Statement File', type: 'text', visible: true, customLabel: 'Statement File' },
            { key: 'accountCode', label: 'Account Code', type: 'text', visible: true, customLabel: 'Account Code' },
            { key: 'accountName', label: 'Account Name', type: 'text', visible: true, customLabel: 'Account Name' },
            { key: 'txnDate', label: 'Txn Date', type: 'date', visible: true, customLabel: 'Txn Date' },
            { key: 'description', label: 'Description', type: 'text', visible: true, customLabel: 'Description' },
            { key: 'amount', label: 'Amount', type: 'currency', visible: true, customLabel: 'Amount' },
            { key: 'reconciliationStatus', label: 'Reconciliation Status', type: 'text', visible: true, customLabel: 'Status' },
            { key: 'matchedVoucherRef', label: 'Matched Voucher Ref', type: 'text', visible: true, customLabel: 'Matched Ref' }
          ]
        }
      ]
    },
    {
      title: 'Tax & Compliance',
      icon: ShieldAlert,
      reports: [
        {
          id: 'gst-register',
          name: 'Sales Tax / GST Register',
          endpoint: 'tax/gst',
          description: 'Sales values, NTN/STRN listings, tax rates, standard GST collected, and non-filer penalty increments.',
          defaultColumns: [
            { key: 'invoiceNumber', label: 'Invoice No', type: 'text', visible: true, customLabel: 'Invoice No' },
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'customerName', label: 'Customer Name', type: 'text', visible: true, customLabel: 'Customer' },
            { key: 'ntn', label: 'NTN', type: 'text', visible: true, customLabel: 'NTN' },
            { key: 'strn', label: 'STRN', type: 'text', visible: true, customLabel: 'STRN' },
            { key: 'hsCode', label: 'HS Code', type: 'text', visible: true, customLabel: 'HS Code' },
            { key: 'salesValueNet', label: 'Net Sales Value', type: 'currency', visible: true, customLabel: 'Net Value' },
            { key: 'taxRatePercent', label: 'Tax Rate %', type: 'percent', visible: true, customLabel: 'Rate %' },
            { key: 'gstTaxCollected', label: 'GST Tax Collected', type: 'currency', visible: true, customLabel: 'Standard GST' },
            { key: 'taxExemptedStatus', label: 'Exempt Status', type: 'text', visible: true, customLabel: 'Exempt/Taxable' },
            { key: 'additionalPenaltyTax', label: 'Penalty Tax', type: 'currency', visible: true, customLabel: 'Non-Filer Surcharge (3%)' },
            { key: 'totalAggregateGst', label: 'Total Aggregate GST', type: 'currency', visible: true, customLabel: 'Aggregate GST' }
          ]
        },
        {
          id: 'wht-summary',
          name: 'Withholding Tax Summary',
          endpoint: 'tax/wht',
          description: 'Transactional withholding tax logs withheld by clients or deducted from suppliers.',
          defaultColumns: [
            { key: 'date', label: 'Date', type: 'date', visible: true, customLabel: 'Date' },
            { key: 'documentNo', label: 'Document No', type: 'text', visible: true, customLabel: 'Document No' },
            { key: 'direction', label: 'Direction', type: 'text', visible: true, customLabel: 'Tax Direction' },
            { key: 'partyName', label: 'Party Name', type: 'text', visible: true, customLabel: 'Party Name' },
            { key: 'ntn', label: 'NTN', type: 'text', visible: true, customLabel: 'NTN' },
            { key: 'transactionGross', label: 'Gross Amount', type: 'currency', visible: true, customLabel: 'Gross Amount' },
            { key: 'whtDeducted', label: 'WHT Deducted', type: 'currency', visible: true, customLabel: 'WHT Deducted' },
            { key: 'settledNet', label: 'Settled Net Amount', type: 'currency', visible: true, customLabel: 'Net Settled' }
          ]
        }
      ]
    }
  ], []);

  // --- State Variables ---
  const [selectedReport, setSelectedReport] = useState<ReportDefinition>(sections[0].reports[0]);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [contactId, setContactId] = useState<string>('');
  const [projectCode, setProjectCode] = useState<string>('');
  const [costCenter, setCostCenter] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('');
  const [referenceDate, setReferenceDate] = useState<string>('');

  // Dropdown reference lists fetched on mount
  const [accounts, setAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Search & Sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Config UI visibility
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState('');

  // Drill-down Modal State
  const [drillDownType, setDrillDownType] = useState<'invoice' | 'bill' | 'journal' | 'receipt' | 'payment' | null>(null);
  const [drillDownId, setDrillDownId] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<any | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  // Sidebar expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Financial & Management': true,
    'Sales & Accounts Receivable': true
  });

  const printAreaRef = useRef<HTMLDivElement>(null);

  // --- Load Reference Lists ---
  useEffect(() => {
    async function loadRefs() {
      try {
        const [coaData, prodData, custData, suppData] = await Promise.all([
          api.getCoA().catch(() => ({ reportLines: [] })),
          api.getProducts().catch(() => []),
          api.getCustomers().catch(() => []),
          api.getSuppliers().catch(() => [])
        ]);
        setAccounts(coaData.reportLines || []);
        setProducts(prodData || []);
        setCustomers(custData || []);
        setSuppliers(suppData || []);
      } catch (err) {
        console.error('Error loading configuration references', err);
      }
    }
    loadRefs();
  }, []);

  // --- Load Persistent Column Config per Report ---
  useEffect(() => {
    const saved = localStorage.getItem(`bi_report_config_${selectedReport.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        // Sync just in case the original schema added/removed fields
        const merged = selectedReport.defaultColumns.map(def => {
          const match = parsed.find(p => p.key === def.key);
          return match ? { ...def, visible: match.visible, customLabel: match.customLabel } : def;
        });
        // Restore custom ordering from parsed arrays
        const ordered = [...merged].sort((a, b) => {
          const idxA = parsed.findIndex(p => p.key === a.key);
          const idxB = parsed.findIndex(p => p.key === b.key);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setColumnConfigs(ordered);
      } catch (e) {
        setColumnConfigs(selectedReport.defaultColumns);
      }
    } else {
      setColumnConfigs(selectedReport.defaultColumns);
    }
    // Reset filters
    setSearchTerm('');
    setSortColumn(null);
  }, [selectedReport]);

  // --- Fetch Report Data ---
  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (accountId) params.accountId = accountId;
      if (productId) params.productId = productId;
      if (contactId) params.contactId = contactId;
      if (projectCode) params.projectCode = projectCode;
      if (costCenter) params.costCenter = costCenter;
      if (warehouse) params.warehouse = warehouse;
      if (referenceDate) params.referenceDate = referenceDate;

      // Special parameters handling (e.g. balance sheet has asOfDate instead of toDate)
      if (selectedReport.id === 'balance-sheet') {
        if (toDate) params.asOfDate = toDate;
        if (fromDate) params.compareDate = fromDate;
      }
      if (selectedReport.id === 'debtors-aging' || selectedReport.id === 'creditors-aging') {
        if (toDate) params.referenceDate = toDate;
      }

      const res = await api.reports.getReportData(selectedReport.endpoint, params);
      
      // Some endpoints return reportLines directly, some wrap them in reportLines property
      if (res && Array.isArray(res)) {
        setReportData(res);
      } else if (res && Array.isArray(res.reportLines)) {
        setReportData(res.reportLines);
      } else {
        setReportData([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve report data');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch report on selected report change or manual filter apply
  useEffect(() => {
    fetchReport();
  }, [selectedReport]);

  // --- Dynamic Column Operations ---
  const toggleColumnVisibility = (key: string) => {
    const next = columnConfigs.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
    setColumnConfigs(next);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= columnConfigs.length) return;
    const next = [...columnConfigs];
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    setColumnConfigs(next);
  };

  const startRenameColumn = (key: string, currentLabel: string) => {
    setEditingColumnKey(key);
    setEditLabelText(currentLabel);
  };

  const saveRenameColumn = () => {
    if (!editingColumnKey) return;
    const next = columnConfigs.map(c => 
      c.key === editingColumnKey ? { ...c, customLabel: editLabelText || c.label } : c
    );
    setColumnConfigs(next);
    setEditingColumnKey(null);
  };

  const persistColumnConfigs = () => {
    localStorage.setItem(`bi_report_config_${selectedReport.id}`, JSON.stringify(columnConfigs));
    alert('Reporting columns layout configuration saved successfully!');
  };

  const resetColumnConfigs = () => {
    setColumnConfigs(selectedReport.defaultColumns);
    localStorage.removeItem(`bi_report_config_${selectedReport.id}`);
  };

  // --- Data Sorting & Local Filtering ---
  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const sortedAndFilteredData = useMemo(() => {
    let result = [...reportData];

    // Local Text Search
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(row => 
        Object.entries(row).some(([_, val]) => 
          String(val).toLowerCase().includes(lower)
        )
      );
    }

    // Grid Sorting
    if (sortColumn) {
      const config = columnConfigs.find(c => c.key === sortColumn);
      const isNum = config?.type === 'number' || config?.type === 'currency' || config?.type === 'percent';

      result.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (valA === undefined || valA === null) valA = isNum ? 0 : '';
        if (valB === undefined || valB === null) valB = isNum ? 0 : '';

        if (isNum) {
          return sortDirection === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        } else {
          return sortDirection === 'asc' 
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
        }
      });
    }

    return result;
  }, [reportData, searchTerm, sortColumn, sortDirection, columnConfigs]);

  // --- Export Helpers ---
  const handleCSVExport = () => {
    const visibleCols = columnConfigs.filter(c => c.visible);
    // Header Row
    const headerRow = visibleCols.map(c => `"${c.customLabel.replace(/"/g, '""')}"`).join(',');
    
    // Data Rows
    const dataRows = sortedAndFilteredData.map(row => 
      visibleCols.map(c => {
        let val = row[c.key];
        if (val === undefined || val === null) return '""';
        if (c.type === 'currency') return `"${Number(val).toFixed(2)}"`;
        if (c.type === 'percent') return `"${Number(val).toFixed(1)}%"`;
        if (c.type === 'date') return `"${new Date(val).toLocaleDateString()}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headerRow, ...dataRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedReport.id}_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // --- Voucher Drill-down Modal Actions ---
  const openDrillDown = async (id: string, type: 'invoice' | 'bill' | 'journal' | 'receipt' | 'payment') => {
    setDrillDownId(id);
    setDrillDownType(type);
    setDrillDownLoading(true);
    setDrillDownData(null);

    try {
      if (type === 'invoice') {
        const data = await api.getInvoice(id);
        setDrillDownData(data);
      } else if (type === 'bill') {
        const data = await api.getBill(id);
        setDrillDownData(data);
      } else if (type === 'journal') {
        // Since getJournalDetails isn't explicitly single-endpoint mapped, we search from getJournals list
        const list = await api.getJournals();
        const found = list.find((j: any) => j.id === id);
        setDrillDownData(found || null);
      } else if (type === 'receipt') {
        const list = await api.getReceipts();
        const found = list.find((j: any) => j.id === id);
        setDrillDownData(found || null);
      } else if (type === 'payment') {
        const list = await api.getPayments();
        const found = list.find((j: any) => j.id === id);
        setDrillDownData(found || null);
      }
    } catch (err) {
      console.error('Failed to load drill-down transaction', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const closeDrillDown = () => {
    setDrillDownId(null);
    setDrillDownType(null);
    setDrillDownData(null);
  };

  // --- Helper: Format Values in Grid ---
  const formatCellValue = (val: any, col: ColumnConfig) => {
    if (val === undefined || val === null) return '—';
    if (col.type === 'currency') {
      const num = Number(val);
      return isNaN(num) ? '—' : `${currency} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (col.type === 'percent') {
      const num = Number(val);
      return isNaN(num) ? '—' : `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
    }
    if (col.type === 'date') {
      return new Date(val).toLocaleDateString();
    }
    return String(val);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 relative">
      {/* Dynamic print-optimized style stylesheet injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
            background: transparent !important;
            color: #000 !important;
          }
          #print-area-wrapper, #print-area-wrapper * {
            visibility: visible;
          }
          #print-area-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* LEFT SIDEBAR: BI Navigation Category List */}
      <div className="w-full xl:w-72 shrink-0 bg-brand-950/80 border border-brand-800/40 rounded-2xl p-4 backdrop-blur-md no-print space-y-4">
        <div className="flex items-center gap-2 px-2 pb-2 border-b border-brand-800/40">
          <BarChart3 className="text-indigo-400" size={20} />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">BI Analytical Reports</h3>
        </div>
        <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
          {sections.map(section => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections[section.title];
            return (
              <div key={section.title} className="space-y-1">
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, [section.title]: !prev[section.title] }))}
                  className="w-full flex items-center justify-between text-left p-2 rounded-lg hover:bg-brand-900/30 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <SectionIcon size={14} className="text-indigo-400/80" />
                    <span>{section.title}</span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                </button>
                {isExpanded && (
                  <div className="pl-4 py-1 space-y-0.5 border-l border-brand-850/30 ml-3">
                    {section.reports.map(rep => {
                      const isSelected = selectedReport.id === rep.id;
                      return (
                        <button
                          key={rep.id}
                          onClick={() => setSelectedReport(rep)}
                          className={`w-full text-left p-2 rounded-md text-xs transition-all duration-150 ${
                            isSelected 
                              ? 'bg-indigo-650/25 text-indigo-300 font-semibold border-l-2 border-indigo-500' 
                              : 'text-slate-400 hover:bg-brand-900/20 hover:text-slate-200'
                          }`}
                        >
                          {rep.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTRAL AREA: BI Report Controls & Interactive Grid */}
      <div className="flex-1 flex flex-col gap-6" id="print-area-wrapper">
        {/* Header Summary */}
        <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black border border-indigo-500/20 uppercase tracking-widest no-print">
                BI Engine Active
              </span>
              <h2 className="text-xl font-bold text-slate-100">{selectedReport.name}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{selectedReport.description}</p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 no-print">
            <button 
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`p-2.5 rounded-lg border text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                showConfigPanel ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-brand-900/40 border-brand-800/40 hover:bg-brand-850/50'
              }`}
              title="Toggle Layout Customizer"
            >
              <Settings size={16} /> Column Layout
            </button>
            <button 
              onClick={handleCSVExport}
              disabled={loading || sortedAndFilteredData.length === 0}
              className="p-2.5 rounded-lg bg-brand-900/40 border border-brand-800/40 text-slate-300 hover:text-slate-100 hover:bg-brand-850/50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <Download size={16} /> Export CSV
            </button>
            <button 
              onClick={handlePrint}
              disabled={loading || sortedAndFilteredData.length === 0}
              className="p-2.5 rounded-lg bg-brand-900/40 border border-brand-800/40 text-slate-300 hover:text-slate-100 hover:bg-brand-850/50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer size={16} /> Print Report
            </button>
          </div>
        </div>

        {/* Dynamic BI Column configuration customizer panel */}
        {showConfigPanel && (
          <div className="glass-panel p-6 border-indigo-500/20 bg-brand-950/90 no-print space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center pb-2 border-b border-brand-800/40">
              <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                <Settings size={14} /> Customize Report Layout Fields
              </h4>
              <button 
                onClick={() => setShowConfigPanel(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Show or hide columns, customize header titles, and reorder grid displays. Settings apply immediately and can be persisted locally.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {columnConfigs.map((col, idx) => (
                <div key={col.key} className="p-3 bg-brand-900/25 border border-brand-850/40 rounded-lg flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <button 
                      onClick={() => toggleColumnVisibility(col.key)}
                      className={`p-1 rounded transition-colors ${col.visible ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 bg-brand-800/20'}`}
                      title={col.visible ? 'Hide Column' : 'Show Column'}
                    >
                      {col.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    
                    {editingColumnKey === col.key ? (
                      <input 
                        type="text"
                        value={editLabelText}
                        onChange={(e) => setEditLabelText(e.target.value)}
                        onBlur={saveRenameColumn}
                        onKeyDown={(e) => e.key === 'Enter' && saveRenameColumn()}
                        className="bg-brand-950 border border-indigo-500/40 text-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none w-28"
                        autoFocus
                      />
                    ) : (
                      <span 
                        onClick={() => startRenameColumn(col.key, col.customLabel)}
                        className="font-medium truncate text-slate-300 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
                        title="Click to rename header"
                      >
                        {col.customLabel} <Edit3 size={10} className="opacity-40" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => moveColumn(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-brand-800/30 disabled:opacity-20"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button 
                      onClick={() => moveColumn(idx, 'down')}
                      disabled={idx === columnConfigs.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-brand-800/30 disabled:opacity-20"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-brand-800/40">
              <button 
                onClick={resetColumnConfigs}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
              >
                Reset layout to Default
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={persistColumnConfigs}
                  className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5"
                >
                  <FileCheck size={14} /> Persist Layout Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOOLBAR: Dynamic Filtering & Local Searching */}
        <div className="glass-panel p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 no-print items-end">
          {/* SEARCH BAR (ALL REPORTS) */}
          <div className="space-y-1.5 sm:col-span-2 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search in Report Results</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input 
                type="text"
                placeholder="Type keywords to filter results..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-100 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500/60"
              />
            </div>
          </div>

          {/* DYNAMIC FILTERS TOOLBAR BASED ON THE SELECTED REPORT ENDPOINT */}
          {selectedReport.id !== 'debtors-aging' && selectedReport.id !== 'creditors-aging' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-500" size={14} />
                <input 
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-100 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500/60"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedReport.id === 'debtors-aging' || selectedReport.id === 'creditors-aging' ? 'As Of Date' : 'To Date'}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-500" size={14} />
              <input 
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-100 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-indigo-500/60"
              />
            </div>
          </div>

          {/* General Ledger: Select Account */}
          {selectedReport.id === 'general-ledger' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GL Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/60"
              >
                <option value="">Select Account...</option>
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sales or movement-log: Product selector */}
          {(selectedReport.id === 'sales-invoices' || selectedReport.id === 'movement-log') && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product SKU</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/60"
              >
                <option value="">Select Product...</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sales: Customer selector */}
          {selectedReport.id === 'sales-invoices' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Profile</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/60"
              >
                <option value="">Select Customer...</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Project codes (for profit-loss or general ledger) */}
          {(selectedReport.id === 'profit-loss' || selectedReport.id === 'general-ledger') && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Allocation</label>
                <select
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="">All Projects</option>
                  <option value="Project-Alpha">Project Alpha</option>
                  <option value="Project-Beta">Project Beta</option>
                  <option value="Karachi-Factory">Karachi Factory</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost Center</label>
                <select
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="">All Cost Centers</option>
                  <option value="Production-Dept">Production Dept</option>
                  <option value="Marketing-Dept">Marketing Dept</option>
                  <option value="HR-Management">HR Management</option>
                </select>
              </div>
            </>
          )}

          {/* Warehouse (for stock details/movement-log) */}
          {(selectedReport.id === 'stock-valuation' || selectedReport.id === 'movement-log' || selectedReport.id === 'batches-expiry' || selectedReport.id === 'landed-cost-allocation') && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warehouse Location</label>
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-full bg-brand-900/30 border border-brand-800/40 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none"
              >
                <option value="">All Warehouses</option>
                <option value="Karachi Central">Karachi Central Warehouse</option>
                <option value="Lahore Storage">Lahore Storage Hub</option>
                <option value="Rawalpindi Outlet">Rawalpindi Outlet Depot</option>
              </select>
            </div>
          )}

          {/* Trigger compilation */}
          <div className="shrink-0 flex">
            <button 
              onClick={fetchReport}
              disabled={loading}
              className="btn-primary w-full py-2 flex items-center justify-center gap-1.5 text-xs font-bold"
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Query BI Engine
            </button>
          </div>
        </div>

        {/* ERROR BOX */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-fadeIn">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* PRIMARY BI DATA GRID */}
        <div className="glass-panel overflow-hidden relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-brand-950/20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
              <p className="text-slate-400 text-sm font-medium">Compiling dynamic ledger metrics from transactional records...</p>
            </div>
          ) : sortedAndFilteredData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-brand-950/60 border-b border-brand-800/40 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {columnConfigs.filter(c => c.visible).map(col => (
                      <th 
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="p-4 cursor-pointer hover:bg-brand-900/40 transition-colors select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.customLabel}</span>
                          {sortColumn === col.key && (
                            sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-900/30">
                  {sortedAndFilteredData.map((row, rIdx) => (
                    <tr 
                      key={row.id || rIdx} 
                      className="hover:bg-brand-900/15 transition-all duration-150 interactive-tr"
                    >
                      {columnConfigs.filter(c => c.visible).map(col => {
                        const cellRawValue = row[col.key];
                        
                        // Treat columns as clickable hyperlinks if they contain voucher ID references or document numbers
                        const isDrillDownLink = 
                          (col.key === 'invoiceNumber' && row['id']) || 
                          (col.key === 'voucherNo' && row['voucherId']) ||
                          (col.key === 'docNumber' && row['id']) ||
                          (col.key === 'receiptNumber' && row['id']) ||
                          (col.key === 'paymentNumber' && row['id']);
                        
                        let targetVoucherType: any = null;
                        let drillId = row['id'] || row['voucherId'];
                        
                        if (isDrillDownLink) {
                          if (col.key === 'invoiceNumber') targetVoucherType = 'invoice';
                          else if (col.key === 'voucherNo') targetVoucherType = 'journal';
                          else if (col.key === 'docNumber') {
                            targetVoucherType = row['voucherType']?.includes('Order') ? 'invoice' : 'bill';
                          }
                          else if (col.key === 'receiptNumber') targetVoucherType = 'receipt';
                          else if (col.key === 'paymentNumber') targetVoucherType = 'payment';
                        }

                        return (
                          <td 
                            key={col.key} 
                            className={`p-4 font-medium ${
                              col.type === 'currency' || col.type === 'number' || col.type === 'percent' 
                                ? 'text-right font-mono' 
                                : 'text-slate-350'
                            }`}
                          >
                            {isDrillDownLink && drillId ? (
                              <button
                                onClick={() => openDrillDown(drillId, targetVoucherType)}
                                className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-all text-left block"
                              >
                                {formatCellValue(cellRawValue, col)}
                              </button>
                            ) : (
                              formatCellValue(cellRawValue, col)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 font-medium text-sm">
              No matching records compiled. Check filters or submit transactions to build reports.
            </div>
          )}
        </div>
      </div>

      {/* OVERLAY DRILL-DOWN MODAL: Renders transactional voucher detail */}
      {drillDownId && drillDownType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-brand-950 border border-brand-800/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-brand-800/40 bg-brand-900/20 flex justify-between items-center">
              <div>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black border border-indigo-500/20 uppercase tracking-widest">
                  Audit Trial Drill-down
                </span>
                <h3 className="text-sm font-bold text-slate-100 mt-1">Voucher Transaction Record</h3>
              </div>
              <button 
                onClick={closeDrillDown}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-brand-900/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drillDownLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
                  <p className="text-slate-400 text-xs">Querying tenant document ledger store...</p>
                </div>
              ) : drillDownData ? (
                <div className="space-y-6 text-sm text-slate-300">
                  {/* Common metadata block */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-brand-900/15 border border-brand-850/40 rounded-xl">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Document No</span>
                      <strong className="text-slate-200">
                        {drillDownData.invoiceNumber || drillDownData.billNumber || drillDownData.reference || drillDownData.receiptNumber || drillDownData.paymentNumber || 'None'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Transaction Date</span>
                      <strong className="text-slate-200">{new Date(drillDownData.date).toLocaleDateString()}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Party / Contact</span>
                      <strong className="text-slate-200">{drillDownData.contact?.name || 'Manual GL Entry'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">GL Status</span>
                      <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        drillDownData.status === 'APPROVED' || drillDownData.status === 'PAID'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-amber-400 bg-amber-500/10'
                      }`}>
                        {drillDownData.status || 'POSTED'}
                      </span>
                    </div>
                  </div>

                  {/* Narration/Memo */}
                  {drillDownData.narration && (
                    <div className="p-3 bg-brand-900/10 rounded-lg border border-brand-900/20 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Narration/Memo</span>
                      <p className="text-slate-300 italic">"{drillDownData.narration}"</p>
                    </div>
                  )}

                  {/* Item lines table for sales invoices or bills */}
                  {drillDownType === 'invoice' || drillDownType === 'bill' ? (
                    <div className="border border-brand-850/40 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-brand-900/35 border-b border-brand-850/30 text-slate-400 font-bold uppercase">
                          <tr>
                            <th className="p-3">Product SKU</th>
                            <th className="p-3">Quantity</th>
                            <th className="p-3 text-right">Unit Price</th>
                            <th className="p-3 text-right">Discount</th>
                            <th className="p-3 text-right">Tax</th>
                            <th className="p-3 text-right">Net Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-900/20">
                          {drillDownData.lines?.map((line: any) => (
                            <tr key={line.id}>
                              <td className="p-3 font-semibold text-slate-200">{line.product?.sku || 'Item'}</td>
                              <td className="p-3">{line.quantity}</td>
                              <td className="p-3 text-right font-mono">{currency} {line.unitPrice.toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">
                                {line.discountPercent ? `${line.discountPercent}%` : '—'}
                              </td>
                              <td className="p-3 text-right font-mono">{currency} {line.taxAmount.toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">{currency} {line.lineTotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-brand-900/20 border-t border-brand-850/30 font-bold text-slate-200">
                          <tr>
                            <td colSpan={5} className="p-3 text-right uppercase text-[10px] text-slate-400">Grand aggregate total</td>
                            <td className="p-3 text-right font-mono text-indigo-400">
                              {currency} {drillDownData.grandTotal.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : null}

                  {/* Journal lines (Double entry format) */}
                  {drillDownType === 'journal' ? (
                    <div className="border border-brand-850/40 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-brand-900/35 border-b border-brand-850/30 text-slate-400 font-bold uppercase">
                          <tr>
                            <th className="p-3">Account Code</th>
                            <th className="p-3">Account Name</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Debit</th>
                            <th className="p-3 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-900/20">
                          {drillDownData.lines?.map((line: any) => (
                            <tr key={line.id}>
                              <td className="p-3 font-semibold text-slate-200">{line.account?.code}</td>
                              <td className="p-3">{line.account?.name}</td>
                              <td className="p-3 italic text-slate-400">{line.narration || '—'}</td>
                              <td className="p-3 text-right font-mono text-emerald-400">
                                {line.debit > 0 ? `${currency} ${line.debit.toFixed(2)}` : '—'}
                              </td>
                              <td className="p-3 text-right font-mono text-rose-400">
                                {line.credit > 0 ? `${currency} ${line.credit.toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {/* Cash recovery receipts details */}
                  {drillDownType === 'receipt' || drillDownType === 'payment' ? (
                    <div className="border border-brand-850/40 rounded-xl overflow-hidden p-4 space-y-4">
                      <div className="flex justify-between items-center bg-brand-900/20 p-3 rounded-lg border border-brand-800/30">
                        <span className="text-xs text-slate-400 font-semibold uppercase">Total Amount Settled</span>
                        <strong className="text-lg text-indigo-400 font-mono">
                          {currency} {drillDownData.amount?.toFixed(2)}
                        </strong>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Settlement Method</span>
                          <span className="text-slate-300 font-semibold">{drillDownData.paymentMethod || 'Cash/Cheque'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Reference/Cheque No</span>
                          <span className="text-slate-300 font-semibold">{drillDownData.reference || 'None'}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Voucher record details could not be compiled.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-brand-800/40 bg-brand-900/10 flex justify-end">
              <button 
                onClick={closeDrillDown}
                className="btn-secondary py-1.5 px-4 text-xs font-semibold"
              >
                Close Audit Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
