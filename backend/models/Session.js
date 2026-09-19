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
    // Optional persisted whiteboard snapshot (see APP_FLOW.md section 13 —
    // "a more advanced implementation can add whiteboard snapshots").
    canvasSnapshot: {
      type: String, // base64 PNG data URL, or null
      default: null,
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
    hasSnapshot: !!this.canvasSnapshot,
    createdAt: this.createdAt,
    lastActivityAt: this.lastActivityAt,
  };
};

module.exports = mongoose.model('Session', sessionSchema);
