import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import type { EmailEventType, PaymentMethod } from '@/lib/types';

interface EmailLineItem {
  name: string;
  unit: string;
  quantity: number;
  lineTotal: number;
}

interface EmailRequestBody {
  orderId: string;
  orderNumber: string;
  recipientEmail: string;
  recipientName: string;
  eventType: EmailEventType;
  deliveryAddress: string;
  deliveryZone: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items?: EmailLineItem[];
  itemsSummary?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNle(value: number): string {
  return `NLe ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getEventCopy(eventType: EmailEventType, orderNumber: string) {
  switch (eventType) {
    case 'order_confirmed':
      return {
        subject: `Order ${orderNumber} Confirmed — Freetown Supermarket`,
        headline: 'Your grocery order is confirmed',
        message:
          'Thank you for shopping with Freetown Supermarket. Our store team has verified your payment and locked your stock items for packing.',
      };
    case 'status_packing':
      return {
        subject: `Order ${orderNumber} is Being Packed — Freetown Supermarket`,
        headline: 'We are packing your fresh groceries',
        message:
          'Our Freetown floor team is carefully selecting your produce, bakery, and pantry items right now.',
      };
    case 'status_out_for_delivery':
      return {
        subject: `Order ${orderNumber} is Out for Delivery — Freetown Supermarket`,
        headline: 'Your courier is on the way',
        message:
          'Your Freetown Supermarket dispatch rider has departed with your order and will call you on arrival.',
      };
    case 'status_delivered':
      return {
        subject: `Order ${orderNumber} Delivered — Freetown Supermarket`,
        headline: 'Your order has been delivered',
        message:
          'Your groceries have arrived. We appreciate your business and look forward to serving your household again.',
      };
    case 'status_cancelled':
      return {
        subject: `Order ${orderNumber} Cancelled — Freetown Supermarket`,
        headline: 'Order cancellation notice',
        message:
          'Your order has been cancelled by store operations. Any authorized card or mobile money charge will be reversed within 24 hours.',
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EmailRequestBody;

    if (!body.recipientEmail || !body.recipientEmail.includes('@') || !body.orderNumber) {
      return NextResponse.json(
        { error: 'Valid recipientEmail and orderNumber are required.' },
        { status: 400 }
      );
    }

    const copy = getEventCopy(body.eventType, body.orderNumber);
    const itemsRows = (body.items || [])
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#141715;">${escapeHtml(item.name)} <span style="color:#6b7280;">(${escapeHtml(item.unit)})</span></td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;color:#141715;">x${item.quantity}</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;font-weight:600;color:#141715;">${formatNle(item.lineTotal)}</td>
          </tr>`
      )
      .join('');

    const htmlBody = `
      <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#141715;border:1px solid #e5e7eb;">
        <div style="border-bottom:2px solid #156145;padding-bottom:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#156145;font-weight:700;">Freetown Supermarket</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#141715;">${escapeHtml(copy.headline)}</h1>
        </div>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">Hello ${escapeHtml(body.recipientName)},</p>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 24px;">${escapeHtml(copy.message)}</p>
        <div style="background:#f8f9f8;padding:16px;border:1px solid #e5e7eb;margin-bottom:24px;">
          <p style="margin:0 0 6px;font-size:13px;color:#4b5563;"><strong>Order Number:</strong> ${escapeHtml(body.orderNumber)}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#4b5563;"><strong>Delivery Zone:</strong> ${escapeHtml(body.deliveryZone)} — ${escapeHtml(body.deliveryAddress)}</p>
          <p style="margin:0;font-size:13px;color:#4b5563;"><strong>Payment Reference:</strong> ${escapeHtml(body.paymentReference)} (${escapeHtml(body.paymentMethod.replace('_', ' ').toUpperCase())})</p>
        </div>
        ${
          itemsRows
            ? `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <thead>
                  <tr>
                    <th style="text-align:left;padding-bottom:8px;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Item</th>
                    <th style="text-align:right;padding:0 12px 8px;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Qty</th>
                    <th style="text-align:right;padding-bottom:8px;border-bottom:1px solid #d1d5db;font-size:12px;color:#6b7280;text-transform:uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
              </table>`
            : `<p style="font-size:14px;color:#374151;margin-bottom:20px;"><strong>Items:</strong> ${escapeHtml(body.itemsSummary || 'Grocery order')}</p>`
        }
        <div style="border-top:1px solid #d1d5db;padding-top:12px;font-size:14px;">
          <p style="margin:4px 0;display:flex;justify-content:space-between;"><span>Subtotal:</span> <strong>${formatNle(body.subtotal)}</strong></p>
          <p style="margin:4px 0;display:flex;justify-content:space-between;"><span>Delivery Fee:</span> <strong>${body.deliveryFee === 0 ? 'Free' : formatNle(body.deliveryFee)}</strong></p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#156145;">Total: ${formatNle(body.total)}</p>
        </div>
        <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
          Freetown Supermarket · Wilkinson Road, Freetown, Sierra Leone
        </p>
      </div>
    `;

    const plainPreview = `${copy.headline} (${body.orderNumber}). Delivery: ${body.deliveryZone}, ${body.deliveryAddress}. Total: ${formatNle(body.total)}. Ref: ${body.paymentReference}. ${body.itemsSummary ? `Items: ${body.itemsSummary}` : ''}`;

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = Number(process.env.SMTP_PORT || '587');
    const smtpFrom = process.env.SMTP_FROM || 'Freetown Supermarket <orders@freetownsupermarket.sl>';

    let deliveryMode: 'smtp' | 'outbox_logged' = 'outbox_logged';
    let deliveryStatus: 'sent' | 'queued' = 'queued';
    let messageId = `<fs-${crypto.randomBytes(6).toString('hex')}@freetownsupermarket.sl>`;

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: `${body.recipientName} <${body.recipientEmail}>`,
        subject: copy.subject,
        text: plainPreview,
        html: htmlBody,
      });

      deliveryMode = 'smtp';
      deliveryStatus = 'sent';
      messageId = info.messageId || messageId;
    }

    return NextResponse.json({
      success: true,
      subject: copy.subject,
      bodyPreview: plainPreview.slice(0, 1950),
      htmlBody,
      deliveryMode,
      deliveryStatus,
      messageId,
    });
  } catch (error) {
    console.error('Email dispatch error:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch customer email notification.' },
      { status: 500 }
    );
  }
}
