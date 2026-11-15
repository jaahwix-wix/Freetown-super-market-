export function makeOrderId(): string {
  return `ord_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function makeOrderNumber(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const num = 100000 + (arr[0] % 900000);
  return `FS-${num}`;
}

export function makeChallengeCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export function makeSku(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return `FS-NEW-${100 + (arr[0] % 899)}`;
}

export function makeLogId(prefix: string, productId: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `log_${prefix}_${productId}_${suffix}`.slice(0, 120);
}

export function makeEmailId(orderId: string, status: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `eml_${orderId}_${status}_${suffix}`.slice(0, 120);
}

export function makeProductId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  return `prod_${slug || 'item'}_${suffix}`;
}
