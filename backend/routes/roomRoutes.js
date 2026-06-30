import express from 'express';
import * as roomController from '../controllers/roomController.js';

const router = express.Router();

router.post('/', roomController.createRoom);
router.get('/search', roomController.searchVideos);
router.get('/video-details', roomController.getVideoDetails);
router.get('/:roomId', roomController.getRoom);
router.get('/:roomId/queue', roomController.getQueue);

export default router;
