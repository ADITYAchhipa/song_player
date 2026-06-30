import { io } from 'socket.io-client';
import http from 'http';

const BACKEND_URL = 'http://127.0.0.1:5000';

async function runTests() {
  console.log('--- STARTING SYNC APP INTEGRATION TESTS ---');

  // 1. Verify YouTube search proxy works
  await new Promise((resolve) => {
    http.get(`${BACKEND_URL}/api/rooms/search?q=lofi`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (Array.isArray(results) && results.length > 0) {
            console.log(`✅ YouTube Search Proxy works. Found ${results.length} videos. First title: "${results[0].title}"`);
            resolve();
          } else {
            console.error('❌ YouTube Search Proxy returned empty or invalid results', results);
            process.exit(1);
          }
        } catch (err) {
          console.error('❌ Failed to parse search proxy response', err.message);
          process.exit(1);
        }
      });
    }).on('error', (err) => {
      console.error('❌ Failed to connect to search proxy endpoint', err.message);
      process.exit(1);
    });
  });

  // 2. Create room via HTTP post
  const room = await new Promise((resolve) => {
    const postData = JSON.stringify({ hostId: 'user_host_123', hostName: 'Aditya (Host)' });
    const req = http.request(`${BACKEND_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.roomId) {
            console.log(`✅ Room creation API works. Generated Room Code: ${result.roomId}`);
            resolve(result);
          } else {
            console.error('❌ Room creation failed to return roomId', result);
            process.exit(1);
          }
        } catch (err) {
          console.error('❌ Failed to parse room creation response', err.message);
          process.exit(1);
        }
      });
    });
    req.write(postData);
    req.end();
  });

  const roomId = room.roomId;

  // 3. Connect Host and Guest Sockets
  console.log('Connecting Host socket client...');
  const hostSocket = io(BACKEND_URL);
  
  console.log('Connecting Guest socket client...');
  const guestSocket = io(BACKEND_URL);

  let hostInitialized = false;
  let guestInitialized = false;

  await new Promise((resolve) => {
    let connectedCount = 0;
    const checkConnections = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    hostSocket.on('connect', checkConnections);
    guestSocket.on('connect', checkConnections);
  });
  console.log('✅ Both WebSockets connected to server.');

  // 4. Join room
  hostSocket.emit('join-room', { roomId, userId: 'user_host_123', name: 'Aditya (Host)' });
  
  await new Promise((resolve) => {
    hostSocket.on('init-state', (state) => {
      console.log('✅ Host initialized state.');
      hostInitialized = true;
      resolve();
    });
  });

  guestSocket.emit('join-room', { roomId, userId: 'user_guest_456', name: 'Friend (Guest)' });

  await new Promise((resolve) => {
    guestSocket.on('init-state', (state) => {
      console.log('✅ Guest initialized state.');
      guestInitialized = true;
      resolve();
    });
  });

  // 5. Test queue addition
  console.log('Host adding song to queue...');
  hostSocket.emit('add-song', {
    roomId,
    videoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    duration: 212,
    addedBy: 'Aditya (Host)'
  });

  // Verify guest receives queue update
  await new Promise((resolve) => {
    guestSocket.on('queue-updated', (queue) => {
      if (queue.length > 0 && queue[0].videoId === 'dQw4w9WgXcQ') {
        console.log(`✅ Queue Sync works. Guest received queue containing: "${queue[0].title}"`);
        resolve();
      }
    });
  });

  // Verify both clients receive track transition because queue was empty (auto play)
  const activeTrack = await new Promise((resolve) => {
    guestSocket.on('change-song', (song) => {
      if (song && song.videoId === 'dQw4w9WgXcQ') {
        console.log(`✅ Autoplay track transition works. Active song is: "${song.title}"`);
        resolve(song);
      }
    });
  });

  // 6. Test Play Sync
  console.log('Host triggers Play event...');
  hostSocket.emit('play', { roomId });

  await new Promise((resolve) => {
    guestSocket.on('play', () => {
      console.log('✅ Play Sync works. Guest received play command.');
      resolve();
    });
  });

  // 7. Test Seek Sync
  console.log('Host seeks to 125s...');
  hostSocket.emit('seek', { roomId, currentTime: 125 });

  await new Promise((resolve) => {
    guestSocket.on('seek', (data) => {
      if (data.currentTime === 125) {
        console.log(`✅ Seek Sync works. Guest received seek command at timestamp: ${data.currentTime}s`);
        resolve();
      }
    });
  });

  // 8. Test Pause Sync
  console.log('Host triggers Pause event...');
  hostSocket.emit('pause', { roomId });

  await new Promise((resolve) => {
    guestSocket.on('pause', () => {
      console.log('✅ Pause Sync works. Guest received pause command.');
      resolve();
    });
  });

  // 9. Test Chat Message Sync
  console.log('Guest sending chat message...');
  guestSocket.emit('chat-message', {
    roomId,
    senderName: 'Friend (Guest)',
    senderId: 'user_guest_456',
    text: 'This sync is super fast!'
  });

  await new Promise((resolve) => {
    hostSocket.on('chat-message', (msg) => {
      if (msg.senderId === 'user_guest_456') {
        console.log(`✅ Chat Sync works. Host received message: "${msg.text}" from ${msg.senderName}`);
        resolve();
      }
    });
  });

  // 10. Test Reaction Sync
  console.log('Guest sending reaction 🔥...');
  guestSocket.emit('reaction', {
    roomId,
    type: '🔥',
    senderName: 'Friend (Guest)'
  });

  await new Promise((resolve) => {
    hostSocket.on('reaction', (reaction) => {
      if (reaction.type === '🔥') {
        console.log(`✅ Reaction Sync works. Host received reaction: ${reaction.type}`);
        resolve();
      }
    });
  });

  // Disconnect sockets
  hostSocket.disconnect();
  guestSocket.disconnect();

  console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests();
