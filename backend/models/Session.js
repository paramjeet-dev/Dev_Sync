const mongoose = require('mongoose');

// A "Session" here is a collaboration room. It is intentionally lightweight —
// most collaboration state (presence, cursors) is transient and lives only
// in memory (see sockets/presenceStore.js), not in MongoDB.
const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      default: function defaultName() {
        return this.sessionId;
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Persisted whiteboard scene, using Excalidraw's element/file model
    // (see APP_FLOW.md section 13 — "a more advanced implementation can
    // add whiteboard snapshots"). `elements` is the array of Excalidraw
    // scene elements (shapes, arrows, freedraw, images, text...); `files`
    // holds binary image data keyed by Excalidraw's fileId, base64-encoded.
    // Stored as Mixed rather than a strict sub-schema because Excalidraw's
    // element shape evolves with library versions and is not ours to model.
    canvasElements: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    canvasFiles: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

sessionSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    sessionId: this.sessionId,
    name: this.name,
    createdBy: this.createdBy.toString(),
    hasSnapshot: Array.isArray(this.canvasElements) && this.canvasElements.length > 0,
    createdAt: this.createdAt,
    lastActivityAt: this.lastActivityAt,
  };
};

module.exports = mongoose.model('Session', sessionSchema);
