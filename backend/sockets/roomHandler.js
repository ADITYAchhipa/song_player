import * as storageService from '../services/storageService.js';

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room
    socket.on('join-room', async ({ roomId, userId, name }) => {
      if (!roomId || !userId || !name) {
        return socket.emit('error', 'Invalid join data');
      }

      const formattedRoomId = roomId.toUpperCase();
      console.log(`User ${name} (${userId}) joining room ${formattedRoomId}`);

      try {
        const room = await storageService.joinRoom(formattedRoomId, userId, name, socket.id);
        if (!room) {
          return socket.emit('room-not-found', 'Room does not exist');
        }

        socket.join(formattedRoomId);

        // Fetch current queue
        const queue = await storageService.getQueue(formattedRoomId);

        // Send full initial state to the joined user
        socket.emit('init-state', { room, queue });

        // Broadcast updated room details (participants) to everyone else in the room
        io.to(formattedRoomId).emit('room-updated', room);
        
        // Send a system message to chat
        io.to(formattedRoomId).emit('chat-message', {
          senderName: 'System',
          senderId: 'system',
          text: `${name} has joined the room.`,
          timestamp: new Date().toISOString()
        });

      } catch (err) {
        console.error('Error in join-room socket handler:', err.message);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Play
    socket.on('play', async ({ roomId }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const room = await storageService.updateRoomState(formattedRoomId, { isPlaying: true });
        if (room) {
          io.to(formattedRoomId).emit('play', { currentTime: room.currentTime });
        }
      } catch (err) {
        console.error('Error playing:', err.message);
      }
    });

    // Pause
    socket.on('pause', async ({ roomId }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const room = await storageService.updateRoomState(formattedRoomId, { isPlaying: false });
        if (room) {
          io.to(formattedRoomId).emit('pause');
        }
      } catch (err) {
        console.error('Error pausing:', err.message);
      }
    });

    // Seek
    socket.on('seek', async ({ roomId, currentTime }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const room = await storageService.updateRoomState(formattedRoomId, { currentTime });
        if (room) {
          io.to(formattedRoomId).emit('seek', { currentTime });
        }
      } catch (err) {
        console.error('Error seeking:', err.message);
      }
    });

    // Change Song
    socket.on('change-song', async ({ roomId, videoId, title, thumbnail, duration }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const currentSong = { videoId, title, thumbnail, duration };
        const room = await storageService.updateRoomState(formattedRoomId, {
          currentSong,
          currentTime: 0,
          isPlaying: true
        });
        if (room) {
          io.to(formattedRoomId).emit('change-song', currentSong);
        }
      } catch (err) {
        console.error('Error changing song:', err.message);
      }
    });

    // Add to Queue
    socket.on('add-song', async ({ roomId, videoId, title, thumbnail, duration, addedBy }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const updatedQueue = await storageService.addSongToQueue(formattedRoomId, {
          videoId,
          title,
          thumbnail,
          duration,
          addedBy
        });

        // Broadcast updated queue
        io.to(formattedRoomId).emit('queue-updated', updatedQueue);

        // If no song is currently playing, start playing this song immediately
        const room = await storageService.getRoom(formattedRoomId);
        if (room && (!room.currentSong || !room.currentSong.videoId)) {
          const { nextSong, queueSongs } = await storageService.popNextSong(formattedRoomId);
          io.to(formattedRoomId).emit('change-song', nextSong);
          io.to(formattedRoomId).emit('queue-updated', queueSongs);
        }
      } catch (err) {
        console.error('Error adding song to queue:', err.message);
      }
    });

    // Remove from Queue
    socket.on('remove-song', async ({ roomId, songId }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const updatedQueue = await storageService.removeSongFromQueue(formattedRoomId, songId);
        io.to(formattedRoomId).emit('queue-updated', updatedQueue);
      } catch (err) {
        console.error('Error removing song from queue:', err.message);
      }
    });

    // Reorder Queue
    socket.on('reorder-queue', async ({ roomId, startIndex, endIndex }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const updatedQueue = await storageService.reorderQueue(formattedRoomId, startIndex, endIndex);
        io.to(formattedRoomId).emit('queue-updated', updatedQueue);
      } catch (err) {
        console.error('Error reordering queue:', err.message);
      }
    });

    // Next Song (triggered by client when current song finishes or skip button pressed)
    socket.on('next-song', async ({ roomId, currentVideoId }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        const room = await storageService.getRoom(formattedRoomId);
        // If currentVideoId is supplied, prevent duplicate transitions if current track already changed
        if (currentVideoId && room?.currentSong?.videoId && room.currentSong.videoId !== currentVideoId) {
          console.log(`Ignoring duplicate next-song for room ${formattedRoomId}: track already changed.`);
          return;
        }

        const result = await storageService.popNextSong(formattedRoomId);
        if (result) {
          const { nextSong, queueSongs } = result;
          io.to(formattedRoomId).emit('change-song', nextSong);
          io.to(formattedRoomId).emit('queue-updated', queueSongs);
        } else {
          // No more songs in queue, reset current song
          await storageService.updateRoomState(formattedRoomId, {
            currentSong: null,
            currentTime: 0,
            isPlaying: false
          });
          io.to(formattedRoomId).emit('change-song', null);
        }
      } catch (err) {
        console.error('Error transitioning to next song:', err.message);
      }
    });

    // Periodic synchronization
    socket.on('sync', async ({ roomId, currentTime, isPlaying, isHost }) => {
      const formattedRoomId = roomId.toUpperCase();
      try {
        // Only update database from host's sync updates to prevent conflicts
        if (isHost) {
          await storageService.updateRoomState(formattedRoomId, { currentTime, isPlaying });
          // Broadcast sync to other participants
          socket.to(formattedRoomId).emit('sync', { currentTime, isPlaying });
        }
      } catch (err) {
        console.error('Error syncing:', err.message);
      }
    });

    // Live chat message
    socket.on('chat-message', ({ roomId, senderName, senderId, text }) => {
      const formattedRoomId = roomId.toUpperCase();
      const message = {
        senderName,
        senderId,
        text,
        timestamp: new Date().toISOString()
      };
      // Broadcast chat message to everyone in the room
      io.to(formattedRoomId).emit('chat-message', message);
    });

    // Reaction
    socket.on('reaction', ({ roomId, type, senderName }) => {
      const formattedRoomId = roomId.toUpperCase();
      io.to(formattedRoomId).emit('reaction', { type, senderName, id: Math.random().toString() });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      try {
        const room = await storageService.leaveRoomBySocket(socket.id);
        if (room) {
          if (room.deleted) {
            console.log(`Room ${room.roomId} deleted because all participants left.`);
          } else {
            // Broadcast room update (e.g. participant list change, new host assigned)
            io.to(room.roomId).emit('room-updated', room);

            // Find name of participant who left (if possible) or just post system message
            io.to(room.roomId).emit('chat-message', {
              senderName: 'System',
              senderId: 'system',
              text: `A user has left the room.`,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error('Error handling socket disconnect:', err.message);
      }
    });
  });
}
