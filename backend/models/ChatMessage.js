const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    // Optional metadata, e.g. { type: 'transcript' } when inserted from voice transcription
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound index: chat history for a session is always queried by sessionId + createdAt
chatMessageSchema.index({ sessionId: 1, createdAt: -1 });

chatMessageSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    sessionId: this.sessionId,
    userId: this.userId.toString(),
    username: this.username,
    message: this.message,
    metadata: this.metadata,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
