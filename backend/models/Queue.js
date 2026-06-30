import mongoose from 'mongoose';

const QueueItemSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String },
  duration: { type: Number, default: 0 },
  addedBy: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
});

const QueueSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  songs: [QueueItemSchema],
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete queue after 24 hours
});

export default mongoose.models.Queue || mongoose.model('Queue', QueueSchema);
