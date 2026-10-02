const Session = require('../models/Session');
const SceneElement = require('../models/SceneElement');
const SceneFile = require('../models/SceneFile');

// ---------- Validation (server-side trust boundary) ----------

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
const MAX_ELEMENTS_PER_UPDATE = 5000;

function estimateDecodedBytes(dataURL) {
  if (typeof dataURL !== 'string') return Infinity;
  const commaIndex = dataURL.indexOf(',');
  const base64Length = commaIndex === -1 ? dataURL.length : dataURL.length - commaIndex - 1;
  return Math.floor(base64Length * 0.75);
}

function isAcceptableImageFile(file) {
  if (!file || typeof file !== 'object') return false;
  if (typeof file.id !== 'string' || !file.id || file.id.length > 100) return false;
  if (!file.mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(file.mimeType)) return false;
  if (estimateDecodedBytes(file.dataURL) > MAX_IMAGE_BYTES) return false;
  return true;
}

function isValidElement(el) {
  return (
    el &&
    typeof el === 'object' &&
    typeof el.id === 'string' &&
    el.id.length > 0 &&
    el.id.length <= 100 &&
    Number.isFinite(el.version)
  );
}

/** Drops malformed elements and caps batch size, so neither the DB nor peers receive garbage. */
function sanitizeElements(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidElement).slice(0, MAX_ELEMENTS_PER_UPDATE);
}

function sanitizeFiles(files) {
  const accepted = {};
  Object.entries(files || {}).forEach(([fileId, file]) => {
    if (isAcceptableImageFile(file)) accepted[fileId] = file;
  });
  return accepted;
}

// ---------- Atomic, idempotent writes ----------

// With an ordered:false bulk of upserts, a "newer version already stored" case shows up as a
// duplicate-key error (the version filter doesn't match, so Mongo tries to insert). That is the
// expected no-op — but two concurrent first-inserts can also collide, and there the loser may hold
// the newer version, so duplicates are retried once.
function duplicateKeyIndexes(err) {
  const errors = [].concat(err?.writeErrors ?? []);
  if (errors.length === 0) return null;
  if (!errors.every((e) => (e.code ?? e.err?.code) === 11000)) return null;
  return errors.map((e) => e.index ?? e.err?.index);
}

async function bulkUpsertIgnoringDuplicates(Model, ops) {
  let pending = ops;
  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await Model.bulkWrite(pending, { ordered: false });
      return;
    } catch (err) {
      const indexes = duplicateKeyIndexes(err);
      if (!indexes) throw err;
      pending = indexes.map((i) => pending[i]);
    }
  }
}

/**
 * Persists one incoming scene delta. Each element is written only if its version is higher than the
 * stored one, atomically in the database — so concurrent writers from any number of clients (or
 * server processes) can never overwrite newer data with older data, and nothing is read first.
 * Tombstones (isDeleted: true) are stored like any other element.
 */
async function persistSceneDelta(sessionId, { elements = [], files = {} } = {}) {
  const elementOps = elements.map((el) => ({
    updateOne: {
      filter: { sessionId, elementId: el.id, version: { $lt: el.version } },
      update: { $set: { version: el.version, isDeleted: !!el.isDeleted, data: el } },
      upsert: true,
    },
  }));

  const fileOps = Object.entries(files).map(([fileId, file]) => ({
    updateOne: {
      filter: { sessionId, fileId },
      update: { $setOnInsert: { data: file } },
      upsert: true,
    },
  }));

  await Promise.all([
    bulkUpsertIgnoringDuplicates(SceneElement, elementOps),
    bulkUpsertIgnoringDuplicates(SceneFile, fileOps),
  ]);
}

// ---------- Reads / deletes ----------

async function getSnapshot(sessionId) {
  const [elementDocs, fileDocs] = await Promise.all([
    SceneElement.find({ sessionId }).sort({ _id: 1 }).select('data').lean(), // _id order = first-seen order
    SceneFile.find({ sessionId }).select('fileId data').lean(),
  ]);
  return {
    elements: elementDocs.map((d) => d.data),
    files: Object.fromEntries(fileDocs.map((d) => [d.fileId, d.data])),
  };
}

async function clearScene(sessionId) {
  await Promise.all([SceneElement.deleteMany({ sessionId }), SceneFile.deleteMany({ sessionId })]);
}

// Visible (non-deleted) element counts for the lobby, in one grouped query.
async function countVisibleElements(sessionIds) {
  if (sessionIds.length === 0) return new Map();
  const rows = await SceneElement.aggregate([
    { $match: { sessionId: { $in: sessionIds }, isDeleted: false } },
    { $group: { _id: '$sessionId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

// ---------- One-time migration from the old inline storage ----------

async function migrateLegacyScenes() {
  await Promise.all([SceneElement.init(), SceneFile.init()]); // make sure unique indexes exist first

  let migrated = 0;
  const cursor = Session.find({ 'canvasElements.0': { $exists: true } })
    .select('sessionId canvasElements canvasFiles')
    .cursor();

  // eslint-disable-next-line no-restricted-syntax
  for await (const session of cursor) {
    const elements = sanitizeElements(session.canvasElements);
    const files = sanitizeFiles(session.canvasFiles);
    await persistSceneDelta(session.sessionId, { elements, files });
    await Session.updateOne({ _id: session._id }, { $set: { canvasElements: [], canvasFiles: {} } });
    migrated += 1;
  }

  if (migrated > 0) {
    // eslint-disable-next-line no-console
    console.log(`[migrate] Moved ${migrated} board(s) to per-element scene storage.`);
  }
}

module.exports = {
  isAcceptableImageFile,
  sanitizeElements,
  sanitizeFiles,
  persistSceneDelta,
  getSnapshot,
  clearScene,
  countVisibleElements,
  migrateLegacyScenes,
};
