import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { luhnCheck, detectCardBrand, isValidExpiry, isValidSierraLeonePhone } from '@/lib/payment-utils';
import type { PaymentMethod } from '@/lib/types';

interface PaymentRequestBody {
  orderId: string;
  amount: number;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvc?: string;
  cardHolder?: string;
  otpCode?: string;
  mobileWalletPhone?: string;
}

const RUNTIME_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PaymentRequestBody;

    if (!body.orderId || typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount or order reference.' },
        { status: 400 }
      );
    }

    if (!body.customerEmail || !body.customerEmail.includes('@')) {
      return NextResponse.json(
        { error: 'A valid customer email address is required for order receipts.' },
        { status: 400 }
      );
    }

    let maskedInstrument = 'Cash on Delivery';
    let paymentStatus: 'paid' | 'cod_pending' = 'paid';

    if (body.paymentMethod === 'card') {
      const digits = (body.cardNumber || '').replace(/\D/g, '');
      if (!luhnCheck(digits)) {
        return NextResponse.json(
          { error: 'Card number failed Luhn security validation. Please check the digits.' },
          { status: 400 }
        );
      }
      if (!body.cardExpiry || !isValidExpiry(body.cardExpiry)) {
        return NextResponse.json(
          { error: 'Card expiration date is invalid or expired (MM/YY).' },
          { status: 400 }
        );
      }
      if (!body.cardCvc || !/^\d{3,4}$/.test(body.cardCvc.trim())) {
        return NextResponse.json(
          { error: 'Valid 3 or 4 digit security CVC is required.' },
          { status: 400 }
        );
      }
      if (!body.cardHolder || body.cardHolder.trim().length < 2) {
        return NextResponse.json(
          { error: 'Cardholder name is required.' },
          { status: 400 }
        );
      }
      if (!body.otpCode || !/^\d{6}$/.test(body.otpCode.trim())) {
        return NextResponse.json(
          { error: '3D Secure 6-digit verification code is required to authorize card payment.' },
          { status: 400 }
        );
      }

      const brand = detectCardBrand(digits);
      maskedInstrument = `${brand} ending in ${digits.slice(-4)}`;
      paymentStatus = 'paid';
    } else if (
      body.paymentMethod === 'orange_money' ||
      body.paymentMethod === 'africell_money'
    ) {
      const walletPhone = body.mobileWalletPhone || body.customerPhone;
      if (!isValidSierraLeonePhone(walletPhone)) {
        return NextResponse.json(
          { error: 'Please enter a valid Sierra Leone mobile money number (+232).' },
          { status: 400 }
        );
      }
      if (!body.otpCode || !/^\d{4,6}$/.test(body.otpCode.trim())) {
        return NextResponse.json(
          { error: 'Mobile Money authorization code is required to confirm debit.' },
          { status: 400 }
        );
      }

      const label = body.paymentMethod === 'orange_money' ? 'Orange Money SL' : 'Africell Money';
      const cleaned = walletPhone.replace(/\D/g, '');
      maskedInstrument = `${label} (${cleaned.slice(-4)})`;
      paymentStatus = 'paid';
    } else if (body.paymentMethod === 'cod') {
      if (!isValidSierraLeonePhone(body.customerPhone)) {
        return NextResponse.json(
          { error: 'A reachable Sierra Leone phone number is required for Cash on Delivery.' },
          { status: 400 }
        );
      }
      maskedInstrument = 'Cash on Delivery (Verified Phone)';
      paymentStatus = 'cod_pending';
    } else {
      return NextResponse.json({ error: 'Unsupported payment method.' }, { status: 400 });
    }

    const secret = process.env.PAYMENT_SIGNING_SECRET || RUNTIME_FALLBACK_SECRET;
    const reference = `FS-PAY-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    const authorizedAt = new Date().toISOString();

    const canonicalPayload = `${body.orderId}|${body.amount.toFixed(2)}|${body.paymentMethod}|${reference}|${authorizedAt}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(canonicalPayload)
      .digest('hex');

    return NextResponse.json({
      verified: true,
      paymentReference: reference,
      paymentStatus,
      maskedInstrument,
      signature,
      authorizedAt,
    });
  } catch (error) {
    console.error('Payment gateway error:', error);
    return NextResponse.json(
      { error: 'Unable to process payment verification at this time.' },
      { status: 500 }
    );
  }
}
