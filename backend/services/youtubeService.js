import https from 'https';

export const searchYouTube = (query) => {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          // Look for ytInitialData script contents
          const match = data.match(/ytInitialData\s*=\s*({.+?});/);
          if (!match) {
            return resolve([]);
          }
          
          const json = JSON.parse(match[1]);
          const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
          
          if (!contents) {
            return resolve([]);
          }

          const videos = [];
          for (const item of contents) {
            if (item.videoRenderer) {
              const video = item.videoRenderer;
              const videoId = video.videoId;
              const title = video.title?.runs?.[0]?.text;
              const thumbnail = video.thumbnail?.thumbnails?.[0]?.url;
              const durationText = video.lengthText?.simpleText || '0:00';
              
              // Convert "4:15" to 255 seconds
              const parts = durationText.split(':').map(Number);
              let duration = 0;
              if (parts.length === 2) {
                duration = parts[0] * 60 + parts[1];
              } else if (parts.length === 3) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }

              if (videoId && title) {
                videos.push({
                  videoId,
                  title,
                  thumbnail,
                  duration,
                  durationText
                });
              }
            }
            if (videos.length >= 10) {
              break;
            }
          }
          resolve(videos);
        } catch (err) {
          console.error('Error parsing YouTube search results:', err.message);
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.error('Error fetching YouTube search:', err.message);
      resolve([]);
    });
  });
};

export const getYouTubeVideoDetails = (videoId) => {
  return new Promise((resolve) => {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    https.get(oembedUrl, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            const title = json.title || 'YouTube Video';
            resolve({
              videoId,
              title: title.trim() ? title : 'YouTube Video',
              thumbnail: json.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              duration: 0 // Will be dynamically resolved by the player on the client side
            });
            return;
          }
        } catch (e) {
          // ignore parse error and fall back
        }
        
        // Fall back to scraping watch page if oembed fails or returns non-200
        scrapeWatchPage(videoId, resolve);
      });
    }).on('error', (err) => {
      console.error('Error fetching oEmbed:', err.message);
      scrapeWatchPage(videoId, resolve);
    });
  });
};

const scrapeWatchPage = (videoId, resolve) => {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  };

  https.get(url, options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const titleMatch = data.match(/<meta\s+name="title"\s+content="([^"]+)"/) || data.match(/<title>([^<]+)<\/title>/);
        let title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'YouTube Video';
        title = (title && title.trim()) ? title : 'YouTube Video';
        
        let duration = 0;
        const durationMatch = data.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }

        resolve({
          videoId,
          title,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration
        });
      } catch (err) {
        console.error('Error extracting video details:', err.message);
        resolve({
          videoId,
          title: 'YouTube Video',
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: 0
        });
      }
    });
  }).on('error', (err) => {
    console.error('Error connecting to YouTube for scraping:', err.message);
    resolve({
      videoId,
      title: 'YouTube Video',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0
    });
  });
};

