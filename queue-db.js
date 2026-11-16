/**
 * FluxWebP Pro — Universal Queue & State Storage Engine (IndexedDB)
 * Preserves the conversion queue, file blobs, output blobs, and settings
 * across full page navigations (/resizer/, /editor/, /background-remover/, /poster-studio/).
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FluxQueueDB = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DB_NAME = "FluxWebP_QueueDB";
  const DB_VERSION = 1;
  const STORE_ITEMS = "queue_items";
  const STORE_STATE = "app_state";

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: "id" });
          itemStore.createIndex("order", "order", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("FluxQueueDB: failed to open IndexedDB", req.error);
        resolve(null);
      };
    });
    return dbPromise;
  }

  async function getAllItems() {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ITEMS, "readonly");
        const store = tx.objectStore(STORE_ITEMS);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          items.sort((a, b) => (a.order || 0) - (b.order || 0));
          resolve(items);
        };
        req.onerror = () => resolve([]);
      } catch (err) {
        console.warn("FluxQueueDB.getAllItems error:", err);
        resolve([]);
      }
    });
  }

  async function saveAllItems(items) {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        const store = tx.objectStore(STORE_ITEMS);
        store.clear();
        (items || []).forEach((item, index) => {
          // Prepare clean clone without object URLs / DOM nodes
          const record = {
            id: item.id,
            order: index,
            name: item.name,
            file: item.file,
            originalSize: item.originalSize || (item.file ? item.file.size : 0),
            previewBlob: item.previewBlob || null,
            outputBlob: item.outputBlob || null,
            outputSize: item.outputSize || (item.outputBlob ? item.outputBlob.size : 0),
            savedPercent: item.savedPercent || 0,
            savedBytes: item.savedBytes || 0,
            status: item.status || "queued",
            progress: item.progress || 0,
            error: item.error || "",
            width: item.width || 0,
            height: item.height || 0,
            format: item.format || "webp",
            isCameraPreview: Boolean(item.isCameraPreview),
            previewLabel: item.previewLabel || null,
            selectedForBatch: Boolean(item.selectedForBatch),
            largerThanOriginal: Boolean(item.largerThanOriginal),
            // Per-file settings override
            customQuality: item.customQuality !== undefined ? item.customQuality : null,
            customWidth: item.customWidth !== undefined ? item.customWidth : null,
            customHeight: item.customHeight !== undefined ? item.customHeight : null,
            customFormat: item.customFormat || null,
            lastModified: item.file?.lastModified || item.lastModified || Date.now()
          };
          store.put(record);
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (err) {
        console.warn("FluxQueueDB.saveAllItems error:", err);
        resolve(false);
      }
    });
  }

  async function putItem(item, order = 0) {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        const store = tx.objectStore(STORE_ITEMS);
        const record = {
          id: item.id,
          order: order,
          name: item.name,
          file: item.file,
          originalSize: item.originalSize || (item.file ? item.file.size : 0),
          previewBlob: item.previewBlob || null,
          outputBlob: item.outputBlob || null,
          outputSize: item.outputSize || (item.outputBlob ? item.outputBlob.size : 0),
          savedPercent: item.savedPercent || 0,
          savedBytes: item.savedBytes || 0,
          status: item.status || "queued",
          progress: item.progress || 0,
          error: item.error || "",
          width: item.width || 0,
          height: item.height || 0,
          format: item.format || "webp",
          isCameraPreview: Boolean(item.isCameraPreview),
          previewLabel: item.previewLabel || null,
          selectedForBatch: Boolean(item.selectedForBatch),
          largerThanOriginal: Boolean(item.largerThanOriginal),
          customQuality: item.customQuality !== undefined ? item.customQuality : null,
          customWidth: item.customWidth !== undefined ? item.customWidth : null,
          customHeight: item.customHeight !== undefined ? item.customHeight : null,
          customFormat: item.customFormat || null,
          lastModified: item.file?.lastModified || item.lastModified || Date.now()
        };
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (err) {
        console.warn("FluxQueueDB.putItem error:", err);
        resolve(false);
      }
    });
  }

  async function deleteItem(id) {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        tx.objectStore(STORE_ITEMS).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function clearAll() {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_ITEMS, "readwrite");
        tx.objectStore(STORE_ITEMS).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  return {
    openDB,
    getAllItems,
    getItems: getAllItems,
    saveAllItems,
    saveItems: saveAllItems,
    putItem,
    saveItem: putItem,
    deleteItem,
    removeItem: deleteItem,
    clearAll
  };
});
