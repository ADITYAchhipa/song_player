import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Queue from '../models/Queue.js';

let isUsingMongo = false;

// In-memory fallbacks
const memRooms = new Map();
const memQueues = new Map();

export const connectDB = async (uri) => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    isUsingMongo = true;
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('MongoDB connection failed. Falling back to in-memory database storage.', error.message);
    isUsingMongo = false;
  }
};

export const createRoom = async (roomId, hostId, hostName, hostSocketId) => {
  const roomData = {
    roomId,
    currentSong: null,
    currentTime: 0,
    isPlaying: false,
    participants: [{
      socketId: hostSocketId,
      userId: hostId,
      name: hostName,
      isHost: true
    }]
  };

  const queueData = {
    roomId,
    songs: []
  };

  if (isUsingMongo) {
    const room = await Room.create(roomData);
    await Queue.create(queueData);
    return room;
  } else {
    memRooms.set(roomId, { ...roomData, createdAt: new Date() });
    memQueues.set(roomId, { ...queueData, createdAt: new Date() });
    return roomData;
  }
};

export const getRoom = async (roomId) => {
  if (isUsingMongo) {
    return await Room.findOne({ roomId }).lean();
  } else {
    return memRooms.get(roomId) || null;
  }
};

export const deleteRoom = async (roomId) => {
  if (isUsingMongo) {
    await Room.deleteOne({ roomId });
    await Queue.deleteOne({ roomId });
  } else {
    memRooms.delete(roomId);
    memQueues.delete(roomId);
  }
};

export const joinRoom = async (roomId, userId, name, socketId) => {
  if (isUsingMongo) {
    let retries = 3;
    while (retries > 0) {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return null;

        // Check if participant already exists with this userId or socketId
        const existingIndex = room.participants.findIndex(p => p.userId === userId);
        if (existingIndex > -1) {
          room.participants[existingIndex].socketId = socketId;
        } else {
          room.participants.push({
            socketId,
            userId,
            name,
            isHost: room.participants.length === 0
          });
        }
        await room.save();
        return room.toObject();
      } catch (err) {
        if (err.name === 'VersionError') {
          retries--;
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, Math.random() * 100));
        } else {
          throw err;
        }
      }
    }
  } else {
    const room = memRooms.get(roomId);
    if (!room) return null;

    const existingIndex = room.participants.findIndex(p => p.userId === userId);
    if (existingIndex > -1) {
      room.participants[existingIndex].socketId = socketId;
    } else {
      room.participants.push({
        socketId,
        userId,
        name,
        isHost: room.participants.length === 0
      });
    }
    memRooms.set(roomId, room);
    return room;
  }
};

export const leaveRoomBySocket = async (socketId) => {
  let roomAffected = null;

  if (isUsingMongo) {
    const rooms = await Room.find({ 'participants.socketId': socketId });
    for (const room of rooms) {
      let retries = 3;
      while (retries > 0) {
        try {
          const latestRoom = await Room.findOne({ roomId: room.roomId });
          if (!latestRoom) break;

          const pIndex = latestRoom.participants.findIndex(p => p.socketId === socketId);
          if (pIndex > -1) {
            const leftParticipant = latestRoom.participants[pIndex];
            latestRoom.participants.splice(pIndex, 1);

            if (latestRoom.participants.length === 0) {
              // Room is empty, delete it
              await Room.deleteOne({ roomId: latestRoom.roomId });
              await Queue.deleteOne({ roomId: latestRoom.roomId });
              roomAffected = { roomId: latestRoom.roomId, deleted: true };
            } else {
              // If the leaving user was the host, assign a new host
              if (leftParticipant.isHost) {
                latestRoom.participants[0].isHost = true;
              }
              await latestRoom.save();
              roomAffected = latestRoom.toObject();
            }
          }
          break;
        } catch (err) {
          if (err.name === 'VersionError') {
            retries--;
            if (retries === 0) throw err;
            await new Promise(r => setTimeout(r, Math.random() * 100));
          } else {
            throw err;
          }
        }
      }
    }
  } else {
    for (const [roomId, room] of memRooms.entries()) {
      const pIndex = room.participants.findIndex(p => p.socketId === socketId);
      if (pIndex > -1) {
        const leftParticipant = room.participants[pIndex];
        room.participants.splice(pIndex, 1);

        if (room.participants.length === 0) {
          memRooms.delete(roomId);
          memQueues.delete(roomId);
          roomAffected = { roomId, deleted: true };
        } else {
          if (leftParticipant.isHost) {
            room.participants[0].isHost = true;
          }
          memRooms.set(roomId, room);
          roomAffected = room;
        }
      }
    }
  }
  return roomAffected;
};

export const updateRoomState = async (roomId, updates) => {
  if (isUsingMongo) {
    const room = await Room.findOneAndUpdate(
      { roomId },
      { $set: updates },
      { new: true }
    ).lean();
    return room;
  } else {
    const room = memRooms.get(roomId);
    if (!room) return null;
    const updatedRoom = { ...room, ...updates };
    memRooms.set(roomId, updatedRoom);
    return updatedRoom;
  }
};

export const getQueue = async (roomId) => {
  if (isUsingMongo) {
    const queue = await Queue.findOne({ roomId }).lean();
    return queue ? queue.songs : [];
  } else {
    const queue = memQueues.get(roomId);
    return queue ? queue.songs : [];
  }
};

export const addSongToQueue = async (roomId, songData) => {
  const songItem = {
    ...songData,
    _id: isUsingMongo ? new mongoose.Types.ObjectId() : Math.random().toString(36).substring(2, 9)
  };

  if (isUsingMongo) {
    const queue = await Queue.findOne({ roomId });
    if (queue) {
      queue.songs.push(songItem);
      await queue.save();
      return queue.songs;
    }
  } else {
    const queue = memQueues.get(roomId);
    if (queue) {
      queue.songs.push(songItem);
      memQueues.set(roomId, queue);
      return queue.songs;
    }
  }
  return [];
};

export const removeSongFromQueue = async (roomId, songId) => {
  if (isUsingMongo) {
    const queue = await Queue.findOne({ roomId });
    if (queue) {
      queue.songs = queue.songs.filter(s => s._id.toString() !== songId);
      await queue.save();
      return queue.songs;
    }
  } else {
    const queue = memQueues.get(roomId);
    if (queue) {
      queue.songs = queue.songs.filter(s => s._id.toString() !== songId);
      memQueues.set(roomId, queue);
      return queue.songs;
    }
  }
  return [];
};

export const reorderQueue = async (roomId, startIndex, endIndex) => {
  if (isUsingMongo) {
    const queue = await Queue.findOne({ roomId });
    if (queue) {
      const songs = [...queue.songs];
      if (startIndex >= 0 && startIndex < songs.length && endIndex >= 0 && endIndex < songs.length) {
        const [removed] = songs.splice(startIndex, 1);
        songs.splice(endIndex, 0, removed);
        queue.songs = songs;
        await queue.save();
      }
      return queue.songs;
    }
  } else {
    const queue = memQueues.get(roomId);
    if (queue) {
      const songs = [...queue.songs];
      if (startIndex >= 0 && startIndex < songs.length && endIndex >= 0 && endIndex < songs.length) {
        const [removed] = songs.splice(startIndex, 1);
        songs.splice(endIndex, 0, removed);
        queue.songs = songs;
        memQueues.set(roomId, queue);
      }
      return queue.songs;
    }
  }
  return [];
};

export const popNextSong = async (roomId) => {
  if (isUsingMongo) {
    const queue = await Queue.findOne({ roomId });
    if (queue && queue.songs.length > 0) {
      const nextSong = queue.songs.shift();
      await queue.save();

      // Update room state
      await Room.findOneAndUpdate(
        { roomId },
        {
          $set: {
            currentSong: {
              videoId: nextSong.videoId,
              title: nextSong.title,
              thumbnail: nextSong.thumbnail,
              duration: nextSong.duration
            },
            currentTime: 0,
            isPlaying: true
          }
        }
      );

      return { nextSong, queueSongs: queue.songs };
    }
  } else {
    const queue = memQueues.get(roomId);
    if (queue && queue.songs.length > 0) {
      const nextSong = queue.songs.shift();
      memQueues.set(roomId, queue);

      const room = memRooms.get(roomId);
      if (room) {
        room.currentSong = {
          videoId: nextSong.videoId,
          title: nextSong.title,
          thumbnail: nextSong.thumbnail,
          duration: nextSong.duration
        };
        room.currentTime = 0;
        room.isPlaying = true;
        memRooms.set(roomId, room);
      }
      return { nextSong, queueSongs: queue.songs };
    }
  }
  return null;
};
