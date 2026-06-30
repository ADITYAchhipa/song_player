import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { 
  Users, MessageSquare, ListMusic, Copy, Check, LogOut, Send, 
  Sparkles, Shield, Compass, Radio
} from 'lucide-react';
import YoutubePlayer from '../components/YoutubePlayer';
import SongSearch from '../components/SongSearch';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  // Local user configurations
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [inputName, setInputName] = useState('');

  // Socket instance and state
  const [socket, setSocket] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [queue, setQueue] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState([]);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'chat', 'participants'
  
  // UI States
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef(null);

  // Initialize nickname and userID
  useEffect(() => {
    let savedName = localStorage.getItem('synctube_username') || '';
    let savedUid = localStorage.getItem('synctube_userid') || '';

    if (!savedUid) {
      savedUid = Math.random().toString(36).substring(2, 11);
      localStorage.setItem('synctube_userid', savedUid);
    }
    setUserId(savedUid);

    if (!savedName) {
      setShowNameModal(true);
    } else {
      setUserName(savedName);
    }
  }, []);

  // Connect to Socket.IO once nickname is ready
  useEffect(() => {
    if (!userName || !userId || !roomId) return;

    // Connect to backend via relative path or backend URL
    const socketConn = io(BACKEND_URL || '/', {
      transports: ['websocket', 'polling']
    });

    setSocket(socketConn);

    // Join room
    socketConn.emit('join-room', {
      roomId,
      userId,
      name: userName
    });

    // Listeners
    socketConn.on('init-state', ({ room, queue }) => {
      setRoomState(room);
      setQueue(queue);
      setParticipants(room.participants);
    });

    socketConn.on('room-updated', (updatedRoom) => {
      setRoomState(updatedRoom);
      setParticipants(updatedRoom.participants);
    });

    socketConn.on('play', ({ currentTime }) => {
      setRoomState(prev => prev ? { ...prev, isPlaying: true, currentTime } : null);
    });

    socketConn.on('pause', () => {
      setRoomState(prev => prev ? { ...prev, isPlaying: false } : null);
    });

    socketConn.on('seek', ({ currentTime }) => {
      setRoomState(prev => prev ? { ...prev, currentTime } : null);
    });

    socketConn.on('change-song', (currentSong) => {
      setRoomState(prev => prev ? { ...prev, currentSong, currentTime: 0, isPlaying: !!currentSong } : null);
    });

    socketConn.on('queue-updated', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    socketConn.on('chat-message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socketConn.on('reaction', (reaction) => {
      setReactions(prev => [...prev, reaction]);
      // Remove reaction after 4s to prevent DOM overload
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 4000);
    });

    socketConn.on('room-not-found', () => {
      alert('Room not found! Redirecting to home.');
      navigate('/');
    });

    socketConn.on('error', (err) => {
      console.error('Socket error:', err);
    });

    return () => {
      socketConn.disconnect();
    };
  }, [userName, userId, roomId, navigate]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;

    localStorage.setItem('synctube_username', inputName.trim());
    setUserName(inputName.trim());
    setShowNameModal(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.emit('chat-message', {
      roomId,
      senderName: userName,
      senderId: userId,
      text: chatInput.trim()
    });
    setChatInput('');
  };

  const emitReaction = (emoji) => {
    if (!socket) return;
    socket.emit('reaction', {
      roomId,
      type: emoji,
      senderName: userName
    });
  };

  const handleRemoveSong = (songId) => {
    if (!socket) return;
    socket.emit('remove-song', { roomId, songId });
  };

  const handleSkipSong = () => {
    if (!socket) return;
    socket.emit('next-song', { roomId });
  };

  const handleLeaveRoom = () => {
    navigate('/');
  };

  // Determine if local user is host
  const isLocalUserHost = participants.find(p => p.userId === userId)?.isHost || false;

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#0b0b0f] text-slate-100 overflow-hidden">
      {/* Background Lights */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-music-900/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-20%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none"></div>

      {/* Floating Reactions Render */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {reactions.map((r) => {
          // Compute random x-offset for drifting animation
          const randomX = (r.id.charCodeAt(0) % 50) - 25; // between -25 and +25
          const randomLeft = (r.id.charCodeAt(2) % 60) + 20; // between 20% and 80%
          return (
            <span
              key={r.id}
              className="reaction-particle"
              style={{
                left: `${randomLeft}%`,
                '--random-x': `${randomX}px`
              }}
            >
              {r.type}
            </span>
          );
        })}
      </div>

      {/* Header */}
      <header className="relative w-full py-4 px-6 flex items-center justify-between border-b border-white/5 bg-slate-950/40 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-music-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-music-500/20">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Sync<span className="text-music-400 font-medium">Tube</span>
            </span>
            <span className="ml-3 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-music-300 uppercase tracking-widest font-semibold">
              Room: {roomId?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 text-xs font-medium text-slate-200 hover:text-white transition duration-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy invite'}</span>
          </button>
          
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/35 hover:bg-rose-500/20 text-xs font-medium text-rose-300 transition duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden z-20">
        
        {/* Left Side: Player & Control Panels (Span 2) */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          <YoutubePlayer
            socket={socket}
            roomId={roomId}
            currentSong={roomState?.currentSong}
            isPlaying={roomState?.isPlaying || false}
            currentTime={roomState?.currentTime || 0}
            isHost={isLocalUserHost}
            onNextSong={handleSkipSong}
          />

          {/* Quick Reaction Bar */}
          <div className="flex items-center justify-between px-6 py-3.5 rounded-2xl bg-slate-900/40 border border-white/5 glass">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              Quick Reactions
            </span>
            <div className="flex gap-2">
              {['❤️', '😂', '🔥', '😮', '👍', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => emitReaction(emoji)}
                  className="w-10 h-10 rounded-xl hover:bg-white/10 text-xl transition active:scale-95 flex items-center justify-center hover:shadow-md hover:shadow-black/20"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right Side: Tabbed Sidebar */}
        <aside className="flex flex-col rounded-3xl bg-slate-900/40 border border-white/5 glass overflow-hidden h-[600px] lg:h-auto">
          {/* Tabs header */}
          <div className="flex border-b border-white/5 bg-slate-950/40">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition duration-200 ${
                activeTab === 'queue'
                  ? 'border-music-500 text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListMusic className="w-4 h-4" />
              Queue ({queue.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition duration-200 ${
                activeTab === 'chat'
                  ? 'border-music-500 text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat ({chatMessages.length})
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition duration-200 ${
                activeTab === 'participants'
                  ? 'border-music-500 text-white bg-white/[0.02]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Peers ({participants.length})
            </button>
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {/* Tab: Queue */}
            {activeTab === 'queue' && (
              <div className="flex flex-col gap-4 flex-1">
                <SongSearch socket={socket} roomId={roomId} userName={userName} />
                
                <div className="h-px bg-white/5"></div>
                
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 pl-1">Up Next</h4>
                  
                  {queue.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <Compass className="w-10 h-10 mb-2 stroke-1" />
                      <p className="text-xs">Queue is currently empty.</p>
                    </div>
                  ) : (
                    queue.map((song, index) => (
                      <div
                        key={song._id}
                        className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition group"
                      >
                        <span className="text-xs font-mono font-bold text-slate-500 w-4 text-center">
                          {index + 1}
                        </span>
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-12 h-9 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-semibold text-white truncate">
                            {song.title}
                          </h5>
                          <p className="text-[9px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                            <span>Added by {song.addedBy}</span>
                            <span>•</span>
                            <span>{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveSong(song._id)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 opacity-0 group-hover:opacity-100 transition"
                          title="Remove from queue"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Chat */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full flex-1">
                {/* Chat Log */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 mb-4 max-h-[420px] min-h-[300px]">
                  {chatMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center">
                      <MessageSquare className="w-10 h-10 stroke-1 mb-2" />
                      <p className="text-xs">Send a message to greet the room!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => {
                      const isSystem = msg.senderId === 'system';
                      const isMe = msg.senderId === userId;
                      
                      if (isSystem) {
                        return (
                          <div key={index} className="text-center py-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-medium text-slate-400">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={index}
                          className={`flex flex-col max-w-[85%] ${
                            isMe ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                            {msg.senderName}
                          </span>
                          <div
                            className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                              isMe
                                ? 'bg-music-600 text-white rounded-tr-none'
                                : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-white/5 pt-3 mt-auto">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs glass-input text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2.5 rounded-xl bg-music-600 hover:bg-music-500 text-white transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Tab: Participants */}
            {activeTab === 'participants' && (
              <div className="flex flex-col gap-2 flex-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">Room Members</h4>
                {participants.map((p) => (
                  <div
                    key={p.socketId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-music-500/10 border border-music-500/30 text-music-400 flex items-center justify-center text-xs font-extrabold">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          {p.name}
                          {p.userId === userId && (
                            <span className="text-[8px] bg-slate-800 border border-white/10 px-1 py-0.5 rounded text-slate-400 font-mono">Me</span>
                          )}
                        </h5>
                      </div>
                    </div>
                    {p.isHost && (
                      <span className="flex items-center gap-1 text-[8px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        <Shield className="w-2.5 h-2.5 fill-current" />
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Direct Invite Nickname Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-slate-950 border border-white/10 rounded-3xl p-6 sm:p-8 glass shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 text-center flex items-center justify-center gap-2">
              <Radio className="w-5 h-5 text-music-500 animate-pulse" />
              Join Playback Room
            </h3>
            <p className="text-slate-400 text-xs text-center mb-6 leading-relaxed">
              You've been invited to join this synchronized YouTube playlist. Please enter a name to proceed.
            </p>
            <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Enter nickname"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                required
                className="px-4 py-2.5 rounded-xl text-sm glass-input text-slate-100 placeholder-slate-500"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-music-600 to-indigo-600 hover:from-music-500 hover:to-indigo-500 text-white font-medium text-sm transition shadow-lg active:scale-95"
              >
                Connect to Room
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
