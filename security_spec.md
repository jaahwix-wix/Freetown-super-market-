# Freetown Supermarket Security Specification

## 1. Data Invariants
1. **Product Integrity**: Only admins may create or delete products. During checkout, a verified signed-in customer may decrement `stockQuantity` on an active product ONLY if `stockQuantity` decreases (`new >= 0 && new < old`), only `stockQuantity`, `lastOrderId`, and `updatedAt` change, and a corresponding `orders/{lastOrderId}` belonging to `request.auth.uid` is created atomically in the same transaction (`existsAfter` + `getAfter`).
2. **Identity & PII Isolation**: `users/{userId}` and `orders/{orderId}` contain PII (`email`, `phone`, `deliveryAddress`). Read access (`get` and `list`) is strictly restricted to the owning user (`uid == request.auth.uid` / `customerId == request.auth.uid`) or verified admin. No blanket `isSignedIn()` reads exist.
3. **Role Protection**: Customers creating their own `users/{userId}` document must have `role == 'customer'`. Self-promotion to `'admin'` is forbidden.
4. **Order Terminal State Locking**: Once an order reaches terminal status (`delivered` or `cancelled`), non-admins cannot alter it, and customers cannot mutate paymentStatus, total, or order status directly.
5. **Admin-Only Deletion & Immutable Updates**: Non-admins cannot delete products, orders, order items, inventory logs, or email notifications. Only verified administrators (`isAdmin()`) may delete records.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
7. **Master Gate on Subcollections**: `/orders/{orderId}/items/{itemId}` checks parent `/orders/{orderId}` via `get()` on single-doc operations and `resource.data.customerId` on `list`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Product Update**: Customer attempts checkout decrement adding `price: 0.01` -> Denied by `affectedKeys().hasOnly(['stockQuantity', 'lastOrderId', 'updatedAt'])`.
2. **Stock Inflation by Customer**: Customer attempts to increase `stockQuantity` during checkout -> Denied by `incoming().stockQuantity < existing().stockQuantity`.
3. **Orphaned Stock Decrement**: Customer attempts to decrement product stock without creating an `orders/{lastOrderId}` in the same transaction -> Denied by `existsAfter` / `getAfter`.
4. **Role Escalation**: User creates `/users/{uid}` with `role: 'admin'` -> Denied by `incoming().role == 'customer'`.
5. **Email Spoofing**: Unverified user (`email_verified == false`) with admin email attempts product creation -> Denied by `request.auth.token.email_verified == true`.
6. **Cross-User PII Read**: Signed-in Customer A attempts `get` on `/users/customerB` -> Denied by `request.auth.uid == userId`.
7. **Blanket Order List Scraping**: Signed-in Customer A queries `/orders` without `where('customerId', '==', uid)` -> Denied by `resource.data.customerId == request.auth.uid` in `allow list`.
8. **Order Total Tampering**: Customer creates order with `customerId: 'someoneElse'` -> Denied by `incoming().customerId == request.auth.uid`.
9. **Terminal State Bypass**: Customer attempts to update `/orders/{orderId}` status from `delivered` to `confirmed` -> Denied by customer update prohibition.
10. **ID Poisoning**: Attacker writes `/products/invalid$id!with_1kb_junk` -> Denied by `isValidId(productId)`.
11. **Timestamp Forgery**: Attacker creates `/orders/{id}` with backdated `createdAt` -> Denied by `incoming().createdAt == request.time`.
12. **Non-Admin Audit Log / Order Deletion**: Non-admin customer attempts `delete` on `/inventoryLogs/{logId}` or `/orders/{orderId}` -> Denied by `isAdmin()`.
