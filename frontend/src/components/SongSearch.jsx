import React, { useState } from 'react';
import { Search, Plus, Loader, Link, Music } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export default function SongSearch({ socket, roomId, userName }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const extractVideoId = (url) => {
    if (url.includes('/shorts/')) {
      const parts = url.split('/shorts/');
      if (parts[1]) {
        const id = parts[1].split(/[?#&]/)[0];
        if (id.length === 11) return id;
      }
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setError('');
    const videoId = extractVideoId(query);

    if (videoId) {
      // Direct YouTube Link pasted
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/rooms/video-details?videoId=${videoId}`);
        if (!res.ok) throw new Error('Failed to retrieve video details');
        const details = await res.json();
        
        // Add directly to queue
        handleAddSong(details);
        setQuery('');
        setResults([]);
      } catch (err) {
        setError('Could not fetch details for that URL.');
      } finally {
        setLoading(false);
      }
    } else {
      // Text Search Query
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/rooms/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);
      } catch (err) {
        setError('Error querying YouTube videos. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddSong = (song) => {
    socket.emit('add-song', {
      roomId,
      videoId: song.videoId,
      title: song.title,
      thumbnail: song.thumbnail,
      duration: song.duration,
      addedBy: userName
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search YouTube or paste video URL..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {query.includes('youtube.com') || query.includes('youtu.be') ? (
              <Link className="w-4 h-4" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 rounded-xl bg-music-600 hover:bg-music-500 text-white font-medium text-sm transition flex items-center gap-1.5 shadow-lg shadow-music-600/20 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Search</span>}
        </button>
      </form>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Search results list */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {results.map((song) => (
            <div
              key={song.videoId}
              className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/5 group"
            >
              <img
                src={song.thumbnail}
                alt={song.title}
                className="w-16 h-10 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-semibold text-white truncate group-hover:text-music-300 transition">
                  {song.title}
                </h5>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Duration: {song.durationText || `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}`}
                </p>
              </div>
              <button
                onClick={() => {
                  handleAddSong(song);
                  // Remove from results to indicate added
                  setResults(prev => prev.filter(r => r.videoId !== song.videoId));
                }}
                className="p-1.5 rounded-lg bg-music-600/30 hover:bg-music-600 text-music-300 hover:text-white transition flex-shrink-0"
                title="Add to queue"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
