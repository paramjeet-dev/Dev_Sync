const mongoose = require('mongoose');

// Embedded images, keyed by Excalidraw's fileId. Immutable once written.
const sceneFileSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    fileId: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: false, minimize: false }
);

sceneFileSchema.index({ sessionId: 1, fileId: 1 }, { unique: true });

module.exports = mongoose.model('SceneFile', sceneFileSchema);
