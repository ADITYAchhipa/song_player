import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, ArrowRight, Radio, Music, Users, MessageSquare } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load previously used name if any
    const savedName = localStorage.getItem('synctube_username');
    if (savedName) setName(savedName);
  }, []);

  const handleNameChange = (val) => {
    setName(val);
    localStorage.setItem('synctube_username', val);
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError('Please enter your name first.');
      return;
    }
    setError('');
    setLoading(true);

    let userId = localStorage.getItem('synctube_userid');
    if (!userId) {
      userId = Math.random().toString(36).substring(2, 11);
      localStorage.setItem('synctube_userid', userId);
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: userId, hostName: name })
      });
      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();
      
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      console.error(err);
      setError('Could not create room. Is the backend server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name first.');
      return;
    }
    if (!roomCode.trim() || roomCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }
    setError('');
    setLoading(true);

    const formattedCode = roomCode.toUpperCase().trim();
    try {
      const res = await fetch(`/api/rooms/${formattedCode}`);
      if (!res.ok) {
        throw new Error('Room not found');
      }
      navigate(`/room/${formattedCode}`);
    } catch (err) {
      setError('Room not found. Please double check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#030014] overflow-hidden">
      {/* Background Neon Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-music-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative w-full max-w-4xl z-10 flex flex-col items-center text-center">
        {/* Header Logo */}
        <div className="flex items-center gap-3 mb-6 animate-float">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-music-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-music-500/30">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Sync<span className="text-music-400 font-medium">Tube</span>
          </span>
        </div>

        {/* Hero Section */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4 max-w-3xl leading-none">
          Listen to YouTube <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-music-400 via-indigo-400 to-violet-500">
            Together in Real-Time
          </span>
        </h1>
        <p className="text-slate-400 max-w-lg text-sm sm:text-base mb-10 leading-relaxed">
          Create a synchronized room, share the link with friends, search YouTube, and enjoy music with absolute sync. Play, pause, seek, chat, and react together.
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl max-w-md">
            {error}
          </div>
        )}

        {/* Input Details */}
        <div className="w-full max-w-2xl bg-slate-950/40 rounded-3xl p-6 sm:p-10 border border-white/5 glass shadow-2xl flex flex-col gap-8">
          {/* User Nickname */}
          <div className="flex flex-col gap-2 max-w-md mx-auto w-full">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-left pl-1">
              Your Nickname
            </label>
            <input
              type="text"
              placeholder="e.g. Alex, Sarah"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="px-4 py-3 rounded-xl text-base glass-input text-slate-100 placeholder-slate-500"
            />
          </div>

          <div className="h-px bg-white/5 w-full"></div>

          {/* Action Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {/* Box 1: Create */}
            <div className="flex flex-col justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-music-500/20 transition duration-300 group">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-music-500/10 text-music-400">
                    <Plus className="w-4 h-4" />
                  </span>
                  Create Room
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  Start a new session and become the host. You can invite friends to join via a simple code or custom link.
                </p>
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-music-600 to-indigo-600 hover:from-music-500 hover:to-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-music-600/20 flex items-center justify-center gap-2 group-hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Start New Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Box 2: Join */}
            <div className="flex flex-col justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-music-500/20 transition duration-300 group">
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Play className="w-4 h-4" />
                  </span>
                  Join Room
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  Have a room code? Paste it below to connect instantly to an existing playback session.
                </p>
              </div>
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-char code (e.g. ABCD12)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="px-4 py-2.5 rounded-xl text-sm glass-input text-slate-100 placeholder-slate-500 mb-2"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 font-medium text-sm transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>Connect Session</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-6 mt-16 max-w-3xl text-slate-400 text-xs sm:text-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-white/5">
              <Users className="w-5 h-5 text-music-400" />
            </div>
            <span className="font-semibold text-white">Multi-User Sync</span>
            <span className="text-[11px] text-slate-500">Auto-seek catchup within 2 seconds</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-white/5">
              <Music className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="font-semibold text-white">Public Search</span>
            <span className="text-[11px] text-slate-500">Query tracks directly inside the app</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-white/5">
              <MessageSquare className="w-5 h-5 text-violet-400" />
            </div>
            <span className="font-semibold text-white">Live Chat & Emojis</span>
            <span className="text-[11px] text-slate-500">React with floating emojis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
