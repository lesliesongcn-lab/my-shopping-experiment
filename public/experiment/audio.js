// 这是 public/experiment/audio.js 的副本，内容与 src/js/audio.js 保持一致
// audio.js
// 依赖 howler.js 已通过 CDN 在 HTML 中引入，无需 import
let MUSIC_PATHS = { nostalgia: [], neutral: [] };

class AudioManager {
  constructor() {
    this.backgroundMusic = null;
    this.currentTrack = null;
    this.retryCount = 0;
    this.maxRetry = 3;
    this.musicStartTime = null;
    this.interrupted = false;
    this.interruptedAt = null;
  }

  init() {
    // 加载背景音乐
    this.backgroundMusic = new Howl({
      src: ['assets/audio/background-music.mp3'], // 确保路径正确
      loop: true,
      volume: 0.5,
      onload: () => {
        console.log('背景音乐加载完成');
        // 将音乐对象挂载到window对象上，供其他模块使用
        window.backgroundMusic = this.backgroundMusic;
      },
      onloaderror: (id, error) => {
        console.warn('音乐加载失败:', error);
        // 即使音乐加载失败，也不影响实验进行
        window.backgroundMusic = {
          play: () => console.log('背景音乐播放（模拟）'),
          stop: () => console.log('背景音乐停止（模拟）')
        };
      }
    });
  }

  async loadMusicList() {
    // 先尝试动态接口，再回退到静态清单文件（适配Netlify等纯静态托管）
    const tryFetch = async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) return await res.json();
      } catch (_) {}
      clearTimeout(timer);
      return null;
    };
    // Netlify（静态）优先 json，其次才尝试接口（本地/后端环境）
    const jsonFirst = await tryFetch('/api/music-list.json');
    const data = jsonFirst || await tryFetch('/api/music-list');
    if (data && (data.nostalgia || data.neutral)) {
      MUSIC_PATHS = data;
    }
  }

  getRandomTrack(group) {
    const tracks = (MUSIC_PATHS[group] || []).slice();
    if (tracks.length === 0) return null;
    const idx = Math.floor(Math.random() * tracks.length);
    return tracks[idx];
  }

  playGroupMusic(group) {
    return new Promise((resolve, reject) => {
      const track = this.getRandomTrack(group);
      if (!track) return reject('no_track');
      this.currentTrack = track;
      this.musicStartTime = Date.now();
      this.retryCount = 0;

      // 构建多种路径尝试，适配不同部署环境
      const noSlash = track.startsWith('/') ? track.substring(1) : track;
      const alt = track.replace('/music/', '/assets/audio/');
      const altNoSlash = (alt.startsWith('/') ? alt.substring(1) : alt);
      const segmentEncode = (p) => p.split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
      
      // 优先尝试相对路径，再尝试绝对路径
      const candidatesRaw = [
        track.replace(/^\//, ''), // 相对路径
        track, // 绝对路径
        '/' + noSlash,
        noSlash,
        alt,
        '/' + altNoSlash,
        altNoSlash
      ];
      
      const candidates = [
        ...candidatesRaw,
        ...candidatesRaw.map(u => encodeURI(u)),
        ...candidatesRaw.map(u => segmentEncode(u))
      ];

              const tryNext = (idx) => {
          if (idx >= candidates.length) {
            console.warn('所有音乐路径尝试失败，组:', group, '曲目:', track);
            return reject('music_error');
          }
          const url = candidates[idx];
          console.log(`尝试播放音乐 [${idx + 1}/${candidates.length}]:`, url);
          
          // 尝试直接 URL 播放，失败再尝试 fetch->blob
          const tryBlob = () => {
            fetch(url, { cache: 'no-store' })
              .then(r => { 
                if (!r.ok) throw new Error('http ' + r.status); 
                return r.blob(); 
              })
              .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                try { if (this.backgroundMusic) { this.backgroundMusic.stop(); this.backgroundMusic.unload(); } } catch(_) {}
                this.backgroundMusic = new Howl({
                  src: [blobUrl],
                  loop: false,
                  volume: 0.3,
                  html5: true,
                  onplay: () => {
                    console.log('音乐播放成功 (blob):', url);
                    this.interrupted = false;
                    if (window.onMusicStarted) {
                      try { window.onMusicStarted({ group, track: url, startTime: this.musicStartTime }); } catch(e) {}
                    }
                    resolve({ track: url, startTime: this.musicStartTime });
                  },
                  onloaderror: (id, error) => {
                    console.warn('音乐加载失败 (blob):', url, error);
                    this.retryCount++;
                    URL.revokeObjectURL(blobUrl);
                    tryNext(idx + 1);
                  },
                  onend: () => {
                    console.log('音乐播放结束:', url);
                    try { if (window.onMusicEnded) window.onMusicEnded(); } catch(e) {}
                    this.interrupted = true;
                    this.interruptedAt = Date.now();
                  }
                });
                this.backgroundMusic.play();
              })
              .catch((error) => {
                console.warn('fetch blob 失败:', url, error);
                tryNext(idx + 1);
              });
          };

        try { if (this.backgroundMusic) { this.backgroundMusic.stop(); this.backgroundMusic.unload(); } } catch(_) {}
        this.backgroundMusic = new Howl({
          src: [url],
          loop: false,
          volume: 0.3,
          html5: true,
          onplay: () => {
            console.log('音乐播放成功 (直接):', url);
            this.interrupted = false;
            if (window.onMusicStarted) {
              try { window.onMusicStarted({ group, track: url, startTime: this.musicStartTime }); } catch(e) {}
            }
            resolve({ track: url, startTime: this.musicStartTime });
          },
          onloaderror: (id, error) => {
            console.warn('音乐加载失败 (直接):', url, error);
            // 直接 URL 失败，尝试 blob 方式
            tryBlob();
          },
          onend: () => {
            console.log('音乐播放结束:', url);
            try { if (window.onMusicEnded) window.onMusicEnded(); } catch(e) {}
            this.interrupted = true;
            this.interruptedAt = Date.now();
          }
        });
        this.backgroundMusic.play();
      };

      tryNext(0);
    });
  }

  // 连播：在指定时长内随机连续播放该组曲目
  async playGroupForDuration(group, durationMs) {
    await this.loadMusicList();
    const endAt = Date.now() + durationMs;
    const token = Date.now().toString();
    this.sequenceToken = token;
    
    const playNext = () => {
      if (this.sequenceToken !== token) return; // 另一轮播放已开始
      if (Date.now() >= endAt) {
        // 5分钟时间到，触发音乐结束事件（实验结束）
        try { if (window.onMusicEnded) window.onMusicEnded(); } catch(e) {}
        return;
      }
      
      this.playGroupMusic(group).then(({track}) => {
        // 设置当前曲目结束后的处理：播放下一首
        try { this.backgroundMusic.off('end'); } catch(_) {}
        this.backgroundMusic.on('end', () => {
          try { this.backgroundMusic.unload(); } catch(_) {}
          // 延迟50ms后播放下一首，避免重叠
          setTimeout(playNext, 50);
        });
        
        // 若 5 秒内没有触发 onplay，视为失败，跳到下一首
        setTimeout(() => {
          if (this.sequenceToken !== token) return;
          if (this.backgroundMusic && !this.backgroundMusic.playing()) {
            try { this.backgroundMusic.unload(); } catch(_) {}
            playNext();
          }
        }, 5000);
      }).catch(() => {
        // 如果这一首失败，直接尝试下一首
        setTimeout(playNext, 100);
      });
    };
    
    playNext();
  }

  play() {
    if (this.backgroundMusic) {
      this.backgroundMusic.play();
    }
  }

  stop() {
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
      if (this.interrupted) {
        window.musicInterrupted = true;
        window.musicInterruptedAt = this.interruptedAt;
      }
    }
  }

  setVolume(volume) {
    if (this.backgroundMusic) {
      this.backgroundMusic.volume(volume);
    }
  }
}

// 初始化音频管理器
window.addEventListener('DOMContentLoaded', () => {
  window.audioManager = new AudioManager();
});

window.AudioManager = AudioManager;