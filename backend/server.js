import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import roomRoutes from './routes/roomRoutes.js';
import { connectDB } from './services/storageService.js';
import registerSocketHandlers from './sockets/roomHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/youtube-music-room';

// Middleware
app.use(cors({
  origin: '*', // For development flexibility
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/rooms', roomRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Sync Server is running' });
});

// Create Server
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Register Socket handlers
registerSocketHandlers(io);

// Initialize DB and start server
const startServer = async () => {
  await connectDB(MONGODB_URI);
  httpServer.listen(PORT, () => {
    console.log(`Sync Server listening on port ${PORT}`);
  });
};

startServer();
