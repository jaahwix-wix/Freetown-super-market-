'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import { formatLeones } from '@/lib/catalog-seed';
import type {
  InventoryLogRecord,
  OrderItemRecord,
  OrderRecord,
  Product,
} from '@/lib/types';

export type PrintJob =
  | {
      type: 'inventory';
      products: Product[];
      generatedAt: string;
      adminEmail: string;
    }
  | {
      type: 'order_invoice';
      order: OrderRecord;
      items: OrderItemRecord[];
      generatedAt: string;
      adminEmail: string;
    }
  | {
      type: 'orders_manifest';
      orders: OrderRecord[];
      generatedAt: string;
      adminEmail: string;
    }
  | {
      type: 'audit_log';
      logs: InventoryLogRecord[];
      generatedAt: string;
      adminEmail: string;
    };

interface PrintSheetModalProps {
  job: PrintJob | null;
  onClose: () => void;
}

export function PrintSheetModal({ job, onClose }: PrintSheetModalProps) {
  if (!job) return null;

  const title =
    job.type === 'inventory'
      ? 'Inventory Stock Sheet'
      : job.type === 'order_invoice'
        ? `Order Invoice & Packing Slip · ${job.order.orderNumber}`
        : job.type === 'orders_manifest'
          ? 'Order Fulfillment Manifest'
          : 'Stock Movement Audit Report';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 print:static print:inset-auto print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-4xl bg-white border border-[#DCE1DD] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print-only-sheet">
        {/* Modal Chrome (hidden when printing) */}
        <div className="no-print px-6 py-4 border-b border-[#E3E7E4] bg-[#F8F9F8] flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#156145]">
              Administrator Print Preview
            </p>
            <h2 className="font-display text-base font-bold text-[#141715]">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close print preview"
              className="p-2 rounded-md text-[#4F5852] hover:bg-[#EAECEB] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-white text-[#141715] space-y-6 print:overflow-visible print:p-0">
          <div className="border-b-2 border-[#156145] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#156145]">
                Freetown Supermarket · Wilkinson Road, Freetown
              </p>
              <h1 className="font-display text-2xl font-bold text-[#141715] mt-1">
                {title}
              </h1>
            </div>
            <div className="text-xs text-[#4F5852] sm:text-right font-mono">
              <p>Generated: {job.generatedAt}</p>
              <p>Authorized Admin: {job.adminEmail}</p>
            </div>
          </div>

          {job.type === 'inventory' && (
            <>
              <div className="grid grid-cols-3 gap-4 border border-[#E3E7E4] rounded-md p-4 bg-[#F8F9F8] text-xs">
                <div>
                  <p className="text-[#5B655E]">Total SKUs</p>
                  <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                    {job.products.length}
                  </p>
                </div>
                <div>
                  <p className="text-[#5B655E]">Total Shelf Units</p>
                  <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                    {job.products.reduce((s, p) => s + Math.max(0, p.stockQuantity), 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[#5B655E]">Low / Out of Stock</p>
                  <p className="font-mono text-base font-bold tabular-nums mt-0.5">
                    {
                      job.products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
                        .length
                    }
                  </p>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#141715] text-[#141715] font-semibold">
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 pr-3 text-right">Stock</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7E4]">
                  {job.products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-mono">{p.sku}</td>
                      <td className="py-2 pr-3 font-medium">
                        {p.name} ({p.unit})
                      </td>
                      <td className="py-2 pr-3 text-[#4F5852]">{p.category}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {formatLeones(p.price)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-bold tabular-nums">
                        {p.stockQuantity}
                      </td>
                      <td className="py-2 text-right">
                        {!p.active
                          ? 'Removed'
                          : p.stockQuantity <= 0
                            ? 'Out of Stock'
                            : p.stockQuantity <= p.lowStockThreshold
                              ? 'Low Stock'
                              : 'In Stock'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {job.type === 'order_invoice' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-[#E3E7E4] rounded-md p-4 bg-[#F8F9F8] text-xs">
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[#5B655E]">
                    Customer & Delivery
                  </p>
                  <p className="font-semibold text-sm text-[#141715]">
                    {job.order.customerName}
                  </p>
                  <p>{job.order.customerEmail}</p>
                  <p className="font-mono">{job.order.customerPhone}</p>
                  <p>
                    {job.order.deliveryZone} — {job.order.deliveryAddress}
                  </p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="font-bold uppercase tracking-wider text-[#5B655E]">
                    Payment & Status
                  </p>
                  <p className="font-mono font-semibold text-sm">
                    {job.order.orderNumber}
                  </p>
                  <p className="font-mono">Ref: {job.order.paymentReference}</p>
                  <p className="uppercase">
                    {job.order.paymentMethod.replace('_', ' ')} (
                    {job.order.paymentStatus === 'paid' ? 'PAID' : 'COD PENDING'})
                  </p>
                  <p className="capitalize font-semibold">
                    Status: {job.order.status.replaceAll('_', ' ')}
                  </p>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#141715] font-semibold">
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3 text-right">Unit Price</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7E4]">
                  {job.items.length > 0 ? (
                    job.items.map((item) => (
                      <tr key={item.productId}>
                        <td className="py-2.5 pr-3 font-mono">{item.sku}</td>
                        <td className="py-2.5 pr-3 font-medium">
                          {item.name} ({item.unit})
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                          {formatLeones(item.unitPrice)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold tabular-nums">
                          {formatLeones(item.lineTotal)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-3 text-[#4F5852]">
                        {job.order.itemsSummary}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="border-t border-[#141715] pt-3 flex flex-col items-end space-y-1 text-xs">
                <p>
                  Subtotal:{' '}
                  <strong className="font-mono tabular-nums ml-3">
                    {formatLeones(job.order.subtotal)}
                  </strong>
                </p>
                <p>
                  Delivery Fee:{' '}
                  <strong className="font-mono tabular-nums ml-3">
                    {job.order.deliveryFee === 0
                      ? 'Free'
                      : formatLeones(job.order.deliveryFee)}
                  </strong>
                </p>
                <p className="text-base font-bold text-[#156145] pt-1">
                  Total:{' '}
                  <span className="font-mono tabular-nums ml-3">
                    {formatLeones(job.order.total)}
                  </span>
                </p>
              </div>
            </div>
          )}

          {job.type === 'orders_manifest' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#141715] font-semibold">
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Delivery Zone & Address</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7E4]">
                {job.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-3 font-mono font-semibold">
                      {order.orderNumber}
                    </td>
                    <td className="py-2 pr-3">
                      {order.customerName} ({order.customerPhone})
                    </td>
                    <td className="py-2 pr-3">
                      {order.deliveryZone} · {order.deliveryAddress}
                    </td>
                    <td className="py-2 pr-3 uppercase">
                      {order.paymentMethod.replace('_', ' ')} (
                      {order.paymentStatus === 'paid' ? 'Paid' : 'COD'})
                    </td>
                    <td className="py-2 pr-3 capitalize">
                      {order.status.replaceAll('_', ' ')}
                    </td>
                    <td className="py-2 text-right font-mono font-bold tabular-nums">
                      {formatLeones(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {job.type === 'audit_log' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#141715] font-semibold">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3 text-right">Previous</th>
                  <th className="py-2 pr-3 text-right">Delta</th>
                  <th className="py-2 pr-3 text-right">New</th>
                  <th className="py-2">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7E4]">
                {job.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 font-mono">{log.sku}</td>
                    <td className="py-2 pr-3 font-medium">{log.productName}</td>
                    <td className="py-2 pr-3 capitalize">
                      {log.reason.replaceAll('_', ' ')}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {log.previousStock}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono font-bold tabular-nums">
                      {log.delta > 0 ? `+${log.delta}` : log.delta}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {log.newStock}
                    </td>
                    <td className="py-2">{log.actorEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
