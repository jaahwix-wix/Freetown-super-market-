'use client';

import React, { useState } from 'react';
import {
  Store,
  LayoutGrid,
  Package,
  ClipboardList,
  ShoppingBag,
  LogIn,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from './AuthProvider';

export type ActiveView = 'storefront' | 'orders' | 'inventory';

interface HeaderNavProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  bagCount: number;
  onOpenBag: () => void;
  onScrollToCatalog: () => void;
}

export function HeaderNav({
  activeView,
  onSelectView,
  bagCount,
  onOpenBag,
  onScrollToCatalog,
}: HeaderNavProps) {
  const { user, isAdmin, openAuthModal, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (view: ActiveView, scrollCatalog = false) => {
    onSelectView(view);
    setMobileMenuOpen(false);
    if (scrollCatalog) {
      setTimeout(onScrollToCatalog, 50);
    }
  };

  const renderMenuContent = (onCloseMobile?: () => void) => (
    <div className="flex flex-col h-full justify-between p-5">
      <div>
        {/* Brand Wordmark */}
        <div className="flex items-center justify-between gap-2 pb-5 border-b border-[#E3E7E4]">
          <button
            type="button"
            onClick={() => handleNavigate('storefront')}
            className="font-display text-lg font-bold tracking-tight text-[#141715] text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#156145]"
          >
            Freetown Supermarket
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close main menu"
              className="p-1.5 rounded-md text-[#4F5852] hover:bg-[#F1F3F2] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary Left-Hand Navigation Links */}
        <nav aria-label="Main menu" className="mt-5 space-y-1.5">
          <button
            type="button"
            onClick={() => handleNavigate('storefront')}
            className={`w-full px-3.5 py-2.5 min-h-[42px] rounded-md text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'storefront'
                ? 'bg-[#156145]/10 text-[#156145] font-semibold'
                : 'text-[#4F5852] hover:bg-[#F1F3F2] hover:text-[#141715]'
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span>Storefront</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('storefront', true)}
            className="w-full px-3.5 py-2.5 min-h-[42px] rounded-md text-sm font-medium text-[#4F5852] hover:bg-[#F1F3F2] hover:text-[#141715] flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('orders')}
            className={`w-full px-3.5 py-2.5 min-h-[42px] rounded-md text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
              activeView === 'orders'
                ? 'bg-[#156145]/10 text-[#156145] font-semibold'
                : 'text-[#4F5852] hover:bg-[#F1F3F2] hover:text-[#141715]'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>My Orders</span>
          </button>

          {(isAdmin || !user) && (
            <button
              type="button"
              onClick={() => handleNavigate('inventory')}
              className={`w-full px-3.5 py-2.5 min-h-[42px] rounded-md text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                activeView === 'inventory'
                  ? 'bg-[#156145]/10 text-[#156145] font-semibold'
                  : 'text-[#4F5852] hover:bg-[#F1F3F2] hover:text-[#141715]'
              }`}
            >
              {isAdmin ? (
                <ClipboardList className="w-4 h-4 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              )}
              <span>{isAdmin ? 'Admin Console' : 'Admin Login'}</span>
            </button>
          )}
        </nav>

        {/* Primary Action: Shopping Bag */}
        <div className="mt-6 pt-5 border-t border-[#E3E7E4]">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenBag();
            }}
            className="w-full px-4 py-2.5 min-h-[44px] bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md transition-colors flex items-center justify-between whitespace-nowrap tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#156145]"
          >
            <span className="inline-flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Shopping Bag</span>
            </span>
            <span className="font-mono">{bagCount}</span>
          </button>
        </div>
      </div>

      {/* Bottom Account Section */}
      <div className="pt-4 border-t border-[#E3E7E4] space-y-3">
        {user ? (
          <>
            <div className="px-1">
              <p className="text-xs font-semibold text-[#141715] truncate">
                {user.displayName || 'Customer Account'}
              </p>
              <p className="text-xs text-[#5B655E] truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              className="w-full px-3.5 py-2 min-h-[40px] bg-[#F1F3F2] hover:bg-[#E5E9E7] text-[#141715] text-xs font-semibold rounded-md flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              openAuthModal('customer', 'signin');
            }}
            className="w-full px-3.5 py-2.5 min-h-[40px] bg-[#F1F3F2] hover:bg-[#E5E9E7] text-[#141715] text-xs font-semibold rounded-md flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left-Hand Persistent Sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className="hidden lg:block w-64 shrink-0 bg-white border-r border-[#E3E7E4] sticky top-0 h-screen"
      >
        {renderMenuContent()}
      </aside>

      {/* Mobile / Tablet Compact Top Bar + Left Slide-Out Drawer */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E3E7E4]">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open left navigation menu"
              className="p-2 -ml-2 rounded-md text-[#141715] hover:bg-[#F1F3F2] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('storefront')}
              className="font-display text-base font-bold tracking-tight text-[#141715] truncate cursor-pointer"
            >
              Freetown Supermarket
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenBag}
            className="px-3.5 py-2 min-h-[38px] bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer"
          >
            Bag ({bagCount})
          </button>
        </div>
      </header>

      {/* Mobile Left-Hand Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/45"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-72 max-w-[85vw] bg-white h-full border-r border-[#DCE1DD] shadow-2xl">
            {renderMenuContent(() => setMobileMenuOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
