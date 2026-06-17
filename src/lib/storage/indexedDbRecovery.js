const DB_NAME = "pdeff-recovery";
const STORE_NAME = "recoveries";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "fingerprint" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(mode, callback) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = callback(store);
        transaction.oncomplete = () => {
          db.close();
          resolve(request?.result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      })
  );
}

export function writeRecovery(fingerprint, pdfa) {
  if (!fingerprint || !pdfa) return Promise.resolve();
  return transact("readwrite", (store) =>
    store.put({
      fingerprint,
      pdfa,
      savedAt: new Date().toISOString()
    })
  );
}

export function readRecovery(fingerprint) {
  if (!fingerprint) return Promise.resolve(null);
  return transact("readonly", (store) => store.get(fingerprint)).then((record) => record ?? null);
}

export function clearRecovery(fingerprint) {
  if (!fingerprint) return Promise.resolve();
  return transact("readwrite", (store) => store.delete(fingerprint));
}
