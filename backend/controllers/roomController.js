import * as storageService from '../services/storageService.js';
import * as youtubeService from '../services/youtubeService.js';

const generateRoomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createRoom = async (req, res) => {
  try {
    const { hostId, hostName } = req.body;
    if (!hostId || !hostName) {
      return res.status(400).json({ error: 'hostId and hostName are required.' });
    }

    let roomId = generateRoomId();
    let existingRoom = await storageService.getRoom(roomId);
    
    // Ensure uniqueness
    while (existingRoom) {
      roomId = generateRoomId();
      existingRoom = await storageService.getRoom(roomId);
    }

    // Pass a placeholder socketId initially, it will update when they join the socket room
    const room = await storageService.createRoom(roomId, hostId, hostName, 'pending');
    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await storageService.getRoom(roomId.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    res.status(200).json(room);
  } catch (error) {
    console.error('Error getting room:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getQueue = async (req, res) => {
  try {
    const { roomId } = req.params;
    const queue = await storageService.getQueue(roomId.toUpperCase());
    res.status(200).json(queue);
  } catch (error) {
    console.error('Error getting queue:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchVideos = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query parameter (q) is required.' });
    }
    const results = await youtubeService.searchYouTube(q);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching YouTube:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getVideoDetails = async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) {
      return res.status(400).json({ error: 'videoId parameter is required.' });
    }
    const details = await youtubeService.getYouTubeVideoDetails(videoId);
    res.status(200).json(details);
  } catch (error) {
    console.error('Error getting video details:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
