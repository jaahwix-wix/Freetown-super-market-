'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { MailCheck, PackageCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { OperationType, handleFirestoreError } from '@/lib/firestore-errors';
import { useAuth } from './AuthProvider';
import { UsernamePasswordAuthCard } from './AuthModal';
import { formatLeones } from '@/lib/catalog-seed';
import type {
  EmailNotificationRecord,
  OrderItemRecord,
  OrderRecord,
  OrderStatus,
} from '@/lib/types';

interface OrdersViewProps {
  onPreviewEmail: (email: EmailNotificationRecord) => void;
  onGoToStorefront: () => void;
}

function toMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function formatDate(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: OrderStatus): { text: string; colorClass: string } {
  switch (status) {
    case 'confirmed':
      return { text: 'Confirmed', colorClass: 'text-[#156145]' };
    case 'packing':
      return { text: 'Packing in Store', colorClass: 'text-[#B45309]' };
    case 'out_for_delivery':
      return { text: 'Out for Delivery', colorClass: 'text-[#1D4ED8]' };
    case 'delivered':
      return { text: 'Delivered', colorClass: 'text-[#15803D]' };
    case 'cancelled':
      return { text: 'Cancelled', colorClass: 'text-[#B91C1C]' };
  }
}

export function OrdersView({
  onPreviewEmail,
  onGoToStorefront,
}: OrdersViewProps) {
  const { user, emailVerified, authReady } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [emails, setEmails] = useState<EmailNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, OrderItemRecord[]>>({});

  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    const ordersPath = 'orders';
    const ordersQuery = query(
      collection(db, ordersPath),
      where('customerId', '==', user.uid)
    );

    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as OrderRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setOrders(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, ordersPath);
      }
    );

    const emailsPath = 'emailNotifications';
    const emailsQuery = query(
      collection(db, emailsPath),
      where('customerId', '==', user.uid)
    );

    const unsubEmails = onSnapshot(
      emailsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as EmailNotificationRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setEmails(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, emailsPath);
      }
    );

    return () => {
      unsubOrders();
      unsubEmails();
    };
  }, [authReady, user]);

  const activeOrders = useMemo(() => (user ? orders : []), [user, orders]);
  const activeEmails = useMemo(() => (user ? emails : []), [user, emails]);

  const emailsByOrder = useMemo(() => {
    const map: Record<string, EmailNotificationRecord[]> = {};
    for (const eml of activeEmails) {
      if (!map[eml.orderId]) map[eml.orderId] = [];
      map[eml.orderId].push(eml);
    }
    return map;
  }, [activeEmails]);

  const handleToggleOrderDetails = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderItemsMap[orderId] && user) {
      const itemsPath = `orders/${orderId}/items`;
      try {
        const snap = await getDocs(
          query(collection(db, itemsPath), where('customerId', '==', user.uid))
        );
        const items = snap.docs.map((d) => d.data() as OrderItemRecord);
        setOrderItemsMap((prev) => ({ ...prev, [orderId]: items }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, itemsPath);
      }
    }
  };

  if (!authReady || (Boolean(user) && loading)) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-12">
        <div className="space-y-4">
          <div className="h-8 w-56 bg-[#EAECEB] rounded animate-pulse" />
          <div className="h-32 bg-white border border-[#E3E7E4] rounded-lg animate-pulse" />
          <div className="h-32 bg-white border border-[#E3E7E4] rounded-lg animate-pulse" />
        </div>
      </main>
    );
  }

  if (!user || !emailVerified) {
    return (
      <main className="max-w-[520px] mx-auto px-4 sm:px-8 py-14">
        <div className="text-center mb-6">
          <PackageCheck className="w-9 h-9 text-[#156145] mx-auto mb-3 stroke-[1.5]" />
          <h1 className="font-display text-2xl font-bold text-[#141715]">
            Sign in to view your orders & email receipts
          </h1>
          <p className="mt-2 text-sm text-[#4F5852]">
            Enter your username or email and password to view live Freetown dispatch status and
            automated order confirmations.
          </p>
        </div>
        <UsernamePasswordAuthCard context="customer" />
      </main>
    );
  }

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E3E7E4]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141715]">
            My Orders & Email Receipts
          </h1>
          <p className="mt-1 text-sm text-[#4F5852]">
            Signed in as {user.email} · Live fulfillment and automated notification history
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToStorefront}
          className="px-4 py-2.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-sm font-semibold rounded-md transition-colors self-start sm:self-auto cursor-pointer"
        >
          Back to Aisles
        </button>
      </div>

      {activeOrders.length === 0 ? (
        <div className="mt-8 bg-white border border-[#E3E7E4] rounded-lg p-12 text-center">
          <p className="font-display text-lg font-semibold text-[#141715]">
            No orders placed yet
          </p>
          <p className="mt-1 text-sm text-[#4F5852]">
            Once you complete checkout, your order receipt and automated email log will appear here.
          </p>
          <button
            type="button"
            onClick={onGoToStorefront}
            className="mt-5 px-5 py-2.5 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md transition-colors cursor-pointer"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {activeOrders.map((order) => {
            const st = statusLabel(order.status);
            const orderEmails = emailsByOrder[order.id] || [];
            const isExpanded = expandedOrderId === order.id;
            const items = orderItemsMap[order.id] || [];

            return (
              <section
                key={order.id}
                className="bg-white border border-[#E3E7E4] rounded-lg overflow-hidden"
              >
                <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B655E]">
                      <span className="font-mono font-semibold text-[#141715]">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(order.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${st.colorClass}`}>{st.text}</span>
                    </div>
                    <p className="text-sm font-medium text-[#141715]">{order.itemsSummary}</p>
                    <p className="text-xs text-[#5B655E]">
                      {order.deliveryZone} ({order.deliveryAddress}) · Ref:{' '}
                      <span className="font-mono">{order.paymentReference}</span> (
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Cash on Delivery'})
                    </p>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#ECEFED]">
                    <div className="text-left lg:text-right">
                      <p className="text-xs text-[#5B655E]">
                        {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      </p>
                      <p className="font-mono text-base font-bold text-[#141715] tabular-nums">
                        {formatLeones(order.total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleOrderDetails(order.id)}
                      className="px-3.5 py-2 bg-[#F1F3F2] hover:bg-[#E5E9E7] text-xs font-semibold text-[#141715] rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'Order & Emails'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-4 border-t border-[#ECEFED] bg-[#F8F9F8] grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5B655E] mb-3">
                        Itemized Breakdown
                      </h3>
                      {items.length === 0 ? (
                        <p className="text-xs text-[#5B655E]">Loading line items...</p>
                      ) : (
                        <ul className="divide-y divide-[#E3E7E4] bg-white border border-[#E3E7E4] rounded-md px-4">
                          {items.map((item) => (
                            <li
                              key={item.productId}
                              className="py-2.5 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-[#141715]">{item.name}</p>
                                <p className="text-[#5B655E]">
                                  {item.quantity} x {formatLeones(item.unitPrice)} ({item.unit})
                                </p>
                              </div>
                              <span className="font-mono font-semibold text-[#141715] tabular-nums">
                                {formatLeones(item.lineTotal)}
                              </span>
                            </li>
                          ))}
                          <li className="py-2.5 flex justify-between text-xs text-[#5B655E]">
                            <span>Delivery Fee</span>
                            <span className="font-mono tabular-nums">
                              {order.deliveryFee === 0
                                ? 'Free'
                                : formatLeones(order.deliveryFee)}
                            </span>
                          </li>
                          <li className="py-2.5 flex justify-between text-xs font-bold text-[#141715]">
                            <span>Total</span>
                            <span className="font-mono tabular-nums">
                              {formatLeones(order.total)}
                            </span>
                          </li>
                        </ul>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5B655E] mb-3">
                        Automated Email Notifications ({orderEmails.length})
                      </h3>
                      {orderEmails.length === 0 ? (
                        <p className="text-xs text-[#5B655E]">
                          No email notifications logged yet.
                        </p>
                      ) : (
                        <ul className="space-y-2.5">
                          {orderEmails.map((eml) => (
                            <li
                              key={eml.id}
                              className="bg-white border border-[#E3E7E4] rounded-md p-3.5 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#141715] truncate flex items-center gap-1.5">
                                  <MailCheck className="w-3.5 h-3.5 text-[#156145] shrink-0" />
                                  <span>{eml.subject}</span>
                                </p>
                                <p className="mt-0.5 text-xs text-[#5B655E] truncate">
                                  To {eml.recipientEmail} ·{' '}
                                  {eml.deliveryMode === 'smtp' ? 'SMTP Sent' : 'Outbox Logged'} ·{' '}
                                  {formatDate(eml.createdAt)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onPreviewEmail(eml)}
                                className="px-3 py-1.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-xs font-semibold text-[#141715] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                View Email
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
