import type { Params } from './geometry';

/** A saved artwork. Everything lives in this browser's IndexedDB. */
export interface Design {
  id: string;
  name: string;
  params: Params;
  fontKey: string;
  /** Uploaded fonts the design uses, so it can be restored later. */
  fonts?: { key: string; data: ArrayBuffer }[];
  /** Small JPEG preview as a data URL. */
  thumb: string;
  created: number;
  updated: number;
}

const DB = 'letterforge';
const STORE = 'designs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const listDesigns = async (): Promise<Design[]> =>
  (await tx<Design[]>('readonly', (s) => s.getAll())).sort((a, b) => b.updated - a.updated);
export const getDesign = (id: string) => tx<Design | undefined>('readonly', (s) => s.get(id));
export const putDesign = (d: Design) => tx('readwrite', (s) => s.put(d));
export const deleteDesign = (id: string) => tx('readwrite', (s) => s.delete(id));

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Backup file: designs with fonts base64-encoded so it is plain JSON. */
export async function exportAll(): Promise<Blob> {
  const all = await listDesigns();
  const enc = (b: ArrayBuffer) => {
    let s = '';
    const u = new Uint8Array(b);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const data = all.map((d) => ({ ...d, fonts: d.fonts?.map((f) => ({ key: f.key, data: enc(f.data) })) }));
  return new Blob([JSON.stringify({ app: 'letterforge', version: 1, designs: data })], { type: 'application/json' });
}

export async function importAll(file: File): Promise<number> {
  const json = JSON.parse(await file.text());
  if (json?.app !== 'letterforge' || !Array.isArray(json.designs)) throw new Error('Not a Letterforge backup file');
  const dec = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
  let n = 0;
  for (const d of json.designs) {
    if (!d?.id || !d?.params) continue;
    await putDesign({ ...d, fonts: d.fonts?.map((f: { key: string; data: string }) => ({ key: f.key, data: dec(f.data) })) });
    n++;
  }
  return n;
}
