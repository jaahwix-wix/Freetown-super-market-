'use client';

import React, { useMemo, useState } from 'react';
import { Search, Plus, Minus, X, ArrowRight, Check } from 'lucide-react';
import { ProductImage } from './ProductImage';
import { formatLeones } from '@/lib/catalog-seed';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '@/lib/types';

interface StorefrontViewProps {
  products: Product[];
  loading: boolean;
  cartQuantities: Record<string, number>;
  onAddToCart: (product: Product, quantity: number) => void;
  onUpdateCartQty: (productId: string, quantity: number) => void;
  onGoToOrders: () => void;
  onGoToAdminLogin: () => void;
  catalogSectionRef: React.RefObject<HTMLElement | null>;
}

type SortMode = 'featured' | 'price_asc' | 'price_desc' | 'stock_desc';

export function StorefrontView({
  products,
  loading,
  cartQuantities,
  onAddToCart,
  onUpdateCartQty,
  onGoToOrders,
  onGoToAdminLogin,
  catalogSectionRef,
}: StorefrontViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('featured');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = activeProducts.filter((product) => {
      const matchesCat =
        selectedCategory === 'All' || product.category === selectedCategory;
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'price_asc') return a.price - b.price;
      if (sortMode === 'price_desc') return b.price - a.price;
      if (sortMode === 'stock_desc') return b.stockQuantity - a.stockQuantity;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeProducts, selectedCategory, searchQuery, sortMode]);

  const handleQuickAdd = (product: Product, qty: number) => {
    const inBag = cartQuantities[product.id] || 0;
    if (product.stockQuantity - inBag < qty) return;
    onAddToCart(product, qty);
    setRecentlyAddedId(product.id);
    setTimeout(() => {
      setRecentlyAddedId((prev) => (prev === product.id ? null : prev));
    }, 900);
  };

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setModalQty(1);
  };

  const liveModalProduct = selectedProduct
    ? activeProducts.find((p) => p.id === selectedProduct.id) || selectedProduct
    : null;

  return (
    <main className="pb-20">
      {/* Section 1: Storefront Split Hero + 4-Column Full-Width Utility Strip */}
      <section className="border-b border-[#E3E7E4] bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center py-2">
              <p className="text-xs font-medium tracking-wide text-[#156145] mb-3">
                Wilkinson Road · Same-Day Western Area Dispatch
              </p>
              <h1
                className="font-display font-bold text-[#141715] tracking-tight leading-[1.08] text-balance"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
              >
                Daily Freetown groceries, stocked in real time.
              </h1>
              <p className="mt-5 text-base text-[#4F5852] leading-relaxed max-w-xl">
                Order fresh Bo mangoes, Kambia plantains, hearth bread, and pantry staples
                directly from our Freetown shelves. Every checkout reserves live inventory
                and sends an instant email receipt.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="px-6 py-3 min-h-[44px] bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Shop Catalog</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onGoToOrders}
                  className="px-5 py-3 min-h-[44px] bg-[#F1F3F2] hover:bg-[#E5E9E7] text-[#141715] text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Track Orders & Receipts
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 min-h-[280px] lg:min-h-[420px] rounded-lg overflow-hidden border border-[#E3E7E4] bg-[#F1F3F2]">
              <ProductImage
                src="/images/hero_freetown_market_1794745669444.jpg"
                alt="Freetown Supermarket produce baskets and wooden pantry aisles"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* 4-column utility strip directly below hero split */}
          <div className="mt-10 pt-8 border-t border-[#E3E7E4] grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-[#5B655E]">Live Store Inventory</p>
              <p className="mt-1 font-display text-lg font-semibold text-[#141715] tabular-nums">
                {activeProducts.length} Active SKUs
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#5B655E]">Free Delivery Threshold</p>
              <p className="mt-1 font-display text-lg font-semibold text-[#141715] tabular-nums">
                Orders NLe 600+
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#5B655E]">Payment Gateway</p>
              <p className="mt-1 font-display text-lg font-semibold text-[#141715]">
                Card · Orange · Africell
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#5B655E]">Order Notifications</p>
              <p className="mt-1 font-display text-lg font-semibold text-[#141715]">
                Automated Email Alerts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Departments: Cosmetics, Drinks by Crate & Liters of Water by Crate */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-5">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141715] tracking-tight">
              Featured Aisles · Cosmetics, Crate Drinks &amp; Water by Crate
            </h2>
            <p className="mt-1 text-sm text-[#4F5852]">
              Shop beauty essentials, full 24-bottle beverage crates, and 12L–30L water crates.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(
            [
              {
                category: 'Cosmetics' as ProductCategory,
                title: 'Cosmetics & Skincare',
                meta: 'Lotions · Facial Oils · Body Butters',
                description:
                  'Natural shea butter lotions, botanical facial serums, and cocoa vitamin E creams.',
                imageUrl: '/images/product_cosmetics_care_1794748953561.jpg',
              },
              {
                category: 'Drinks by Crate' as ProductCategory,
                title: 'Drinks by Crate',
                meta: '24 Bottles · 12 x 1 L Crates',
                description:
                  'Full wholesale crates of ginger brew, citrus sodas, malt drinks, and tropical juices.',
                imageUrl: '/images/product_drinks_crate_1794748953987.jpg',
              },
              {
                category: 'Water by Crate' as ProductCategory,
                title: 'Liters of Water by Crate',
                meta: '12 Liters · 18 Liters · 30 Liters',
                description:
                  'Pure Guma and Highland spring water crates in 12 x 1.5 L (18L), 6 x 5 L (30L), and 24 x 500 ml (12L).',
                imageUrl: '/images/product_water_crate_1794748953924.jpg',
              },
            ] as const
          ).map((dept) => {
            const deptCount = activeProducts.filter(
              (p) => p.category === dept.category
            ).length;
            const isSelected = selectedCategory === dept.category;
            return (
              <article
                key={dept.category}
                className={`bg-white border rounded-lg overflow-hidden flex flex-col transition-colors ${
                  isSelected ? 'border-[#156145]' : 'border-[#E3E7E4]'
                }`}
              >
                <div className="aspect-[4/3] bg-[#F1F3F2] overflow-hidden">
                  <ProductImage
                    src={dept.imageUrl}
                    alt={dept.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-xs text-[#5B655E]">
                    {dept.meta} · <span className="font-mono tabular-nums">{deptCount} live</span>
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-[#141715]">
                    {dept.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#4F5852] flex-1">
                    {dept.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(dept.category);
                      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="mt-4 h-10 px-4 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md inline-flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Browse {dept.category}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 2: Featured & Full Product Catalog */}
      <section
        ref={catalogSectionRef}
        id="catalog"
        className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-12"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E3E7E4]">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141715] tracking-tight">
              Market Aisles
            </h2>
            <p className="mt-1 text-sm text-[#4F5852]">
              Real-time shelf counts update automatically as Freetown shoppers check out.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#5B655E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cosmetics, crate drinks, water liters..."
                aria-label="Search products"
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] placeholder:text-[#78827B] focus:outline-none focus:border-[#156145]"
              />
            </div>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort products"
              className="h-10 px-3 text-sm bg-white border border-[#D7DDD9] rounded-md text-[#141715] focus:outline-none focus:border-[#156145] cursor-pointer"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="stock_desc">Highest Stock</option>
            </select>
          </div>
        </div>

        {/* Category segmented filter tabs */}
        <div className="py-5 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-[#156145] text-white'
                : 'bg-[#EEF1EF] text-[#3B443E] hover:bg-[#E1E6E3]'
            }`}
          >
            All Aisles
          </button>
          {PRODUCT_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === category
                  ? 'bg-[#156145] text-white'
                  : 'bg-[#EEF1EF] text-[#3B443E] hover:bg-[#E1E6E3]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 pt-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#E3E7E4] rounded-lg overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#EAECEB]" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-1/2 bg-[#EAECEB] rounded" />
                  <div className="h-5 w-3/4 bg-[#EAECEB] rounded" />
                  <div className="h-9 w-full bg-[#EAECEB] rounded mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-[#E3E7E4] rounded-lg p-12 text-center mt-2">
            {activeProducts.length === 0 ? (
              <>
                <p className="font-display text-lg font-semibold text-[#141715]">
                  No stock uploaded yet
                </p>
                <p className="mt-1 text-sm text-[#4F5852] max-w-md mx-auto">
                  The store administrator must log in and upload products and stock quantities
                  before customers can view and add items to their bag.
                </p>
                <button
                  type="button"
                  onClick={onGoToAdminLogin}
                  className="mt-5 px-5 py-2.5 text-sm font-semibold bg-[#156145] text-white rounded-md hover:bg-[#114E37] transition-colors cursor-pointer"
                >
                  Administrator Login & Upload Stock
                </button>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-semibold text-[#141715]">
                  No matching products found
                </p>
                <p className="mt-1 text-sm text-[#4F5852]">
                  Try clearing your search or choosing another supermarket aisle.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="mt-5 px-4 py-2 text-sm font-semibold bg-[#156145] text-white rounded-md hover:bg-[#114E37] transition-colors cursor-pointer"
                >
                  Show All Products
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 pt-2">
            {filteredProducts.map((product) => {
              const inBag = cartQuantities[product.id] || 0;
              const remainingToAdd = Math.max(0, product.stockQuantity - inBag);
              const isOutOfStock = product.stockQuantity <= 0;
              const isLowStock =
                !isOutOfStock && product.stockQuantity <= product.lowStockThreshold;
              const justAdded = recentlyAddedId === product.id;

              return (
                <article
                  key={product.id}
                  className="bg-white border border-[#E3E7E4] rounded-lg overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => openProductModal(product)}
                    className="aspect-[4/3] w-full bg-[#F1F3F2] overflow-hidden text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#156145]"
                  >
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="p-5 flex-1 flex flex-col">
                    {/* Unboxed clean metadata line (Zero-Pill Discipline) */}
                    <p className="text-xs text-[#5B655E] flex items-center gap-1.5 truncate">
                      <span>{product.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.unit}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{product.sku}</span>
                    </p>

                    <button
                      type="button"
                      onClick={() => openProductModal(product)}
                      className="mt-1.5 text-left font-display text-base font-semibold text-[#141715] hover:text-[#156145] transition-colors cursor-pointer"
                    >
                      {product.name}
                    </button>

                    <p className="mt-1.5 text-sm text-[#4F5852] line-clamp-2 flex-1">
                      {product.description}
                    </p>

                    <div className="mt-4 pt-4 border-t border-[#ECEFED] flex items-baseline justify-between gap-2">
                      <span className="font-mono text-base font-semibold text-[#141715] tabular-nums">
                        {formatLeones(product.price)}
                      </span>
                      <span
                        className={`text-xs font-medium tabular-nums ${
                          isOutOfStock
                            ? 'text-[#B91C1C]'
                            : isLowStock
                              ? 'text-[#B45309]'
                              : 'text-[#15803D]'
                        }`}
                      >
                        {isOutOfStock
                          ? 'Out of stock'
                          : isLowStock
                            ? `Low stock · ${product.stockQuantity} left`
                            : `${product.stockQuantity} in stock`}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {inBag > 0 && !isOutOfStock ? (
                        <div className="flex-1 h-10 flex items-center justify-between border border-[#156145] bg-[#ECFDF5] rounded-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onUpdateCartQty(product.id, inBag - 1)}
                            aria-label={`Remove one ${product.name} from bag`}
                            className="w-11 h-full flex items-center justify-center text-[#156145] hover:bg-[#D1FAE5] transition-colors cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-semibold text-[#156145] tabular-nums px-2">
                            {inBag} in bag
                          </span>
                          <button
                            type="button"
                            disabled={remainingToAdd === 0}
                            onClick={() => handleQuickAdd(product, 1)}
                            aria-label={`Add one more ${product.name} to bag`}
                            className="w-11 h-full flex items-center justify-center text-[#156145] hover:bg-[#D1FAE5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isOutOfStock || remainingToAdd === 0}
                          onClick={() => handleQuickAdd(product, 1)}
                          className={`flex-1 h-10 px-4 text-sm font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed ${
                            isOutOfStock || remainingToAdd === 0
                              ? 'bg-[#EEF1EF] text-[#78827B]'
                              : justAdded
                                ? 'bg-[#114E37] text-white'
                                : 'bg-[#156145] hover:bg-[#114E37] text-white'
                          }`}
                        >
                          {isOutOfStock ? (
                            <span>Unavailable</span>
                          ) : remainingToAdd === 0 ? (
                            <span>Max Stock in Bag ({inBag})</span>
                          ) : justAdded ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Added ({inBag})</span>
                            </>
                          ) : (
                            <span>Add to Bag</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Sourcing & Delivery Coverage */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-16">
        <div className="bg-white border border-[#E3E7E4] rounded-lg p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-medium text-[#156145]">
              Freetown Cold-Chain & Sourcing
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-[#141715] text-balance">
              Direct from Bo, Kenema, and Waterloo farms to your doorstep.
            </h2>
            <p className="mt-3 text-sm text-[#4F5852] leading-relaxed max-w-2xl">
              Our Wilkinson Road fulfillment floor receives produce harvests every morning at
              6:00 AM. Every item you add to your bag checks live shelf availability before
              payment, preventing backorders and guaranteeing accurate dispatch across Central
              Freetown, Lumley, Aberdeen, Hill Station, and Kissy.
            </p>
          </div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-6 border-t lg:border-t-0 lg:border-l border-[#E3E7E4] pt-6 lg:pt-0 lg:pl-8">
            <div>
              <p className="font-mono text-2xl font-bold text-[#141715] tabular-nums">
                45 min
              </p>
              <p className="mt-1 text-xs text-[#5B655E]">
                Average central dispatch window
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-[#141715] tabular-nums">
                100%
              </p>
              <p className="mt-1 text-xs text-[#5B655E]">
                Automated email confirmation coverage
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-[#141715] tabular-nums">
                6 Zones
              </p>
              <p className="mt-1 text-xs text-[#5B655E]">
                Greater Freetown courier coverage
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-bold text-[#141715] tabular-nums">
                Live
              </p>
              <p className="mt-1 text-xs text-[#5B655E]">
                Atomic transaction stock locks
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Detail Modal (Contiguous Purchase Module) */}
      {liveModalProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdp-title"
        >
          <div className="w-full max-w-3xl bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
            <div className="aspect-[4/3] md:aspect-auto bg-[#F1F3F2] relative">
              <ProductImage
                src={liveModalProduct.imageUrl}
                alt={liveModalProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs text-[#5B655E]">
                    {liveModalProduct.category} · <span className="font-mono">{liveModalProduct.sku}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close product details"
                    className="p-1.5 rounded-md text-[#4F5852] hover:bg-[#EEF1EF] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h2
                  id="pdp-title"
                  className="mt-2 font-display text-2xl font-bold text-[#141715]"
                >
                  {liveModalProduct.name}
                </h2>
                <p className="mt-1 text-xs text-[#5B655E]">Unit: {liveModalProduct.unit}</p>

                <p className="mt-4 font-mono text-2xl font-bold text-[#141715] tabular-nums">
                  {formatLeones(liveModalProduct.price)}
                </p>

                <p className="mt-4 text-sm text-[#4F5852] leading-relaxed">
                  {liveModalProduct.description}
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-[#E3E7E4]">
                {(() => {
                  const inBag = cartQuantities[liveModalProduct.id] || 0;
                  const maxAdd = Math.max(0, liveModalProduct.stockQuantity - inBag);
                  const clampedQty = Math.min(modalQty, Math.max(1, maxAdd));
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs mb-4">
                        <span className="text-[#5B655E]">Live Store Shelf Stock</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            liveModalProduct.stockQuantity <= 0
                              ? 'text-[#B91C1C]'
                              : liveModalProduct.stockQuantity <=
                                  liveModalProduct.lowStockThreshold
                                ? 'text-[#B45309]'
                                : 'text-[#15803D]'
                          }`}
                        >
                          {liveModalProduct.stockQuantity <= 0
                            ? 'Out of stock'
                            : `${liveModalProduct.stockQuantity} units available`}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-[#D7DDD9] rounded-md h-11">
                          <button
                            type="button"
                            disabled={clampedQty <= 1 || maxAdd === 0}
                            onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                            aria-label="Decrease quantity"
                            className="w-10 h-full flex items-center justify-center text-[#141715] hover:bg-[#F1F3F2] disabled:opacity-40 cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center font-mono text-sm font-semibold tabular-nums">
                            {maxAdd === 0 ? 0 : clampedQty}
                          </span>
                          <button
                            type="button"
                            disabled={clampedQty >= maxAdd || maxAdd === 0}
                            onClick={() => setModalQty((q) => Math.min(maxAdd, q + 1))}
                            aria-label="Increase quantity"
                            className="w-10 h-full flex items-center justify-center text-[#141715] hover:bg-[#F1F3F2] disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={maxAdd === 0}
                          onClick={() => {
                            handleQuickAdd(liveModalProduct, clampedQty);
                            setSelectedProduct(null);
                          }}
                          className="flex-1 h-11 px-5 bg-[#156145] hover:bg-[#114E37] disabled:bg-[#EEF1EF] disabled:text-[#78827B] text-white text-sm font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          {maxAdd === 0
                            ? 'Out of Stock'
                            : `Add to Bag · ${formatLeones(
                                liveModalProduct.price * clampedQty
                              )}`}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
