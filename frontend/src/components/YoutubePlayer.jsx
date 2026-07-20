import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, Radio } from 'lucide-react';

export default function YoutubePlayer({ socket, roomId, currentSong, isPlaying, currentTime, isHost, onNextSong }) {
  const playerRef = useRef(null);
  const playerInstance = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);

  // Sync refs to prevent stale closures in YouTube API event callbacks
  const socketRef = useRef(socket);
  const roomIdRef = useRef(roomId);
  const isHostRef = useRef(isHost);
  const currentSongRef = useRef(currentSong);
  const onNextSongRef = useRef(onNextSong);
  const handlePlayerStateChangeRef = useRef(null);

  useEffect(() => {
    socketRef.current = socket;
    roomIdRef.current = roomId;
    isHostRef.current = isHost;
    currentSongRef.current = currentSong;
    onNextSongRef.current = onNextSong;
  });

  // Sync refs to prevent infinite loop event triggers
  const isListeningToSocket = useRef(false);
  const expectedTime = useRef(0);
  const timeUpdateInterval = useRef(null);
  const hostSyncInterval = useRef(null);
  const loadedVideoId = useRef(null);

  // Load / Initialize Player
  useEffect(() => {
    // Check if window.YT is ready (it's preloaded in index.html)
    const initPlayer = () => {
      if (playerInstance.current) {
        // Player already exists, just load the song if different
        if (currentSong?.videoId && currentSong.videoId !== loadedVideoId.current) {
          loadedVideoId.current = currentSong.videoId;
          playerInstance.current.cueVideoById({
            videoId: currentSong.videoId,
            startSeconds: currentTime || 0
          });
        }
        return;
      }

      if (window.YT && window.YT.Player) {
        playerInstance.current = new window.YT.Player(playerRef.current, {
          videoId: currentSong?.videoId || '',
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 0,          // Disable default controls for our premium custom bar!
            disablekb: 1,         // Disable keyboard controls to enforce sync
            fs: 0,                // Disable fullscreen button in default UI
            modestbranding: 1,    // Hide YouTube logo
            rel: 0,               // Don't show related videos
            showinfo: 0,
            iv_load_policy: 3,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              setPlayerReady(true);
              event.target.setVolume(volume);
              setDuration(event.target.getDuration() || 0);

              if (currentSong?.videoId) {
                // If there's an active video, cue it and seek to the current time
                loadedVideoId.current = currentSong.videoId;
                event.target.cueVideoById({
                  videoId: currentSong.videoId,
                  startSeconds: currentTime || 0
                });
                
                if (isPlaying) {
                  isListeningToSocket.current = true;
                  event.target.playVideo();
                }
              }
            },
            onStateChange: (event) => {
              if (handlePlayerStateChangeRef.current) {
                handlePlayerStateChangeRef.current(event);
              }
            }
          }
        });
      } else {
        // Fallback retry
        setTimeout(initPlayer, 200);
      }
    };

    initPlayer();

    return () => {
      clearInterval(timeUpdateInterval.current);
      clearInterval(hostSyncInterval.current);
    };
  }, []);

  // Update video when currentSong changes
  useEffect(() => {
    if (!playerReady || !playerInstance.current) return;

    const player = playerInstance.current;

    if (currentSong && currentSong.videoId !== loadedVideoId.current) {
      console.log('Loading new video ID:', currentSong.videoId);
      loadedVideoId.current = currentSong.videoId;
      isListeningToSocket.current = true;
      player.loadVideoById({
        videoId: currentSong.videoId,
        startSeconds: 0
      });
      setDuration(0); // will be updated when playing starts
      
      if (!isPlaying) {
        isListeningToSocket.current = true;
        player.pauseVideo();
      }
    } else if (!currentSong && loadedVideoId.current !== null) {
      console.log('Stopping video because currentSong is null');
      loadedVideoId.current = null;
      isListeningToSocket.current = true;
      player.stopVideo();
      setDuration(0);
      setLocalTime(0);
    }
  }, [currentSong, playerReady]);

  // Handle Play/Pause changes from Parent (Sockets)
  useEffect(() => {
    if (!playerReady || !playerInstance.current || !currentSong) return;

    const player = playerInstance.current;
    const state = player.getPlayerState();

    if (isPlaying && state !== window.YT.PlayerState.PLAYING) {
      isListeningToSocket.current = true;
      player.playVideo();
      setLocalPlaying(true);
    } else if (!isPlaying && state === window.YT.PlayerState.PLAYING) {
      isListeningToSocket.current = true;
      player.pauseVideo();
      setLocalPlaying(false);
    }
  }, [isPlaying, playerReady, currentSong]);

  // Handle Seek changes from Parent (Sockets)
  useEffect(() => {
    if (!playerReady || !playerInstance.current || !currentSong) return;

    const player = playerInstance.current;
    const playerTime = player.getCurrentTime();

    if (Math.abs(playerTime - currentTime) > 2) {
      isListeningToSocket.current = true;
      player.seekTo(currentTime, true);
      expectedTime.current = currentTime;
      setLocalTime(currentTime);
    }
  }, [currentTime, playerReady, currentSong]);

  // Host Sync Broadcast
  useEffect(() => {
    if (hostSyncInterval.current) clearInterval(hostSyncInterval.current);

    if (isHost && playerReady && playerInstance.current && currentSong) {
      hostSyncInterval.current = setInterval(() => {
        const player = playerInstance.current;
        const curTime = player.getCurrentTime() || 0;
        const playing = player.getPlayerState() === window.YT.PlayerState.PLAYING;
        
        if (socket) {
          socket.emit('sync', {
            roomId,
            currentTime: curTime,
            isPlaying: playing,
            isHost: true
          });
        }
      }, 3000);
    }

    return () => clearInterval(hostSyncInterval.current);
  }, [isHost, playerReady, currentSong, roomId, socket]);

  // Local play status and seek detection timer
  useEffect(() => {
    if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);

    timeUpdateInterval.current = setInterval(() => {
      if (!playerReady || !playerInstance.current || !currentSong) return;

      const player = playerInstance.current;
      const actualTime = player.getCurrentTime() || 0;
      const isPlayerPlaying = player.getPlayerState() === window.YT.PlayerState.PLAYING;

      setLocalPlaying(isPlayerPlaying);
      setLocalTime(actualTime);
      
      const videoDuration = player.getDuration();
      if (videoDuration && duration !== videoDuration) {
        setDuration(videoDuration);
      }

      // Seek detection
      if (isPlayerPlaying) {
        const drift = Math.abs(actualTime - expectedTime.current);
        if (drift > 1.8) {
          // User manually seeked!
          if (!isListeningToSocket.current && socket) {
            console.log('Manual seek detected. Emitting socket seek to:', actualTime);
            socket.emit('seek', { roomId, currentTime: actualTime });
          }
        }
        expectedTime.current = actualTime;
      } else {
        expectedTime.current = actualTime;
      }

      // Reset the socket event block flag after a small timeout
      if (isListeningToSocket.current) {
        isListeningToSocket.current = false;
      }
    }, 500);

    return () => clearInterval(timeUpdateInterval.current);
  }, [playerReady, currentSong, duration, roomId, socket]);

  // Handle Player State changes from YT API
  const handlePlayerStateChange = (event) => {
    const state = event.data;
    const player = playerInstance.current;
    const actualTime = player ? (player.getCurrentTime() || 0) : 0;
    const sock = socketRef.current;
    const rId = roomIdRef.current;
    const curSong = currentSongRef.current;

    if (state === window.YT.PlayerState.PLAYING) {
      if (!isListeningToSocket.current && sock) {
        console.log('Manual play detected. Emitting socket play.');
        sock.emit('play', { roomId: rId });
        sock.emit('seek', { roomId: rId, currentTime: actualTime });
      }
      setLocalPlaying(true);
    } else if (state === window.YT.PlayerState.PAUSED) {
      if (!isListeningToSocket.current && sock) {
        console.log('Manual pause detected. Emitting socket pause.');
        sock.emit('pause', { roomId: rId });
      }
      setLocalPlaying(false);
    } else if (state === window.YT.PlayerState.ENDED) {
      console.log('Video ended. Triggering next song.');
      if (sock) {
        sock.emit('next-song', { roomId: rId, currentVideoId: curSong?.videoId });
      } else if (onNextSongRef.current) {
        onNextSongRef.current();
      }
    }
  };

  handlePlayerStateChangeRef.current = handlePlayerStateChange;

  // User Actions (Buttons)
  const togglePlayPause = () => {
    if (!playerReady || !currentSong || !socket) return;
    
    if (localPlaying) {
      socket.emit('pause', { roomId });
    } else {
      socket.emit('play', { roomId });
    }
  };

  const handleProgressBarChange = (e) => {
    if (!playerReady || !currentSong) return;
    const newTime = parseFloat(e.target.value);
    setLocalTime(newTime);
    expectedTime.current = newTime;
    
    // Perform seek
    isListeningToSocket.current = true;
    playerInstance.current.seekTo(newTime, true);
    if (socket) {
      socket.emit('seek', { roomId, currentTime: newTime });
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerInstance.current) {
      playerInstance.current.setVolume(val);
      if (val > 0) {
        playerInstance.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (!playerInstance.current) return;
    if (isMuted) {
      playerInstance.current.unMute();
      playerInstance.current.setVolume(volume);
      setIsMuted(false);
    } else {
      playerInstance.current.mute();
      setIsMuted(true);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-900/40 rounded-3xl overflow-hidden glass shadow-2xl">
      {/* Video IFrame Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center group">
        <div ref={playerRef} className="w-full h-full"></div>
        
        {/* Empty Room State Placeholder overlay */}
        {!currentSong && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6 transition-all duration-300">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-music-500/20 blur-xl animate-pulse-slow"></div>
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-music-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-music-500/30">
                <Radio className="w-10 h-10 animate-pulse" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No song is currently playing</h3>
            <p className="text-slate-400 max-w-sm text-sm">
              Search for YouTube tracks in the sidebar or paste a link to build the room playlist.
            </p>
          </div>
        )}
      </div>

      {/* Custom Control Bar */}
      <div className="p-5 flex flex-col gap-4 bg-slate-950/80 border-t border-white/5">
        {/* Video metadata */}
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-4">
            <h4 className="text-base font-semibold text-white truncate">
              {currentSong ? currentSong.title : 'Waiting for track...'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              {currentSong ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Synchronized Playback
                </>
              ) : (
                'Room Idle'
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Skip button */}
            <button 
              onClick={onNextSong}
              disabled={!currentSong}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition disabled:opacity-40 disabled:hover:bg-white/5"
              title="Skip Song"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Slider */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs font-mono text-slate-400 w-10 text-right">
            {formatTime(localTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={localTime || 0}
            onChange={handleProgressBarChange}
            disabled={!currentSong}
            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-music-500 hover:accent-music-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs font-mono text-slate-400 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Play/Pause & Volume controls */}
        <div className="flex justify-between items-center mt-1">
          {/* Main Play Toggle */}
          <button
            onClick={togglePlayPause}
            disabled={!currentSong}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-music-600 to-indigo-600 hover:from-music-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-music-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {localPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Session</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Session</span>
              </>
            )}
          </button>

          {/* Volume Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-white transition"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 md:w-24 h-1 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-slate-400 hover:accent-music-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
