const mongoose = require('mongoose');

// A "Session" is a collaboration room / board. Presence and cursors are transient
// (sockets/presenceStore.js); the drawing itself lives in SceneElement / SceneFile.
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
    // Everyone who has joined with the room code. Gates every read of the board's data.
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Small JPEG data URL (<= ~60KB) rendered client-side; shown on the lobby board cards.
    thumbnail: { type: String, default: null },
    lastActivityAt: { type: Date, default: Date.now },

    // LEGACY: older versions stored the scene inline. Kept in the schema only so
    // migrateLegacyScenes() can read and then empty them at startup.
    canvasElements: { type: [mongoose.Schema.Types.Mixed], default: [] },
    canvasFiles: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

// Lobby query: boards where I'm a member or the creator, newest activity first.
sessionSchema.index({ members: 1, lastActivityAt: -1 });
sessionSchema.index({ createdBy: 1, lastActivityAt: -1 });

sessionSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    sessionId: this.sessionId,
    name: this.name,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    lastActivityAt: this.lastActivityAt,
  };
};

module.exports = mongoose.model('Session', sessionSchema);
