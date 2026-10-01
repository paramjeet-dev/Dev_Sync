const mongoose = require('mongoose');

// A "Session" is a collaboration room / board. Presence and cursors are
// transient (see sockets/presenceStore.js); the scene snapshot is persisted.
const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, trim: true, index: true },
    name: {
      type: String,
      default: function defaultName() {
        return this.sessionId;
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Everyone who has ever joined — powers "Your boards" on the dashboard.
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    // Excalidraw scene elements/files; Mixed because the shape evolves with the library.
    canvasElements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    canvasFiles: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastActivityAt: { type: Date, default: Date.now },
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
