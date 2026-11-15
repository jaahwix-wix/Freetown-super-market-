'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShieldCheck,
  Lock,
  MailCheck,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import {
  doc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OperationType, handleFirestoreError } from '@/lib/firestore-errors';
import { makeChallengeCode, makeOrderId, makeOrderNumber } from '@/lib/id-utils';
import { useAuth } from './AuthProvider';
import { ProductImage } from './ProductImage';
import { formatLeones } from '@/lib/catalog-seed';
import {
  calculateDeliveryFee,
  detectCardBrand,
  formatCardNumber,
  isValidExpiry,
  isValidSierraLeonePhone,
  luhnCheck,
} from '@/lib/payment-utils';
import {
  FREE_DELIVERY_THRESHOLD,
  FREETOWN_DELIVERY_ZONES,
  type CartItem,
  type EmailNotificationRecord,
  type PaymentMethod,
  type Product,
} from '@/lib/types';

interface CheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  products: Product[];
  isLiveFirestoreCatalog: boolean;
  onUpdateQty: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOrderCompleteViewOrders: () => void;
  onPreviewEmail: (email: EmailNotificationRecord, htmlBody?: string | null) => void;
}

type DrawerStep = 'bag' | 'checkout' | 'confirmed';

interface ConfirmedSummary {
  orderNumber: string;
  paymentReference: string;
  maskedInstrument: string;
  total: number;
  recipientEmail: string;
  emailRecord: EmailNotificationRecord;
  emailHtml: string | null;
}

export function CheckoutDrawer({
  open,
  onClose,
  cart,
  products,
  isLiveFirestoreCatalog,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderCompleteViewOrders,
  onPreviewEmail,
}: CheckoutDrawerProps) {
  const {
    user,
    emailVerified,
    profile,
    openAuthModal,
    resendVerificationEmail,
    refreshVerification,
    updateSavedDelivery,
  } = useAuth();

  const [step, setStep] = useState<DrawerStep>('bag');
  const [deliveryZoneOverride, setDeliveryZoneOverride] = useState<string | null>(null);
  const [customerNameOverride, setCustomerNameOverride] = useState<string | null>(null);
  const [customerEmailOverride, setCustomerEmailOverride] = useState<string | null>(null);
  const [customerPhoneOverride, setCustomerPhoneOverride] = useState<string | null>(null);
  const [deliveryAddressOverride, setDeliveryAddressOverride] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardHolderOverride, setCardHolderOverride] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [mobileWalletPhone, setMobileWalletPhone] = useState('+232 ');
  const [otpCode, setOtpCode] = useState('');
  const [issuedChallengeCode, setIssuedChallengeCode] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedSummary | null>(null);

  const deliveryZone =
    deliveryZoneOverride ?? profile?.defaultZone ?? FREETOWN_DELIVERY_ZONES[0].name;
  const customerName =
    customerNameOverride ?? profile?.displayName ?? user?.displayName ?? '';
  const customerEmail = customerEmailOverride ?? user?.email ?? '';
  const customerPhone = customerPhoneOverride ?? profile?.phone ?? '+232 ';
  const deliveryAddress = deliveryAddressOverride ?? profile?.defaultAddress ?? '';
  const cardHolder =
    cardHolderOverride ?? profile?.displayName ?? user?.displayName ?? '';

  if (!open) return null;

  const lineItems = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      return {
        product,
        quantity: Math.min(item.quantity, Math.max(0, product.stockQuantity)),
      };
    })
    .filter((x): x is { product: Product; quantity: number } => Boolean(x && x.quantity > 0));

  const subtotal = Number(
    lineItems.reduce((sum, li) => sum + li.product.price * li.quantity, 0).toFixed(2)
  );
  const deliveryFee = lineItems.length > 0 ? calculateDeliveryFee(deliveryZone, subtotal) : 0;
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const totalItemCount = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  const cardDigits = cardNumber.replace(/\D/g, '');
  const cardBrand = detectCardBrand(cardDigits);
  const cardValidLuhn = cardDigits.length >= 13 && luhnCheck(cardDigits);

  const handleIssueVerificationCode = () => {
    const code = makeChallengeCode();
    setIssuedChallengeCode(code);
    setOtpCode(code);
    setErrorMsg(null);
  };

  const handleCloseDrawer = () => {
    if (step === 'confirmed') {
      setStep('bag');
      setConfirmed(null);
      setIssuedChallengeCode(null);
      setOtpCode('');
    }
    setErrorMsg(null);
    onClose();
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user || !emailVerified) {
      setErrorMsg(
        'Please sign in with your verified username/email and password to place an order.'
      );
      return;
    }

    if (!isLiveFirestoreCatalog) {
      setErrorMsg(
        'Store catalog has not been published to Firestore yet. Sign in as Store Admin in the Inventory tab to seed live products.'
      );
      return;
    }

    if (lineItems.length === 0) {
      setErrorMsg('Your shopping bag is empty.');
      return;
    }

    if (customerName.trim().length < 2) {
      setErrorMsg('Please enter the recipient full name.');
      return;
    }
    if (!customerEmail.includes('@')) {
      setErrorMsg('Please provide a valid email address for your automated order receipt.');
      return;
    }
    if (!isValidSierraLeonePhone(customerPhone)) {
      setErrorMsg('Please enter a valid Sierra Leone phone number (e.g. +232 76 123456).');
      return;
    }
    if (deliveryAddress.trim().length < 4) {
      setErrorMsg('Please enter your street address and Freetown landmark.');
      return;
    }

    if (paymentMethod === 'card') {
      if (!cardValidLuhn) {
        setErrorMsg('Card number failed Luhn check. Please verify the card digits.');
        return;
      }
      if (!isValidExpiry(cardExpiry)) {
        setErrorMsg('Please enter a valid future expiry date (MM/YY).');
        return;
      }
      if (!/^\d{3,4}$/.test(cardCvc.trim())) {
        setErrorMsg('Please enter a valid 3 or 4 digit CVC.');
        return;
      }
      if (!/^\d{6}$/.test(otpCode.trim())) {
        setErrorMsg('Click "Request 3DS Code" and confirm the 6-digit verification code.');
        return;
      }
    } else if (
      paymentMethod === 'orange_money' ||
      paymentMethod === 'africell_money'
    ) {
      if (!isValidSierraLeonePhone(mobileWalletPhone)) {
        setErrorMsg('Please enter a valid Sierra Leone Mobile Money wallet number.');
        return;
      }
      if (!/^\d{4,6}$/.test(otpCode.trim())) {
        setErrorMsg('Request and enter the Mobile Money authorization code.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const orderId = makeOrderId();
      const orderNumber = makeOrderNumber();

      // Step 1: Server-side Payment Gateway Verification & HMAC Signing
      const payRes = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: total,
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          paymentMethod,
          cardNumber,
          cardExpiry,
          cardCvc,
          cardHolder,
          otpCode,
          mobileWalletPhone,
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok || !payData.verified) {
        setErrorMsg(payData.error || 'Payment authorization was declined.');
        setSubmitting(false);
        return;
      }

      const itemsSummary = lineItems
        .map((li) => `${li.quantity}x ${li.product.name}`)
        .join(', ')
        .slice(0, 390);

      // Step 2: Atomic Firestore Transaction (Verify & Decrement Stock + Create Order + Items + Audit Logs)
      try {
        await runTransaction(db, async (transaction) => {
          // Read all product docs first
          const productSnaps = await Promise.all(
            lineItems.map((li) =>
              transaction.get(doc(db, 'products', li.product.id))
            )
          );

          const verifiedLines: Array<{
            product: Product;
            quantity: number;
            currentStock: number;
            newStock: number;
          }> = [];

          for (let i = 0; i < lineItems.length; i++) {
            const snap = productSnaps[i];
            const li = lineItems[i];
            if (!snap.exists()) {
              throw new Error(`STOCK_ERR:Product ${li.product.name} is no longer available.`);
            }
            const live = snap.data() as Product;
            const currentStock = Math.floor(live.stockQuantity);
            if (!live.active || currentStock < li.quantity) {
              throw new Error(
                `STOCK_ERR:Only ${currentStock} units of ${live.name} remain in stock.`
              );
            }
            verifiedLines.push({
              product: live,
              quantity: li.quantity,
              currentStock,
              newStock: currentStock - li.quantity,
            });
          }

          // Create Order document
          const orderRef = doc(db, 'orders', orderId);
          transaction.set(orderRef, {
            id: orderId,
            orderNumber,
            customerId: user.uid,
            customerName: customerName.trim().slice(0, 120),
            customerEmail: customerEmail.trim().slice(0, 160),
            customerPhone: customerPhone.trim().slice(0, 30),
            deliveryAddress: deliveryAddress.trim().slice(0, 240),
            deliveryZone: deliveryZone.slice(0, 80),
            paymentMethod,
            paymentStatus: payData.paymentStatus,
            paymentReference: String(payData.paymentReference).slice(0, 128),
            subtotal,
            deliveryFee,
            total,
            itemCount: totalItemCount,
            itemsSummary,
            status: 'confirmed',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Decrement Stock, Write Line Items & Write Immutable Stock Audit Logs
          for (const vl of verifiedLines) {
            const productRef = doc(db, 'products', vl.product.id);
            transaction.update(productRef, {
              stockQuantity: vl.newStock,
              lastOrderId: orderId,
              updatedAt: serverTimestamp(),
            });

            const itemRef = doc(db, 'orders', orderId, 'items', vl.product.id);
            transaction.set(itemRef, {
              productId: vl.product.id,
              sku: vl.product.sku,
              name: vl.product.name,
              unit: vl.product.unit,
              unitPrice: vl.product.price,
              quantity: vl.quantity,
              lineTotal: Number((vl.product.price * vl.quantity).toFixed(2)),
              customerId: user.uid,
            });

            const logId = `log_${orderId}_${vl.product.id}`.slice(0, 120);
            const logRef = doc(db, 'inventoryLogs', logId);
            transaction.set(logRef, {
              id: logId,
              productId: vl.product.id,
              productName: vl.product.name,
              sku: vl.product.sku,
              previousStock: vl.currentStock,
              newStock: vl.newStock,
              delta: -vl.quantity,
              reason: 'customer_order',
              actorUid: user.uid,
              actorEmail: (user.email || customerEmail).slice(0, 160),
              orderId,
              createdAt: serverTimestamp(),
            });
          }
        });
      } catch (txError) {
        if (txError instanceof Error && txError.message.startsWith('STOCK_ERR:')) {
          setErrorMsg(txError.message.replace('STOCK_ERR:', ''));
          setSubmitting(false);
          return;
        }
        handleFirestoreError(txError, OperationType.WRITE, `orders/${orderId}`);
      }

      // Step 3: Dispatch Automated Customer Order Confirmation Email
      const emailRes = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderNumber,
          recipientEmail: customerEmail.trim(),
          recipientName: customerName.trim(),
          eventType: 'order_confirmed',
          deliveryAddress: deliveryAddress.trim(),
          deliveryZone,
          paymentMethod,
          paymentReference: payData.paymentReference,
          subtotal,
          deliveryFee,
          total,
          itemsSummary,
          items: lineItems.map((li) => ({
            name: li.product.name,
            unit: li.product.unit,
            quantity: li.quantity,
            lineTotal: Number((li.product.price * li.quantity).toFixed(2)),
          })),
        }),
      });

      const emailData = await emailRes.json();
      const emailId = `eml_${orderId}_confirmed`;
      const emailDoc: EmailNotificationRecord = {
        id: emailId,
        orderId,
        orderNumber,
        customerId: user.uid,
        recipientEmail: customerEmail.trim().slice(0, 160),
        recipientName: customerName.trim().slice(0, 120),
        subject: (emailData.subject || `Order ${orderNumber} Confirmed`).slice(0, 200),
        bodyPreview: (emailData.bodyPreview || itemsSummary).slice(0, 2000),
        eventType: 'order_confirmed',
        deliveryMode: emailData.deliveryMode === 'smtp' ? 'smtp' : 'outbox_logged',
        deliveryStatus: emailData.deliveryStatus === 'sent' ? 'sent' : 'queued',
        messageId: String(emailData.messageId || `fs-${orderId}`).slice(0, 160),
      };

      try {
        await setDoc(doc(db, 'emailNotifications', emailId), {
          ...emailDoc,
          createdAt: serverTimestamp(),
        });
      } catch (emailErr) {
        handleFirestoreError(emailErr, OperationType.CREATE, `emailNotifications/${emailId}`);
      }

      await updateSavedDelivery({
        phone: customerPhone.trim(),
        defaultAddress: deliveryAddress.trim(),
        defaultZone: deliveryZone,
      });

      onClearCart();
      setConfirmed({
        orderNumber,
        paymentReference: payData.paymentReference,
        maskedInstrument: payData.maskedInstrument,
        total,
        recipientEmail: customerEmail.trim(),
        emailRecord: emailDoc,
        emailHtml: emailData.htmlBody || null,
      });
      setStep('confirmed');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unexpected error completing checkout. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag and checkout"
    >
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl border-l border-[#DCE1DD]">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#E3E7E4] flex items-center justify-between gap-4 bg-[#F8F9F8]">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => {
                  setStep('bag');
                  setErrorMsg(null);
                }}
                aria-label="Back to shopping bag"
                className="p-1.5 rounded-md hover:bg-[#E5E9E7] text-[#141715] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display text-lg font-bold text-[#141715]">
              {step === 'bag'
                ? `Shopping Bag (${totalItemCount})`
                : step === 'checkout'
                  ? 'Secure Payment Gateway'
                  : 'Order Confirmed'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Close drawer"
            className="p-2 rounded-md text-[#4F5852] hover:bg-[#E5E9E7] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'bag' && (
            <>
              {lineItems.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="font-display text-lg font-semibold text-[#141715]">
                    Your bag is empty
                  </p>
                  <p className="mt-1 text-sm text-[#4F5852]">
                    Add fresh produce, rice, bakery items, or chilled drinks from the aisles.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="mt-6 px-5 py-2.5 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Browse Aisles
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-[#F8F9F8] border border-[#E3E7E4] rounded-md p-3.5 text-xs text-[#3B443E]">
                    {subtotal >= FREE_DELIVERY_THRESHOLD ? (
                      <span className="font-semibold text-[#15803D]">
                        Free Freetown delivery unlocked (orders NLe {FREE_DELIVERY_THRESHOLD}+).
                      </span>
                    ) : (
                      <span>
                        Add{' '}
                        <strong className="font-mono tabular-nums">
                          {formatLeones(FREE_DELIVERY_THRESHOLD - subtotal)}
                        </strong>{' '}
                        more to unlock free Freetown delivery.
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-[#ECEFED]">
                    {lineItems.map(({ product, quantity }) => (
                      <li key={product.id} className="py-4 flex gap-4">
                        <div className="w-20 h-16 rounded-md overflow-hidden bg-[#F1F3F2] border border-[#E3E7E4] shrink-0">
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-[#141715] truncate">
                              {product.name}
                            </p>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(product.id)}
                              aria-label={`Remove ${product.name}`}
                              className="text-[#78827B] hover:text-[#B91C1C] p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-[#5B655E]">
                            {product.unit} · {product.stockQuantity} in stock
                          </p>
                          <div className="mt-2.5 flex items-center justify-between">
                            <div className="flex items-center border border-[#D7DDD9] rounded-md h-8">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(product.id, quantity - 1)}
                                aria-label="Decrease quantity"
                                className="w-8 h-full flex items-center justify-center hover:bg-[#F1F3F2] cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center font-mono text-xs font-semibold tabular-nums">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                disabled={quantity >= product.stockQuantity}
                                onClick={() => onUpdateQty(product.id, quantity + 1)}
                                aria-label="Increase quantity"
                                className="w-8 h-full flex items-center justify-center hover:bg-[#F1F3F2] disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="font-mono text-sm font-semibold text-[#141715] tabular-nums">
                              {formatLeones(product.price * quantity)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <label
                      htmlFor="bag-delivery-zone"
                      className="block text-xs font-semibold text-[#3B443E] mb-1.5"
                    >
                      Freetown Delivery Zone
                    </label>
                    <select
                      id="bag-delivery-zone"
                      value={deliveryZone}
                      onChange={(e) => setDeliveryZoneOverride(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145]"
                    >
                      {FREETOWN_DELIVERY_ZONES.map((zone) => (
                        <option key={zone.name} value={zone.name}>
                          {zone.name} ({zone.eta} ·{' '}
                          {subtotal >= FREE_DELIVERY_THRESHOLD
                            ? 'Free'
                            : formatLeones(zone.fee)}
                          )
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-6">
              {!user ? (
                <div className="bg-[#F8F9F8] border border-[#DCE1DD] rounded-md p-4">
                  <p className="text-sm font-semibold text-[#141715]">
                    Sign in with Username & Password to Checkout
                  </p>
                  <p className="mt-1 text-xs text-[#4F5852]">
                    Sign in or create an account to lock your order history, reserve live shelf
                    stock, and receive automated email receipts.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal('customer', 'signin')}
                      className="px-4 py-2 bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                    >
                      Sign In with Username & Password
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthModal('customer', 'register')}
                      className="px-4 py-2 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md transition-colors cursor-pointer"
                    >
                      Create Account
                    </button>
                  </div>
                </div>
              ) : !emailVerified ? (
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-md p-4">
                  <p className="text-sm font-semibold text-[#92400E]">
                    Verify your account email to place order
                  </p>
                  <p className="mt-1 text-xs text-[#78350F]">
                    Click the verification link sent to <strong>{user.email}</strong>, then
                    refresh your status below.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={refreshVerification}
                      className="px-3.5 py-2 bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      I&apos;ve Verified — Refresh
                    </button>
                    <button
                      type="button"
                      onClick={resendVerificationEmail}
                      className="px-3.5 py-2 bg-white border border-[#D7DDD9] hover:bg-[#F8F9F8] text-[#141715] text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Resend Link
                    </button>
                  </div>
                </div>
              ) : null}

              {errorMsg && (
                <div
                  role="alert"
                  className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-medium rounded-md p-3.5"
                >
                  {errorMsg}
                </div>
              )}

              {/* Customer & Delivery Details */}
              <div className="space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5B655E]">
                  1. Delivery & Receipt Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#3B443E] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerNameOverride(e.target.value)}
                      placeholder="Aminata Kamara"
                      className="w-full h-10 px-3 text-sm border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#3B443E] mb-1">
                      Sierra Leone Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhoneOverride(e.target.value)}
                      placeholder="+232 76 123456"
                      className="w-full h-10 px-3 text-sm font-mono border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3B443E] mb-1">
                    Receipt Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmailOverride(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full h-10 px-3 text-sm border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3B443E] mb-1">
                    Street Address & Landmark ({deliveryZone})
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddressOverride(e.target.value)}
                    placeholder="24 Wilkinson Road, near Lumley Roundabout"
                    className="w-full h-10 px-3 text-sm border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                  />
                </div>
              </div>

              {/* Secure Payment Gateway */}
              <div className="space-y-3.5 pt-4 border-t border-[#E3E7E4]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5B655E]">
                    2. Payment Method
                  </h3>
                  <span className="text-xs text-[#156145] font-medium inline-flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>HMAC Verified Gateway</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'card', label: 'Debit / Credit Card' },
                      { id: 'orange_money', label: 'Orange Money SL' },
                      { id: 'africell_money', label: 'Africell Money' },
                      { id: 'cod', label: 'Cash on Delivery' },
                    ] as const
                  ).map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(method.id);
                        setIssuedChallengeCode(null);
                        setOtpCode('');
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-2.5 text-xs font-semibold rounded-md border text-left transition-colors cursor-pointer ${
                        paymentMethod === method.id
                          ? 'bg-[#156145]/10 border-[#156145] text-[#156145]'
                          : 'bg-white border-[#D7DDD9] text-[#3B443E] hover:bg-[#F8F9F8]'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'card' && (
                  <div className="bg-[#F8F9F8] border border-[#E3E7E4] rounded-md p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#3B443E] mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        required
                        value={cardHolder}
                        onChange={(e) => setCardHolderOverride(e.target.value)}
                        placeholder="Name on card"
                        className="w-full h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-[#3B443E]">
                          Card Number
                        </label>
                        <span className="text-xs font-mono text-[#5B655E]">
                          {cardDigits.length > 0
                            ? `${cardBrand} · ${cardValidLuhn ? 'Luhn Valid' : 'Check digits'}`
                            : 'Visa · Mastercard · Verve'}
                        </span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="4532 0150 9281 4418"
                        className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#3B443E] mb-1">
                          Expiry (MM/YY)
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="08/29"
                          className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#3B443E] mb-1">
                          CVC
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          required
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                          placeholder="412"
                          className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E3E7E4]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="text-xs font-medium text-[#3B443E]">
                          3D Secure Verification Code
                        </label>
                        <button
                          type="button"
                          onClick={handleIssueVerificationCode}
                          className="text-xs font-semibold text-[#156145] hover:underline cursor-pointer"
                        >
                          Request 3DS Code
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="6-digit 3DS OTP"
                        className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                      />
                      {issuedChallengeCode && (
                        <p className="mt-1.5 text-xs text-[#156145] font-mono">
                          3DS Challenge Issued: {issuedChallengeCode}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {(paymentMethod === 'orange_money' ||
                  paymentMethod === 'africell_money') && (
                  <div className="bg-[#F8F9F8] border border-[#E3E7E4] rounded-md p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#3B443E] mb-1">
                        {paymentMethod === 'orange_money'
                          ? 'Orange Money SL Number'
                          : 'Africell Money Number'}
                      </label>
                      <input
                        type="tel"
                        required
                        value={mobileWalletPhone}
                        onChange={(e) => setMobileWalletPhone(e.target.value)}
                        placeholder="+232 76 555019"
                        className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-xs font-medium text-[#3B443E]">
                          Mobile Wallet Authorization Code
                        </label>
                        <button
                          type="button"
                          onClick={handleIssueVerificationCode}
                          className="text-xs font-semibold text-[#156145] hover:underline cursor-pointer"
                        >
                          Send USSD Prompt
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit approval code"
                        className="w-full h-10 px-3 text-sm font-mono bg-white border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                      />
                      {issuedChallengeCode && (
                        <p className="mt-1.5 text-xs text-[#156145] font-mono">
                          Wallet Prompt Code: {issuedChallengeCode}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {paymentMethod === 'cod' && (
                  <div className="bg-[#F8F9F8] border border-[#E3E7E4] rounded-md p-4 text-xs text-[#3B443E] space-y-1.5">
                    <p className="font-semibold text-[#141715]">
                      Cash on Delivery Terms
                    </p>
                    <p>
                      Pay <strong className="font-mono">{formatLeones(total)}</strong> in
                      Leones or via mobile POS upon arrival. Our Freetown dispatcher will
                      confirm by phone before leaving Wilkinson Road.
                    </p>
                  </div>
                )}
              </div>
            </form>
          )}

          {step === 'confirmed' && confirmed && (
            <div className="space-y-6 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#15803D] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#15803D]">
                    Payment Verified & Stock Reserved
                  </p>
                  <h3 className="font-display text-xl font-bold text-[#141715] mt-0.5">
                    Order {confirmed.orderNumber} Confirmed
                  </h3>
                  <p className="mt-1 text-sm text-[#4F5852]">
                    Inventory quantities have been decremented in real time across the store.
                  </p>
                </div>
              </div>

              <div className="bg-[#F8F9F8] border border-[#E3E7E4] rounded-md p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5B655E]">Payment Reference</span>
                  <span className="font-mono font-semibold text-[#141715]">
                    {confirmed.paymentReference}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B655E]">Method</span>
                  <span className="font-medium text-[#141715]">
                    {confirmed.maskedInstrument}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E3E7E4]">
                  <span className="font-semibold text-[#141715]">Total</span>
                  <span className="font-mono font-bold text-[#156145] tabular-nums">
                    {formatLeones(confirmed.total)}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-[#DCE1DD] rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#156145]">
                  <MailCheck className="w-4 h-4" />
                  <span>Automated Confirmation Email Dispatched</span>
                </div>
                <p className="text-xs text-[#4F5852]">
                  Sent to <strong className="text-[#141715]">{confirmed.recipientEmail}</strong>{' '}
                  ({confirmed.emailRecord.deliveryMode === 'smtp' ? 'SMTP Sent' : 'Logged in Outbox'}).
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onPreviewEmail(confirmed.emailRecord, confirmed.emailHtml)
                  }
                  className="px-3.5 py-2 text-xs font-semibold bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] rounded-md transition-colors cursor-pointer"
                >
                  Inspect Email Receipt
                </button>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleCloseDrawer();
                    onOrderCompleteViewOrders();
                  }}
                  className="w-full h-11 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Track Order in My Orders
                </button>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="w-full h-11 bg-[#F1F3F2] hover:bg-[#E5E9E7] text-[#141715] text-sm font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {step !== 'confirmed' && lineItems.length > 0 && (
          <div className="p-6 border-t border-[#E3E7E4] bg-[#F8F9F8] space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#4F5852]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatLeones(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#4F5852]">
                <span>Delivery ({deliveryZone.split('&')[0].trim()})</span>
                <span className="font-mono tabular-nums">
                  {deliveryFee === 0 ? 'Free' : formatLeones(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#141715] pt-2 border-t border-[#DCE1DD]">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatLeones(total)}</span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full h-11 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Proceed to Secure Checkout</span>
              </button>
            ) : (
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting || !user || !emailVerified}
                className="w-full h-11 bg-[#156145] hover:bg-[#114E37] disabled:bg-[#9CA6A0] text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Verifying Payment & Updating Stock...'
                    : `Authorize & Pay ${formatLeones(total)}`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
