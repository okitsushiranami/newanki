import type { Card, Rating } from './study';

export type OfflineDeck = { id: string; name: string; total: number; due: number; learned: number };
export type OfflineDay = { day: string; count: number; good: number; duration: number };
export type OfflineRecent = { id: string; front: string; name: string; rating: Rating; reviewed_at: number; next_due: number };
export type OfflineDashboard = {
  user: { email: string };
  decks: OfflineDeck[];
  daily: OfflineDay[];
  summary: { count: number; good: number; duration: number };
  recent: OfflineRecent[];
  serverTime: number;
};

type QueueBody = Record<string, unknown>;
type DashboardRecord = { key: 'active'; owner: string; value: OfflineDashboard; savedAt: number };
type CardsRecord = { key: string; owner: string; deckId: string; cards: Card[]; savedAt: number };
type QueueRecord = { id: string; owner: string; body: QueueBody; createdAt: number };

const DB_NAME = 'newanki-offline';
const DB_VERSION = 1;
const DASHBOARDS = 'dashboards';
const CARDS = 'cards';
const QUEUE = 'queue';

function unavailable() {
  return new Error('このブラウザーはオフライン保存に対応していません。Chromeを最新版に更新してください。');
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(unavailable());
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DASHBOARDS)) db.createObjectStore(DASHBOARDS, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(CARDS)) {
        const store = db.createObjectStore(CARDS, { keyPath: 'key' });
        store.createIndex('owner', 'owner', { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE)) {
        const store = db.createObjectStore(QUEUE, { keyPath: 'id' });
        store.createIndex('owner', 'owner', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? unavailable());
  });
}

function read<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? unavailable());
  }));
}

function write(storeName: string, value: unknown): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? unavailable());
  }));
}

function remove(storeName: string, key: IDBValidKey): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? unavailable());
  }));
}

function readAll<T>(storeName: string): Promise<T[]> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    request.onerror = () => reject(request.error ?? unavailable());
  }));
}

export function isNetworkError(error: unknown): boolean {
  if ((error as { offlineMissing?: boolean } | null)?.offlineMissing) return false;
  return Boolean((error as { network?: boolean } | null)?.network) || (typeof navigator !== 'undefined' && !navigator.onLine);
}

export async function saveDashboard(value: OfflineDashboard): Promise<void> {
  await write(DASHBOARDS, { key: 'active', owner: value.user.email, value, savedAt: Date.now() } satisfies DashboardRecord);
}

export async function loadDashboard(): Promise<OfflineDashboard | null> {
  const record = await read<DashboardRecord>(DASHBOARDS, 'active');
  return record?.value ?? null;
}

export async function saveCards(owner: string, deckId: string, cards: Card[]): Promise<void> {
  await write(CARDS, { key: `${owner}:${deckId}`, owner, deckId, cards, savedAt: Date.now() } satisfies CardsRecord);
}

export async function loadCards(owner: string | undefined, deckId: string): Promise<Card[] | null> {
  if (!owner) return null;
  const record = await read<CardsRecord>(CARDS, `${owner}:${deckId}`);
  return record?.cards ?? null;
}

export async function enqueue(owner: string, body: QueueBody): Promise<string> {
  const id = typeof body.eventId === 'string'
    ? body.eventId
    : typeof body.operationId === 'string'
      ? body.operationId
      : crypto.randomUUID();
  await write(QUEUE, { id, owner, body, createdAt: Date.now() } satisfies QueueRecord);
  return id;
}

export async function queueCount(owner?: string): Promise<number> {
  const records = await readAll<QueueRecord>(QUEUE);
  return owner ? records.filter(record => record.owner === owner).length : records.length;
}

async function queueFor(owner: string): Promise<QueueRecord[]> {
  const records = await readAll<QueueRecord>(QUEUE);
  return records.filter(record => record.owner === owner).sort((a, b) => a.createdAt - b.createdAt);
}

export async function flushQueue(owner: string, send: (body: QueueBody) => Promise<unknown>): Promise<{ sent: number; conflicts: number; remaining: number }> {
  const records = await queueFor(owner);
  let sent = 0;
  let conflicts = 0;
  for (const record of records) {
    try {
      await send(record.body);
      await remove(QUEUE, record.id);
      sent += 1;
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 409 || status === 422) {
        await remove(QUEUE, record.id);
        conflicts += 1;
        continue;
      }
      break;
    }
  }
  return { sent, conflicts, remaining: await queueCount(owner) };
}
