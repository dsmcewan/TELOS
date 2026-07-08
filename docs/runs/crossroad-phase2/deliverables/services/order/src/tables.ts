// services/order/src/tables.ts
//
// DynamoDB table definitions for the order-service.
//
// Cited from audit/COMMERCE-GAP.md:
//   - Gap Analysis: "Order records | none (static export) | No datastore, no
//     order IDs, no state machine" -> the Orders table.
//   - Gap Analysis: "Cart persistence | client types only ... | No server/session
//     cart; lost on reload/device switch" -> the Carts table with a TTL attribute.
//   - Gap Analysis: "Idempotency / refunds | none | No dedup, no reversal path"
//     -> the ProcessedEvents table used for webhook/event dedupe.
// Cited from audit/SECURITY.md:
//   - "Current Posture" item 7: the static repo has "no ... order state machine,
//     webhook verification" -> unique constraints below prevent duplicate
//     payment sessions, replayed webhook events, and duplicate POD orders.
//
// These are declarative descriptors (no SDK import, no network) so this file is
// pure data and cannot drift the signed artifact tree.

export type DynamoKeyType = 'HASH' | 'RANGE';
export type DynamoAttrType = 'S' | 'N' | 'B';

export interface AttributeDefinition {
  readonly name: string;
  readonly type: DynamoAttrType;
}

export interface KeySchemaElement {
  readonly name: string;
  readonly keyType: DynamoKeyType;
}

export interface GlobalSecondaryIndex {
  readonly indexName: string;
  readonly keySchema: readonly KeySchemaElement[];
  readonly projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';
  // uniqueConstraint documents that application writes MUST use a conditional
  // PutItem (attribute_not_exists) on this index's hash key to enforce uniqueness,
  // since DynamoDB GSIs are not natively unique.
  readonly uniqueConstraint?: boolean;
}

export interface TableDefinition {
  readonly tableName: string;
  readonly attributeDefinitions: readonly AttributeDefinition[];
  readonly keySchema: readonly KeySchemaElement[];
  readonly globalSecondaryIndexes?: readonly GlobalSecondaryIndex[];
  readonly billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  readonly ttlAttribute?: string;
  readonly notes?: string;
}

// --- Orders -----------------------------------------------------------------
// Primary key: orderId. Unique constraints enforced via GSIs + conditional
// writes for paymentSessionId, webhookEventId, and podOrderId.
export const OrdersTable: TableDefinition = Object.freeze({
  tableName: 'Orders',
  attributeDefinitions: [
    { name: 'orderId', type: 'S' },
    { name: 'paymentSessionId', type: 'S' },
    { name: 'webhookEventId', type: 'S' },
    { name: 'podOrderId', type: 'S' },
  ],
  keySchema: [{ name: 'orderId', keyType: 'HASH' }],
  globalSecondaryIndexes: [
    {
      indexName: 'gsi_paymentSessionId',
      keySchema: [{ name: 'paymentSessionId', keyType: 'HASH' }],
      projectionType: 'KEYS_ONLY',
      uniqueConstraint: true,
    },
    {
      indexName: 'gsi_webhookEventId',
      keySchema: [{ name: 'webhookEventId', keyType: 'HASH' }],
      projectionType: 'KEYS_ONLY',
      uniqueConstraint: true,
    },
    {
      indexName: 'gsi_podOrderId',
      keySchema: [{ name: 'podOrderId', keyType: 'HASH' }],
      projectionType: 'KEYS_ONLY',
      uniqueConstraint: true,
    },
  ],
  billingMode: 'PAY_PER_REQUEST',
  notes:
    'Unique constraints for paymentSessionId, webhookEventId, podOrderId are ' +
    'enforced by conditional PutItem (attribute_not_exists) against these GSIs.',
});

// --- Carts (TTL) ------------------------------------------------------------
// Server-side cart persistence with automatic expiry via the `expiresAt` TTL
// attribute (COMMERCE-GAP "Cart persistence" gap).
export const CartsTable: TableDefinition = Object.freeze({
  tableName: 'Carts',
  attributeDefinitions: [{ name: 'cartId', type: 'S' }],
  keySchema: [{ name: 'cartId', keyType: 'HASH' }],
  billingMode: 'PAY_PER_REQUEST',
  ttlAttribute: 'expiresAt',
  notes: 'expiresAt is an epoch-seconds TTL; DynamoDB reaps abandoned carts.',
});

// --- ProcessedEvents --------------------------------------------------------
// Idempotency dedupe store keyed by dedupeId. The state machine writes a record
// here (conditional PutItem) for every applied event; a duplicate webhook whose
// dedupeId already exists is rejected/short-circuited. Backs the
// ProcessedEvents concept used by state-machine.ts. A TTL keeps the table
// bounded once events are safely past any replay window.
export const ProcessedEventsTable: TableDefinition = Object.freeze({
  tableName: 'ProcessedEvents',
  attributeDefinitions: [{ name: 'dedupeId', type: 'S' }],
  keySchema: [{ name: 'dedupeId', keyType: 'HASH' }],
  billingMode: 'PAY_PER_REQUEST',
  ttlAttribute: 'expiresAt',
  notes:
    'dedupeId is the webhookEventId (payment) or podOrderId (fulfillment). ' +
    'Writes use attribute_not_exists(dedupeId) to guarantee once-only apply.',
});

export const ALL_TABLES: readonly TableDefinition[] = Object.freeze([
  OrdersTable,
  CartsTable,
  ProcessedEventsTable,
]);
