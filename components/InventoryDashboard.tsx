'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  deleteDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Plus,
  Search,
  RefreshCw,
  MailCheck,
  ShieldAlert,
  Pencil,
  Trash2,
  Printer,
  EyeOff,
  Eye,
  X,
  Upload,
  FileSpreadsheet,
  ImagePlus,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { OperationType, handleFirestoreError } from '@/lib/firestore-errors';
import { makeEmailId, makeLogId, makeProductId, makeSku } from '@/lib/id-utils';
import { useAuth } from './AuthProvider';
import { UsernamePasswordAuthCard } from './AuthModal';
import { ProductImage } from './ProductImage';
import type { PrintJob } from './PrintSheetModal';
import {
  INITIAL_FREETOWN_CATALOG,
  STUDIO_IMAGE_OPTIONS,
  formatLeones,
} from '@/lib/catalog-seed';
import {
  PRODUCT_CATEGORIES,
  type EmailEventType,
  type EmailNotificationRecord,
  type InventoryLogRecord,
  type OrderItemRecord,
  type OrderRecord,
  type OrderStatus,
  type Product,
  type ProductCategory,
} from '@/lib/types';

interface InventoryDashboardProps {
  products: Product[];
  isLiveFirestoreCatalog: boolean;
  onPreviewEmail: (email: EmailNotificationRecord, htmlBody?: string | null) => void;
  onPrint: (job: PrintJob) => void;
}

type ConfirmDeleteTarget =
  | { kind: 'product'; product: Product }
  | { kind: 'order'; order: OrderRecord }
  | { kind: 'log'; log: InventoryLogRecord }
  | { kind: 'email'; email: EmailNotificationRecord };

type ConsoleTab = 'catalog' | 'orders' | 'logs' | 'emails';

function toMillis(ts: unknown): number {
  if (
    ts &&
    typeof ts === 'object' &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function formatTs(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nextStatusFor(status: OrderStatus): {
  next: OrderStatus;
  label: string;
  eventType: EmailEventType;
} | null {
  switch (status) {
    case 'confirmed':
      return { next: 'packing', label: 'Start Packing', eventType: 'status_packing' };
    case 'packing':
      return {
        next: 'out_for_delivery',
        label: 'Dispatch Rider',
        eventType: 'status_out_for_delivery',
      };
    case 'out_for_delivery':
      return {
        next: 'delivered',
        label: 'Mark Delivered',
        eventType: 'status_delivered',
      };
    default:
      return null;
  }
}

const DEFAULT_IMAGE_BY_CATEGORY: Record<ProductCategory, string> = {
  'Fresh Produce': STUDIO_IMAGE_OPTIONS[0].url,
  'Pantry & Grains': STUDIO_IMAGE_OPTIONS[1].url,
  'Bakery & Dairy': STUDIO_IMAGE_OPTIONS[2].url,
  'Chilled & Beverages': STUDIO_IMAGE_OPTIONS[3].url,
  Cosmetics: STUDIO_IMAGE_OPTIONS[4].url,
  'Drinks by Crate': STUDIO_IMAGE_OPTIONS[5].url,
  'Water by Crate': STUDIO_IMAGE_OPTIONS[6].url,
  'Household & Care': STUDIO_IMAGE_OPTIONS[1].url,
};

const SAMPLE_5_ITEM_CSV = [
  'sku,name,category,unit,price,stockQuantity,description',
  'FS-COS-501,Nurture Shea Butter Lotion,Cosmetics,250 ml pump,125,5,Moisturizing West African shea butter body lotion for smooth daily skin care.',
  'FS-COS-502,Botanical Glow Facial Serum,Cosmetics,30 ml dropper,145,5,Cold-pressed nourishing beauty oil serum for radiant daily skincare.',
  'FS-DRK-503,Ginger & Citrus Soda Crate (24 Bottles),Drinks by Crate,1 crate (24 x 330 ml),310,5,Full crate of 24 chilled glass bottles of ginger beer and citrus soda.',
  'FS-WAT-504,Guma Pure Spring Water Crate (18 Liters),Water by Crate,1 crate (12 x 1.5 L · 18L),145,5,Full 18-liter crate containing twelve 1.5-liter pure spring water bottles.',
  'FS-WAT-505,Highland Water Family Crate (30 Liters),Water by Crate,1 crate (6 x 5 L · 30L),195,5,Bulk 30-liter water crate with six 5-liter pure spring water bottles.',
].join('\n');

interface ParsedStockRow {
  rowNumber: number;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  price: number;
  stockQuantity: number;
  description: string;
  imageUrl: string;
  valid: boolean;
  error?: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseBulkStockCsv(text: string): ParsedStockRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const rows: ParsedStockRow[] = [];
  lines.forEach((line, idx) => {
    const cols = parseCsvLine(line);
    if (
      idx === 0 &&
      cols[0]?.toLowerCase() === 'sku' &&
      cols[1]?.toLowerCase() === 'name'
    ) {
      return;
    }

    const sku = (cols[0] || '').slice(0, 40);
    const name = (cols[1] || '').slice(0, 120);
    const rawCat = (cols[2] || '').trim();
    const matchedCategory =
      PRODUCT_CATEGORIES.find(
        (c) => c.toLowerCase() === rawCat.toLowerCase()
      ) || null;
    const unit = (cols[3] || '').slice(0, 40);
    const price = Number(cols[4]);
    const stockQuantity = Number(cols[5]);
    const description = (cols[6] || `${name} - Freetown Supermarket`).slice(0, 500);
    const customImg = (cols[7] || '').trim().slice(0, 500);

    let error: string | undefined;
    if (sku.length < 2) error = 'SKU must be at least 2 characters.';
    else if (name.length < 2) error = 'Product name must be at least 2 characters.';
    else if (!matchedCategory)
      error = `Category must be one of: ${PRODUCT_CATEGORIES.join(', ')}`;
    else if (unit.length < 1) error = 'Unit is required (e.g. 1 kg).';
    else if (!Number.isFinite(price) || price <= 0 || price > 1000000)
      error = 'Price must be greater than 0.';
    else if (
      !Number.isInteger(stockQuantity) ||
      stockQuantity < 0 ||
      stockQuantity > 1000000
    )
      error = 'Stock quantity must be a whole number >= 0.';
    else if (description.length < 4)
      error = 'Description must be at least 4 characters.';

    const category: ProductCategory = matchedCategory || 'Fresh Produce';
    const imageUrl = customImg || DEFAULT_IMAGE_BY_CATEGORY[category];

    rows.push({
      rowNumber: idx + 1,
      sku,
      name,
      category,
      unit,
      price: Number.isFinite(price) ? price : 0,
      stockQuantity: Number.isInteger(stockQuantity) ? stockQuantity : 0,
      description,
      imageUrl,
      valid: !error,
      error,
    });
  });

  return rows;
}

export function InventoryDashboard({
  products,
  isLiveFirestoreCatalog,
  onPreviewEmail,
  onPrint,
}: InventoryDashboardProps) {
  const { user, emailVerified, authReady, isAdmin, isBootstrappedAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<ConsoleTab>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'All' | ProductCategory>('All');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [logs, setLogs] = useState<InventoryLogRecord[]>([]);
  const [emails, setEmails] = useState<EmailNotificationRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteTarget | null>(null);

  // Add / Edit product modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('Fresh Produce');
  const [formDescription, setFormDescription] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formPrice, setFormPrice] = useState('50');
  const [formStock, setFormStock] = useState('5');
  const [formThreshold, setFormThreshold] = useState('5');
  const [formImage, setFormImage] = useState(STUDIO_IMAGE_OPTIONS[0].url);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formActive, setFormActive] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk Stock Upload modal state
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState(SAMPLE_5_ITEM_CSV);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !user || !isBootstrappedAdmin) return;

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as OrderRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setOrders(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    const unsubLogs = onSnapshot(
      collection(db, 'inventoryLogs'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as InventoryLogRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setLogs(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventoryLogs')
    );

    const unsubEmails = onSnapshot(
      collection(db, 'emailNotifications'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as EmailNotificationRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setEmails(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'emailNotifications')
    );

    return () => {
      unsubOrders();
      unsubLogs();
      unsubEmails();
    };
  }, [authReady, user, isBootstrappedAdmin]);

  const liveProducts = useMemo(
    () => (isLiveFirestoreCatalog ? products : []),
    [isLiveFirestoreCatalog, products]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return liveProducts.filter((p) => {
      const catOk = catFilter === 'All' || p.category === catFilter;
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [liveProducts, searchQuery, catFilter]);

  const totalUnits = useMemo(
    () => liveProducts.reduce((sum, p) => sum + Math.max(0, p.stockQuantity), 0),
    [liveProducts]
  );

  const lowStockCount = useMemo(
    () =>
      liveProducts.filter((p) => p.active && p.stockQuantity <= p.lowStockThreshold)
        .length,
    [liveProducts]
  );

  const pendingOrdersCount = useMemo(
    () =>
      orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
    [orders]
  );

  const parsedBulkRows = useMemo(
    () => parseBulkStockCsv(bulkCsvText),
    [bulkCsvText]
  );
  const validBulkRows = useMemo(
    () => parsedBulkRows.filter((r) => r.valid),
    [parsedBulkRows]
  );

  const handleSeedProducts = async (limit?: number) => {
    if (!user || !isAdmin) return;
    setSeeding(true);
    setNotice(null);
    try {
      const sourceList =
        typeof limit === 'number'
          ? INITIAL_FREETOWN_CATALOG.slice(0, limit)
          : INITIAL_FREETOWN_CATALOG;
      const batch = writeBatch(db);
      let addedCount = 0;
      for (const item of sourceList) {
        const existing = liveProducts.find((p) => p.id === item.id);
        if (existing) continue;
        addedCount++;
        batch.set(doc(db, 'products', item.id), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const logId = makeLogId('seed', item.id);
        batch.set(doc(db, 'inventoryLogs', logId), {
          id: logId,
          productId: item.id,
          productName: item.name,
          sku: item.sku,
          previousStock: 0,
          newStock: item.stockQuantity,
          delta: item.stockQuantity,
          reason: 'initial_seed',
          actorUid: user.uid,
          actorEmail: (user.email || 'admin').slice(0, 160),
          orderId: '',
          createdAt: serverTimestamp(),
        });
      }
      if (addedCount > 0) {
        await batch.commit();
        setNotice(
          `Uploaded ${addedCount} starter product${addedCount === 1 ? '' : 's'} to the live storefront.`
        );
      } else {
        setNotice('All starter products are already live in Firestore.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setSeeding(false);
    }
  };

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkError(null);
    try {
      const text = await file.text();
      setBulkCsvText(text);
    } catch {
      setBulkError('Unable to read the selected CSV file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCommitBulkUpload = async () => {
    if (!user || !isAdmin) return;
    if (validBulkRows.length === 0) {
      setBulkError('Please provide at least one valid product row before uploading.');
      return;
    }

    setBulkUploading(true);
    setBulkError(null);
    try {
      const batch = writeBatch(db);
      let createdCount = 0;
      let updatedCount = 0;

      for (const row of validBulkRows.slice(0, 200)) {
        const existing = liveProducts.find(
          (p) => p.sku.toLowerCase() === row.sku.toLowerCase()
        );

        if (existing) {
          updatedCount++;
          batch.update(doc(db, 'products', existing.id), {
            sku: row.sku,
            name: row.name,
            category: row.category,
            description: row.description,
            unit: row.unit,
            price: row.price,
            stockQuantity: row.stockQuantity,
            imageUrl: row.imageUrl,
            active: true,
            updatedAt: serverTimestamp(),
          });

          if (row.stockQuantity !== existing.stockQuantity) {
            const logId = makeLogId('blk', existing.id);
            batch.set(doc(db, 'inventoryLogs', logId), {
              id: logId,
              productId: existing.id,
              productName: row.name,
              sku: row.sku,
              previousStock: Math.floor(existing.stockQuantity),
              newStock: row.stockQuantity,
              delta: row.stockQuantity - Math.floor(existing.stockQuantity),
              reason:
                row.stockQuantity > existing.stockQuantity
                  ? 'manual_restock'
                  : 'inventory_adjustment',
              actorUid: user.uid,
              actorEmail: (user.email || 'admin').slice(0, 160),
              orderId: '',
              createdAt: serverTimestamp(),
            });
          }
        } else {
          createdCount++;
          const productId = makeProductId(`${row.name}_${row.sku}`);
          batch.set(doc(db, 'products', productId), {
            id: productId,
            sku: row.sku,
            name: row.name,
            category: row.category,
            description: row.description,
            unit: row.unit,
            price: row.price,
            stockQuantity: row.stockQuantity,
            lowStockThreshold: 5,
            imageUrl: row.imageUrl,
            featured: false,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const logId = makeLogId('blk', productId);
          batch.set(doc(db, 'inventoryLogs', logId), {
            id: logId,
            productId,
            productName: row.name,
            sku: row.sku,
            previousStock: 0,
            newStock: row.stockQuantity,
            delta: row.stockQuantity,
            reason: 'manual_restock',
            actorUid: user.uid,
            actorEmail: (user.email || 'admin').slice(0, 160),
            orderId: '',
            createdAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      setShowBulkUpload(false);
      setNotice(
        `Bulk stock upload complete: ${createdCount} new product${
          createdCount === 1 ? '' : 's'
        } added${
          updatedCount > 0 ? ` and ${updatedCount} existing SKU(s) updated` : ''
        }. Customers can now view and add them immediately.`
      );
    } catch (error) {
      setBulkError(
        error instanceof Error ? error.message : 'Failed to upload stock batch.'
      );
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleAdjustStock = async (product: Product, delta: number) => {
    if (!user || !isAdmin) return;
    const newStock = Math.max(0, Math.floor(product.stockQuantity) + delta);
    if (newStock === product.stockQuantity) return;

    setBusyId(product.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'products', product.id), {
        stockQuantity: newStock,
        updatedAt: serverTimestamp(),
      });
      const logId = makeLogId('adj', product.id);
      batch.set(doc(db, 'inventoryLogs', logId), {
        id: logId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        previousStock: Math.floor(product.stockQuantity),
        newStock,
        delta: newStock - Math.floor(product.stockQuantity),
        reason: delta > 0 ? 'manual_restock' : 'inventory_adjustment',
        actorUid: user.uid,
        actorEmail: (user.email || 'admin').slice(0, 160),
        orderId: '',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setFormSku(makeSku());
    setFormName('');
    setFormCategory('Fresh Produce');
    setFormDescription('');
    setFormUnit('1 kg');
    setFormPrice('50');
    setFormStock('5');
    setFormThreshold('5');
    setFormImage(STUDIO_IMAGE_OPTIONS[0].url);
    setFormFeatured(false);
    setFormActive(true);
    setImageUploadError(null);
    setFormError(null);
    setShowProductForm(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormDescription(p.description);
    setFormUnit(p.unit);
    setFormPrice(String(p.price));
    setFormStock(String(p.stockQuantity));
    setFormThreshold(String(p.lowStockThreshold));
    setFormImage(p.imageUrl);
    setFormFeatured(p.featured);
    setFormActive(p.active);
    setImageUploadError(null);
    setFormError(null);
    setShowProductForm(true);
  };

  const handleUploadProductImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadError(null);
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setImageUploadError(data.error || 'Image upload failed.');
        return;
      }
      setFormImage(String(data.url));
    } catch {
      setImageUploadError('Network error while uploading image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setFormError(null);

    const skuClean = formSku.trim().slice(0, 40);
    const nameClean = formName.trim().slice(0, 120);
    const descClean = (formDescription.trim() || `${nameClean} - Freetown Supermarket`).slice(0, 500);
    const unitClean = (formUnit.trim() || '1 unit').slice(0, 40);
    const imageClean = formImage.trim().slice(0, 500);
    const priceNum = Number(formPrice);
    const stockNum = Math.max(0, Math.floor(Number(formStock)));
    const threshNum = Math.max(0, Math.floor(Number(formThreshold)));

    if (skuClean.length < 2) {
      setFormError('SKU must be at least 2 characters.');
      return;
    }
    if (nameClean.length < 2) {
      setFormError('Product name must be at least 2 characters.');
      return;
    }
    if (descClean.length < 4) {
      setFormError('Description must be at least 4 characters.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFormError('Price must be greater than 0.');
      return;
    }
    if (!imageClean) {
      setFormError('Please select a studio photo or upload an image.');
      return;
    }

    const productId = editingProduct
      ? editingProduct.id
      : makeProductId(nameClean);

    setBusyId(productId);
    try {
      const batch = writeBatch(db);
      if (editingProduct) {
        batch.update(doc(db, 'products', productId), {
          sku: skuClean,
          name: nameClean,
          category: formCategory,
          description: descClean,
          unit: unitClean,
          price: priceNum,
          stockQuantity: stockNum,
          lowStockThreshold: threshNum,
          imageUrl: imageClean,
          featured: formFeatured,
          active: formActive,
          updatedAt: serverTimestamp(),
        });

        if (stockNum !== editingProduct.stockQuantity) {
          const logId = makeLogId('edit', productId);
          batch.set(doc(db, 'inventoryLogs', logId), {
            id: logId,
            productId,
            productName: nameClean,
            sku: skuClean,
            previousStock: Math.floor(editingProduct.stockQuantity),
            newStock: stockNum,
            delta: stockNum - Math.floor(editingProduct.stockQuantity),
            reason:
              stockNum > editingProduct.stockQuantity
                ? 'manual_restock'
                : 'inventory_adjustment',
            actorUid: user.uid,
            actorEmail: (user.email || 'admin').slice(0, 160),
            orderId: '',
            createdAt: serverTimestamp(),
          });
        }
      } else {
        batch.set(doc(db, 'products', productId), {
          id: productId,
          sku: skuClean,
          name: nameClean,
          category: formCategory,
          description: descClean,
          unit: unitClean,
          price: priceNum,
          stockQuantity: stockNum,
          lowStockThreshold: threshNum,
          imageUrl: imageClean,
          featured: formFeatured,
          active: formActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const logId = makeLogId('new', productId);
        batch.set(doc(db, 'inventoryLogs', logId), {
          id: logId,
          productId,
          productName: nameClean,
          sku: skuClean,
          previousStock: 0,
          newStock: stockNum,
          delta: stockNum,
          reason: 'manual_restock',
          actorUid: user.uid,
          actorEmail: (user.email || 'admin').slice(0, 160),
          orderId: '',
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setShowProductForm(false);
      setNotice(
        editingProduct
          ? `Updated ${formName.trim()} in real time.`
          : `Added ${formName.trim()} to storefront catalog.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${productId}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleProductActive = async (product: Product) => {
    if (!user || !isAdmin) return;
    setBusyId(product.id);
    try {
      const nextActive = !product.active;
      await updateDoc(doc(db, 'products', product.id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
      setNotice(
        nextActive
          ? `Restored ${product.name} to the storefront.`
          : `Removed ${product.name} from the public storefront.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDeleteExecute = async () => {
    if (!user || !isAdmin || !confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);

    if (target.kind === 'product') {
      setBusyId(target.product.id);
      try {
        await deleteDoc(doc(db, 'products', target.product.id));
        setNotice(`Permanently deleted ${target.product.name}.`);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `products/${target.product.id}`
        );
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (target.kind === 'order') {
      setBusyId(target.order.id);
      try {
        const itemsSnap = await getDocs(
          collection(db, 'orders', target.order.id, 'items')
        );
        const batch = writeBatch(db);
        itemsSnap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(doc(db, 'orders', target.order.id));
        await batch.commit();
        setNotice(`Permanently deleted order ${target.order.orderNumber}.`);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `orders/${target.order.id}`
        );
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (target.kind === 'log') {
      setBusyId(target.log.id);
      try {
        await deleteDoc(doc(db, 'inventoryLogs', target.log.id));
        setNotice(`Deleted audit log entry for ${target.log.sku}.`);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `inventoryLogs/${target.log.id}`
        );
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (target.kind === 'email') {
      setBusyId(target.email.id);
      try {
        await deleteDoc(doc(db, 'emailNotifications', target.email.id));
        setNotice(`Deleted email record for ${target.email.orderNumber}.`);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `emailNotifications/${target.email.id}`
        );
      } finally {
        setBusyId(null);
      }
    }
  };

  const handlePrintOrderInvoice = async (order: OrderRecord) => {
    if (!user || !isAdmin) return;
    setBusyId(order.id);
    try {
      const itemsSnap = await getDocs(collection(db, 'orders', order.id, 'items'));
      const items = itemsSnap.docs.map((d) => d.data() as OrderItemRecord);
      onPrint({
        type: 'order_invoice',
        order,
        items,
        generatedAt: new Date().toLocaleString('en-GB'),
        adminEmail: user.email || 'admin',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `orders/${order.id}/items`);
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateOrderStatus = async (
    order: OrderRecord,
    nextStatus: OrderStatus,
    eventType: EmailEventType
  ) => {
    if (!user || !isAdmin) return;
    setBusyId(order.id);
    setNotice(null);

    try {
      const batch = writeBatch(db);
      const nextPaymentStatus =
        nextStatus === 'delivered' && order.paymentStatus === 'cod_pending'
          ? 'paid'
          : order.paymentStatus;

      batch.update(doc(db, 'orders', order.id), {
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      // Automatically dispatch customer email notification for order status change
      const emailRes = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          recipientEmail: order.customerEmail,
          recipientName: order.customerName,
          eventType,
          deliveryAddress: order.deliveryAddress,
          deliveryZone: order.deliveryZone,
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          total: order.total,
          itemsSummary: order.itemsSummary,
        }),
      });

      const emailData = await emailRes.json();
      const emailId = makeEmailId(order.id, nextStatus);
      await setDoc(doc(db, 'emailNotifications', emailId), {
        id: emailId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        recipientEmail: order.customerEmail,
        recipientName: order.customerName,
        subject: (emailData.subject || `Order ${order.orderNumber} Updated`).slice(0, 200),
        bodyPreview: (emailData.bodyPreview || order.itemsSummary).slice(0, 2000),
        eventType,
        deliveryMode: emailData.deliveryMode === 'smtp' ? 'smtp' : 'outbox_logged',
        deliveryStatus: emailData.deliveryStatus === 'sent' ? 'sent' : 'queued',
        messageId: String(emailData.messageId || `fs-${emailId}`).slice(0, 160),
        createdAt: serverTimestamp(),
      });

      setNotice(
        `Order ${order.orderNumber} moved to "${nextStatus.replaceAll('_', ' ')}" and customer email dispatched to ${order.customerEmail}.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setBusyId(null);
    }
  };

  if (!authReady) {
    return (
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-12">
        <div className="h-8 w-64 bg-[#EAECEB] rounded animate-pulse" />
      </main>
    );
  }

  if (!user || !emailVerified) {
    return (
      <main className="max-w-[520px] mx-auto px-4 sm:px-8 py-14">
        <div className="text-center mb-6">
          <ShieldAlert className="w-9 h-9 text-[#156145] mx-auto mb-3 stroke-[1.5]" />
          <h1 className="font-display text-2xl font-bold text-[#141715]">
            Administrator Login & Stock Upload
          </h1>
          <p className="mt-2 text-sm text-[#4F5852]">
            Sign in with your administrator username and password to upload stock and manage
            orders.
          </p>
        </div>
        <UsernamePasswordAuthCard context="admin" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="max-w-[680px] mx-auto px-4 sm:px-8 py-20 text-center">
        <ShieldAlert className="w-10 h-10 text-[#B45309] mx-auto mb-4 stroke-[1.5]" />
        <h1 className="font-display text-2xl font-bold text-[#141715]">
          Store Staff Authorization Required
        </h1>
        <p className="mt-3 text-sm text-[#4F5852] leading-relaxed">
          You are currently signed in as <strong className="text-[#141715]">{user.email}</strong>.
          Inventory write permissions and order dispatch controls are restricted to Freetown
          Supermarket store administrators.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 pb-20">
      {/* Header & Top Action */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#E3E7E4]">
        <div>
          <p className="text-xs font-medium text-[#156145]">
            Freetown Supermarket · Operations Console
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#141715]">
            Real-Time Inventory & Order Fulfillment
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {liveProducts.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => handleSeedProducts(5)}
              className="px-4 py-2.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-sm font-semibold rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{seeding ? 'Uploading...' : 'Upload 5 Starter Items'}</span>
            </button>
          )}
          {liveProducts.length < INITIAL_FREETOWN_CATALOG.length && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => handleSeedProducts()}
              className="px-4 py-2.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-sm font-semibold rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
              <span>
                {seeding
                  ? 'Publishing...'
                  : liveProducts.length === 0
                    ? `Seed Full Catalog (${INITIAL_FREETOWN_CATALOG.length})`
                    : 'Restore Missing Defaults'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setBulkError(null);
              setShowBulkUpload(true);
            }}
            className="px-4 py-2.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-sm font-semibold rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Bulk Upload Stock</span>
          </button>
          <button
            type="button"
            onClick={openNewProductModal}
            className="px-4 py-2.5 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#156145] text-xs font-medium rounded-md px-4 py-3 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E3E7E4] rounded-lg p-5">
          <p className="text-xs font-medium text-[#5B655E]">Catalog SKUs</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#141715] tabular-nums">
            {liveProducts.length}
          </p>
        </div>
        <div className="bg-white border border-[#E3E7E4] rounded-lg p-5">
          <p className="text-xs font-medium text-[#5B655E]">Units on Shelf</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#141715] tabular-nums">
            {totalUnits}
          </p>
        </div>
        <div className="bg-white border border-[#E3E7E4] rounded-lg p-5">
          <p className="text-xs font-medium text-[#5B655E]">Low Stock Alerts</p>
          <p
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              lowStockCount > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
            }`}
          >
            {lowStockCount}
          </p>
        </div>
        <div className="bg-white border border-[#E3E7E4] rounded-lg p-5">
          <p className="text-xs font-medium text-[#5B655E]">Active Orders</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#141715] tabular-nums">
            {pendingOrdersCount}
          </p>
        </div>
      </div>

      {/* Console Sub-Tabs */}
      <div className="mt-6 flex items-center gap-1 p-1 bg-[#EAECEB] rounded-lg w-fit overflow-x-auto max-w-full">
        {(
          [
            { id: 'catalog', label: `Stock & Catalog (${liveProducts.length})` },
            { id: 'orders', label: `Fulfillment Queue (${orders.length})` },
            { id: 'logs', label: `Stock Audit Log (${logs.length})` },
            { id: 'emails', label: `Email Outbox (${emails.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-[#141715] shadow-sm'
                : 'text-[#4F5852] hover:text-[#141715]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Stock & Catalog */}
      {activeTab === 'catalog' && (
        <section className="mt-6 bg-white border border-[#E3E7E4] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#E3E7E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative sm:w-72">
                <Search className="w-4 h-4 text-[#5B655E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by product or SKU..."
                  className="w-full h-9 pl-9 pr-3 text-sm bg-[#F8F9F8] border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
                />
              </div>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as 'All' | ProductCategory)}
                className="h-9 px-3 text-sm bg-[#F8F9F8] border border-[#D7DDD9] rounded-md focus:outline-none focus:border-[#156145]"
              >
                <option value="All">All Categories</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {filteredCatalog.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onPrint({
                    type: 'inventory',
                    products: filteredCatalog,
                    generatedAt: new Date().toLocaleString('en-GB'),
                    adminEmail: user.email || 'admin',
                  })
                }
                className="h-9 px-3.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Stock Sheet</span>
              </button>
            )}
          </div>

          {filteredCatalog.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-base font-semibold text-[#141715]">
                {liveProducts.length === 0
                  ? 'No live stock uploaded yet'
                  : 'No products match your filter'}
              </p>
              <p className="mt-1 text-sm text-[#4F5852] max-w-lg mx-auto">
                {liveProducts.length === 0
                  ? 'Upload 5 starter items, bulk import a CSV stock sheet, or add a single product with a photo so customers can view and add items to their bag.'
                  : 'Try clearing your search or category filter.'}
              </p>
              {liveProducts.length === 0 && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={() => handleSeedProducts(5)}
                    className="px-5 py-2.5 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md cursor-pointer"
                  >
                    {seeding ? 'Uploading...' : 'Upload 5 Starter Items'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkError(null);
                      setShowBulkUpload(true);
                    }}
                    className="px-5 py-2.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-sm font-semibold rounded-md cursor-pointer"
                  >
                    Bulk Upload CSV (5-Item Batch)
                  </button>
                  <button
                    type="button"
                    onClick={openNewProductModal}
                    className="px-5 py-2.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-sm font-semibold rounded-md cursor-pointer"
                  >
                    Add Custom Product
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E7E4] bg-[#F8F9F8] text-xs font-semibold text-[#5B655E]">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Quick Restock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEFED] text-sm">
                  {filteredCatalog.map((p) => {
                    const isOut = p.stockQuantity <= 0;
                    const isLow = !isOut && p.stockQuantity <= p.lowStockThreshold;
                    const rowBusy = busyId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-[#F8F9F8] transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-[#5B655E] whitespace-nowrap">
                          {p.sku}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#141715]">{p.name}</p>
                          <p className="text-xs text-[#5B655E]">{p.unit}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#4F5852] whitespace-nowrap">
                          {p.category}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatLeones(p.price)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                          {p.stockQuantity}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                          {!p.active ? (
                            <span className="text-[#5B655E]">Archived</span>
                          ) : isOut ? (
                            <span className="text-[#B91C1C]">Out of Stock</span>
                          ) : isLow ? (
                            <span className="text-[#B45309]">
                              Low (Min {p.lowStockThreshold})
                            </span>
                          ) : (
                            <span className="text-[#15803D]">In Stock</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={rowBusy || p.stockQuantity <= 0}
                              onClick={() => handleAdjustStock(p, -1)}
                              className="px-2 py-1 text-xs font-mono font-semibold bg-[#F1F3F2] hover:bg-[#E1E6E3] rounded disabled:opacity-40 cursor-pointer"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => handleAdjustStock(p, 1)}
                              className="px-2 py-1 text-xs font-mono font-semibold bg-[#F1F3F2] hover:bg-[#E1E6E3] rounded cursor-pointer"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => handleAdjustStock(p, 5)}
                              className="px-2 py-1 text-xs font-mono font-semibold bg-[#ECFDF5] text-[#156145] hover:bg-[#D1FAE5] rounded cursor-pointer"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => handleAdjustStock(p, 10)}
                              className="px-2 py-1 text-xs font-mono font-semibold bg-[#ECFDF5] text-[#156145] hover:bg-[#D1FAE5] rounded cursor-pointer"
                            >
                              +10
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditProductModal(p)}
                              title={`Edit ${p.name}`}
                              aria-label={`Edit ${p.name}`}
                              className="p-1.5 text-[#4F5852] hover:text-[#141715] hover:bg-[#EEF1EF] rounded cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => handleToggleProductActive(p)}
                              title={
                                p.active
                                  ? `Remove ${p.name} from storefront`
                                  : `Restore ${p.name} to storefront`
                              }
                              aria-label={
                                p.active
                                  ? `Remove ${p.name} from storefront`
                                  : `Restore ${p.name} to storefront`
                              }
                              className="p-1.5 text-[#4F5852] hover:text-[#B45309] hover:bg-[#FEF3C7] rounded cursor-pointer"
                            >
                              {p.active ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() =>
                                setConfirmDelete({ kind: 'product', product: p })
                              }
                              title={`Delete ${p.name}`}
                              aria-label={`Delete ${p.name}`}
                              className="p-1.5 text-[#4F5852] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Order Fulfillment Queue */}
      {activeTab === 'orders' && (
        <section className="mt-6 bg-white border border-[#E3E7E4] rounded-lg overflow-hidden">
          {orders.length > 0 && (
            <div className="p-4 border-b border-[#E3E7E4] flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#5B655E]">
                Administrator order management · Advance status, print packing slips, or delete orders
              </p>
              <button
                type="button"
                onClick={() =>
                  onPrint({
                    type: 'orders_manifest',
                    orders,
                    generatedAt: new Date().toLocaleString('en-GB'),
                    adminEmail: user.email || 'admin',
                  })
                }
                className="h-9 px-3.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Manifest</span>
              </button>
            </div>
          )}
          {orders.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#4F5852]">
              No customer orders have been placed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E7E4] bg-[#F8F9F8] text-xs font-semibold text-[#5B655E]">
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Customer & Zone</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Fulfillment Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEFED] text-sm">
                  {orders.map((order) => {
                    const action = nextStatusFor(order.status);
                    const rowBusy = busyId === order.id;
                    return (
                      <tr key={order.id} className="hover:bg-[#F8F9F8]">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-mono text-xs font-bold text-[#141715]">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-[#5B655E]">
                            {formatTs(order.createdAt)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#141715]">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-[#5B655E]">
                            {order.customerEmail} · {order.deliveryZone}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-xs text-[#3B443E] line-clamp-2">
                            {order.itemsSummary}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                          <p className="font-medium text-[#141715] uppercase">
                            {order.paymentMethod.replace('_', ' ')}
                          </p>
                          <p className="text-[#5B655E]">
                            {order.paymentStatus === 'paid' ? 'Paid' : 'COD Pending'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                          {formatLeones(order.total)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold capitalize">
                          <span
                            className={
                              order.status === 'delivered'
                                ? 'text-[#15803D]'
                                : order.status === 'cancelled'
                                  ? 'text-[#B91C1C]'
                                  : 'text-[#156145]'
                            }
                          >
                            {order.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {action && (
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() =>
                                  handleUpdateOrderStatus(
                                    order,
                                    action.next,
                                    action.eventType
                                  )
                                }
                                className="px-3 py-1.5 bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {rowBusy ? 'Updating...' : action.label}
                              </button>
                            )}
                            {order.status !== 'delivered' &&
                              order.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() =>
                                    handleUpdateOrderStatus(
                                      order,
                                      'cancelled',
                                      'status_cancelled'
                                    )
                                  }
                                  className="px-2.5 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-xs font-semibold rounded-md transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => handlePrintOrderInvoice(order)}
                              title={`Print slip for ${order.orderNumber}`}
                              aria-label={`Print slip for ${order.orderNumber}`}
                              className="p-1.5 text-[#4F5852] hover:text-[#141715] hover:bg-[#EEF1EF] rounded cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() =>
                                setConfirmDelete({ kind: 'order', order })
                              }
                              title={`Delete order ${order.orderNumber}`}
                              aria-label={`Delete order ${order.orderNumber}`}
                              className="p-1.5 text-[#4F5852] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Stock Audit Log */}
      {activeTab === 'logs' && (
        <section className="mt-6 bg-white border border-[#E3E7E4] rounded-lg overflow-hidden">
          {logs.length > 0 && (
            <div className="p-4 border-b border-[#E3E7E4] flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#5B655E]">
                Immutable stock audit trail ({logs.length} entries)
              </p>
              <button
                type="button"
                onClick={() =>
                  onPrint({
                    type: 'audit_log',
                    logs,
                    generatedAt: new Date().toLocaleString('en-GB'),
                    adminEmail: user.email || 'admin',
                  })
                }
                className="h-9 px-3.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Audit Log</span>
              </button>
            </div>
          )}
          {logs.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#4F5852]">
              Stock movements will appear here as orders or manual restocks occur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E7E4] bg-[#F8F9F8] text-xs font-semibold text-[#5B655E]">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">SKU & Product</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4 text-right">Previous</th>
                    <th className="py-3 px-4 text-right">Delta</th>
                    <th className="py-3 px-4 text-right">New Stock</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEFED] text-xs">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F8F9F8]">
                      <td className="py-3 px-4 font-mono text-[#5B655E] whitespace-nowrap">
                        {formatTs(log.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#141715]">
                          {log.productName}
                        </span>{' '}
                        <span className="font-mono text-[#5B655E]">({log.sku})</span>
                      </td>
                      <td className="py-3 px-4 text-[#3B443E] capitalize">
                        {log.reason.replaceAll('_', ' ')}
                        {log.orderId ? ` · ${log.orderId}` : ''}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {log.previousStock}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                          log.delta < 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
                        }`}
                      >
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {log.newStock}
                      </td>
                      <td className="py-3 px-4 text-[#5B655E]">{log.actorEmail}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={busyId === log.id}
                          onClick={() => setConfirmDelete({ kind: 'log', log })}
                          aria-label={`Delete audit entry ${log.id}`}
                          className="p-1.5 text-[#4F5852] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 4: Customer Email Outbox */}
      {activeTab === 'emails' && (
        <section className="mt-6 bg-white border border-[#E3E7E4] rounded-lg overflow-hidden">
          {emails.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#4F5852]">
              Automated order confirmation and status update emails will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E7E4] bg-[#F8F9F8] text-xs font-semibold text-[#5B655E]">
                    <th className="py-3 px-4">Dispatched</th>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Delivery Mode</th>
                    <th className="py-3 px-4 text-right">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEFED] text-xs">
                  {emails.map((eml) => (
                    <tr key={eml.id} className="hover:bg-[#F8F9F8]">
                      <td className="py-3 px-4 font-mono text-[#5B655E] whitespace-nowrap">
                        {formatTs(eml.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#141715] whitespace-nowrap">
                        {eml.orderNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#141715]">
                          {eml.recipientName}
                        </p>
                        <p className="text-[#5B655E]">{eml.recipientEmail}</p>
                      </td>
                      <td className="py-3 px-4 text-[#3B443E] max-w-xs truncate">
                        {eml.subject}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-medium text-[#156145]">
                          <MailCheck className="w-3.5 h-3.5" />
                          <span>
                            {eml.deliveryMode === 'smtp' ? 'SMTP Sent' : 'Outbox Logged'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPreviewEmail(eml)}
                            className="px-3 py-1.5 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] font-semibold rounded-md cursor-pointer"
                          >
                            Inspect & Print
                          </button>
                          <button
                            type="button"
                            disabled={busyId === eml.id}
                            onClick={() => setConfirmDelete({ kind: 'email', email: eml })}
                            aria-label={`Delete email record ${eml.orderNumber}`}
                            className="p-1.5 text-[#4F5852] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Add / Edit Product Modal */}
      {showProductForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingProduct ? 'Edit product' : 'Add product'}
        >
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-xl bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-[#E3E7E4] flex items-center justify-between bg-[#F8F9F8]">
              <h2 className="font-display text-lg font-bold text-[#141715]">
                {editingProduct ? `Edit ${editingProduct.name}` : 'Add Storefront Product'}
              </h2>
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="p-1.5 rounded-md hover:bg-[#E5E9E7] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#D7DDD9] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ProductCategory)}
                    className="w-full h-10 px-3 text-sm border border-[#D7DDD9] rounded-md"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-[#D7DDD9] rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-3 text-sm border border-[#D7DDD9] rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-[#D7DDD9] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                    Price (NLe)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#D7DDD9] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#D7DDD9] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3B443E] mb-1">
                    Low Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#D7DDD9] rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B443E] mb-1.5">
                  Product Photography
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <ProductImage
                    src={formImage}
                    alt={formName || 'Product photo preview'}
                    className="w-20 h-20 rounded-md object-cover border border-[#DCE1DD] shrink-0"
                  />
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer">
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>
                          {uploadingImage ? 'Uploading Image...' : 'Upload Image from Device'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          disabled={uploadingImage}
                          onChange={handleUploadProductImage}
                          className="sr-only"
                        />
                      </label>
                      <select
                        value={
                          STUDIO_IMAGE_OPTIONS.some((o) => o.url === formImage)
                            ? formImage
                            : ''
                        }
                        onChange={(e) => {
                          if (e.target.value) setFormImage(e.target.value);
                        }}
                        aria-label="Choose studio image preset"
                        className="h-9 px-2.5 text-xs border border-[#D7DDD9] rounded-md bg-white"
                      >
                        <option value="">Studio Presets...</option>
                        {STUDIO_IMAGE_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.url}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      placeholder="/api/uploads/... or /images/..."
                      className="w-full h-9 px-3 text-xs font-mono border border-[#D7DDD9] rounded-md text-[#4F5852]"
                    />
                    {imageUploadError && (
                      <p className="text-xs text-[#B91C1C] font-medium">
                        {imageUploadError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#3B443E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="rounded border-[#D7DDD9]"
                  />
                  <span>Featured on Storefront</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#3B443E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded border-[#D7DDD9]"
                  />
                  <span>Active for Sale</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E3E7E4] bg-[#F8F9F8] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowProductForm(false)}
                className="px-4 py-2 text-sm font-semibold text-[#4F5852] hover:bg-[#EAECEB] rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(busyId) || uploadingImage}
                className="px-5 py-2 bg-[#156145] hover:bg-[#114E37] text-white text-sm font-semibold rounded-md cursor-pointer disabled:opacity-50"
              >
                {busyId ? 'Saving...' : editingProduct ? 'Save Changes' : 'Upload to Storefront'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Stock Upload Modal (CSV / 5-Item Batch) */}
      {showBulkUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bulk upload stock"
        >
          <div className="w-full max-w-4xl bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#E3E7E4] flex items-center justify-between bg-[#F8F9F8]">
              <div>
                <h2 className="font-display text-lg font-bold text-[#141715]">
                  Bulk Stock Upload (CSV / 5-Item Batch)
                </h2>
                <p className="text-xs text-[#5B655E] mt-0.5">
                  Upload a CSV stock sheet or edit the 5-item batch below to publish products directly to the storefront.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkUpload(false)}
                aria-label="Close bulk upload"
                className="p-1.5 rounded-md hover:bg-[#E5E9E7] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3.5 py-2 bg-[#EEF1EF] hover:bg-[#E1E6E3] text-[#141715] text-xs font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose CSV File</span>
                    <input
                      type="file"
                      accept=".csv,text/csv,.txt"
                      onChange={handleBulkFileChange}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setBulkCsvText(SAMPLE_5_ITEM_CSV)}
                    className="px-3.5 py-2 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#156145] text-xs font-semibold rounded-md cursor-pointer"
                  >
                    Load 5-Item Sample Batch (Stock 5 each)
                  </button>
                </div>
                <p className="text-xs font-mono text-[#5B655E]">
                  Columns: sku,name,category,unit,price,stockQuantity,description
                </p>
              </div>

              <textarea
                rows={6}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                aria-label="CSV stock rows"
                className="w-full p-3 text-xs font-mono border border-[#D7DDD9] rounded-md bg-[#F8F9F8] focus:outline-none focus:border-[#156145]"
              />

              {bulkError && (
                <p className="text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
                  {bulkError}
                </p>
              )}

              <div>
                <p className="text-xs font-semibold text-[#3B443E] mb-2">
                  Preview ({validBulkRows.length} valid of {parsedBulkRows.length} rows)
                </p>
                <div className="border border-[#E3E7E4] rounded-md overflow-x-auto max-h-60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8F9F8] border-b border-[#E3E7E4] text-[#5B655E] font-semibold">
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                        <th className="py-2 px-3">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEFED]">
                      {parsedBulkRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 px-3 text-center text-[#5B655E]">
                            Paste CSV rows or load the 5-item sample batch above.
                          </td>
                        </tr>
                      ) : (
                        parsedBulkRows.map((row) => (
                          <tr key={`${row.rowNumber}-${row.sku}`}>
                            <td className="py-2 px-3 font-mono">{row.sku || '—'}</td>
                            <td className="py-2 px-3 font-medium text-[#141715]">
                              {row.name || '—'}{' '}
                              <span className="text-[#5B655E]">({row.unit})</span>
                            </td>
                            <td className="py-2 px-3 text-[#4F5852]">{row.category}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                              {formatLeones(row.price)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums">
                              {row.stockQuantity}
                            </td>
                            <td className="py-2 px-3">
                              {row.valid ? (
                                <span className="text-[#15803D] font-semibold">Ready</span>
                              ) : (
                                <span className="text-[#B91C1C] font-medium">
                                  {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E3E7E4] bg-[#F8F9F8] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkUpload(false)}
                className="px-4 py-2 text-sm font-semibold text-[#4F5852] hover:bg-[#EAECEB] rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkUploading || validBulkRows.length === 0}
                onClick={handleCommitBulkUpload}
                className="px-5 py-2 bg-[#156145] hover:bg-[#114E37] disabled:opacity-50 text-white text-sm font-semibold rounded-md cursor-pointer"
              >
                {bulkUploading
                  ? 'Uploading Stock...'
                  : `Upload ${validBulkRows.length} Product${
                      validBulkRows.length === 1 ? '' : 's'
                    } to Storefront`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm permanent deletion"
        >
          <div className="w-full max-w-md bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E3E7E4] bg-[#F8F9F8]">
              <h2 className="font-display text-base font-bold text-[#141715]">
                Confirm Permanent Deletion
              </h2>
            </div>
            <div className="p-6 text-sm text-[#4F5852] space-y-2">
              <p>
                {confirmDelete.kind === 'product' && (
                  <>
                    Permanently delete{' '}
                    <strong className="text-[#141715]">
                      {confirmDelete.product.name} ({confirmDelete.product.sku})
                    </strong>{' '}
                    from Firestore?
                  </>
                )}
                {confirmDelete.kind === 'order' && (
                  <>
                    Permanently delete order{' '}
                    <strong className="text-[#141715]">
                      {confirmDelete.order.orderNumber}
                    </strong>{' '}
                    and its line items?
                  </>
                )}
                {confirmDelete.kind === 'log' && (
                  <>
                    Permanently delete audit log entry for{' '}
                    <strong className="text-[#141715]">
                      {confirmDelete.log.productName}
                    </strong>
                    ?
                  </>
                )}
                {confirmDelete.kind === 'email' && (
                  <>
                    Permanently delete email notification record for{' '}
                    <strong className="text-[#141715]">
                      {confirmDelete.email.orderNumber}
                    </strong>
                    ?
                  </>
                )}
              </p>
              <p className="text-xs text-[#78827B]">
                This administrator action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-3.5 border-t border-[#E3E7E4] bg-[#F8F9F8] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#4F5852] hover:bg-[#EAECEB] rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExecute}
                className="px-4 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
