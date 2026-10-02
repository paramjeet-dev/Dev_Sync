const mongoose = require('mongoose');

// One document per Excalidraw element per board. Storing elements individually (instead of one big
// array on the Session) lets the server persist each incoming delta with atomic, version-gated
// upserts, and removes the 16MB single-document ceiling.
const sceneElementSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    elementId: { type: String, required: true },
    version: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false }, // tombstones are kept so deletions survive restores
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: false, minimize: false }
);

sceneElementSchema.index({ sessionId: 1, elementId: 1 }, { unique: true });
sceneElementSchema.index({ sessionId: 1, isDeleted: 1 });

module.exports = mongoose.model('SceneElement', sceneElementSchema);
