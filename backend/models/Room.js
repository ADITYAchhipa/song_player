import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
  socketId: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  isHost: { type: Boolean, default: false }
});

const SongSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String },
  duration: { type: Number, default: 0 }
});

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  currentSong: { type: SongSchema, default: null },
  currentTime: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
  participants: [ParticipantSchema],
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete room after 24 hours
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
