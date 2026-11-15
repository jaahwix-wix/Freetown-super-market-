'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OperationType, handleFirestoreError } from '@/lib/firestore-errors';
import { useAuth } from './AuthProvider';
import { HeaderNav, type ActiveView } from './HeaderNav';
import { StorefrontView } from './StorefrontView';
import { OrdersView } from './OrdersView';
import { InventoryDashboard } from './InventoryDashboard';
import { CheckoutDrawer } from './CheckoutDrawer';
import { EmailPreviewModal } from './EmailPreviewModal';
import { PrintSheetModal, type PrintJob } from './PrintSheetModal';
import { AuthModal } from './AuthModal';
import type { CartItem, EmailNotificationRecord, Product } from '@/lib/types';

const BAG_STORAGE_KEY = 'freetown_supermarket_bag_v1';

export function FreetownApp() {
  const { user, authReady, isAdmin } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('storefront');
  const [bagOpen, setBagOpen] = useState(false);
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [previewEmail, setPreviewEmail] = useState<EmailNotificationRecord | null>(null);
  const [previewEmailHtml, setPreviewEmailHtml] = useState<string | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);

  const catalogSectionRef = useRef<HTMLElement | null>(null);

  // Load persisted shopping bag
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(BAG_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as CartItem[];
          if (Array.isArray(parsed)) setCart(parsed);
        }
      } catch {
        // ignore storage errors
      }
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  // Real-time Firestore product stock listener
  useEffect(() => {
    if (!authReady) return;
    const productsPath = 'products';
    const unsubscribe = onSnapshot(
      collection(db, productsPath),
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as Product);
        setFirestoreProducts(list);
        setProductsLoading(false);
      },
      (error) => {
        setProductsLoading(false);
        handleFirestoreError(error, OperationType.LIST, productsPath);
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  const isLiveFirestoreCatalog = firestoreProducts.length > 0;
  const displayProducts: Product[] = firestoreProducts;

  // Sync bag quantities against live stock ceilings
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      const prod = displayProducts.find((p) => p.id === item.productId);
      if (prod && prod.active && prod.stockQuantity > 0) {
        map[item.productId] = Math.min(item.quantity, prod.stockQuantity);
      }
    }
    return map;
  }, [cart, displayProducts]);

  const bagCount = useMemo(
    () => Object.values(cartQuantities).reduce((sum, q) => sum + q, 0),
    [cartQuantities]
  );

  const handleAddToCart = useCallback((product: Product, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      const nextQty = Math.min(
        product.stockQuantity,
        (existing ? existing.quantity : 0) + quantity
      );
      if (nextQty <= 0) return prev;
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: nextQty } : c
        );
      }
      return [...prev, { productId: product.id, quantity: nextQty }];
    });
  }, []);

  const handleUpdateQty = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((c) => c.productId !== productId));
        return;
      }
      const prod = displayProducts.find((p) => p.id === productId);
      const maxStock = prod ? prod.stockQuantity : quantity;
      const clamped = Math.min(quantity, maxStock);
      setCart((prev) =>
        prev.map((c) => (c.productId === productId ? { ...c, quantity: clamped } : c))
      );
    },
    [displayProducts]
  );

  const handleRemoveItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  const handlePreviewEmail = useCallback(
    (email: EmailNotificationRecord, htmlBody?: string | null) => {
      setPreviewEmail(email);
      setPreviewEmailHtml(htmlBody || null);
    },
    []
  );

  // Signed-in non-admin customers are kept out of Admin Console; signed-out visitors can reach Admin Login gate
  const effectiveView: ActiveView =
    activeView === 'inventory' && Boolean(user) && !isAdmin ? 'storefront' : activeView;
  const hideChromeForPrint = Boolean(printJob || previewEmail);

  return (
    <>
      <div
        className={`min-h-screen flex flex-col lg:flex-row ${
          hideChromeForPrint ? 'no-print' : ''
        }`}
      >
        <HeaderNav
          activeView={effectiveView}
          onSelectView={setActiveView}
          bagCount={bagCount}
          onOpenBag={() => setBagOpen(true)}
          onScrollToCatalog={() =>
            catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
          }
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1">
            {effectiveView === 'storefront' && (
              <StorefrontView
                products={displayProducts}
                loading={productsLoading}
                cartQuantities={cartQuantities}
                onAddToCart={handleAddToCart}
                onUpdateCartQty={handleUpdateQty}
                onGoToOrders={() => setActiveView('orders')}
                onGoToAdminLogin={() => setActiveView('inventory')}
                catalogSectionRef={catalogSectionRef}
              />
            )}

            {effectiveView === 'orders' && (
              <OrdersView
                onPreviewEmail={(eml) => handlePreviewEmail(eml)}
                onGoToStorefront={() => setActiveView('storefront')}
              />
            )}

            {effectiveView === 'inventory' && (!user || isAdmin) && (
              <InventoryDashboard
                products={displayProducts}
                isLiveFirestoreCatalog={isLiveFirestoreCatalog}
                onPreviewEmail={handlePreviewEmail}
                onPrint={(job) => setPrintJob(job)}
              />
            )}
          </div>

          <footer className="border-t border-[#E3E7E4] bg-white py-8">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#5B655E]">
              <div>
                <span className="font-display font-semibold text-[#141715]">
                  Freetown Supermarket
                </span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>Wilkinson Road, Freetown, Sierra Leone</span>
              </div>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setActiveView('storefront')}
                  className="hover:text-[#141715] cursor-pointer"
                >
                  Storefront
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('orders')}
                  className="hover:text-[#141715] cursor-pointer"
                >
                  My Orders
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveView('inventory')}
                    className="hover:text-[#141715] cursor-pointer"
                  >
                    Admin Console
                  </button>
                )}
              </div>
            </div>
          </footer>
        </div>

        <CheckoutDrawer
          open={bagOpen}
          onClose={() => setBagOpen(false)}
          cart={cart}
          products={displayProducts}
          isLiveFirestoreCatalog={isLiveFirestoreCatalog}
          onUpdateQty={handleUpdateQty}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOrderCompleteViewOrders={() => setActiveView('orders')}
          onPreviewEmail={handlePreviewEmail}
        />
      </div>

      <EmailPreviewModal
        email={previewEmail}
        htmlOverride={previewEmailHtml}
        canPrint={isAdmin}
        onClose={() => {
          setPreviewEmail(null);
          setPreviewEmailHtml(null);
        }}
      />

      <PrintSheetModal job={printJob} onClose={() => setPrintJob(null)} />
      <AuthModal />
    </>
  );
}
