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
    // 优先使用真实接口，其次回退到静态清单文件
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
    const apiFirst = await tryFetch('/api/music-list');
    // 注意：/api 会被 Vite 代理，静态回退放到 /api-json 以绕过代理
    const data = apiFirst || await tryFetch('/api-json/music-list.json');
    if (data && (data.nostalgia || data.neutral)) {
      MUSIC_PATHS = data;
    } else {
      // 最终兜底：直接内置 OSS 地址，避免任何本地服务问题
      MUSIC_PATHS = {
        neutral: [
          'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/music/neutral/june-lang-lang.mp3'
        ],
        nostalgia: [
          'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/music/nostalgia/glorious-years-Beyond.mp3'
        ]
      };
    }
  }

  getLoopTrack(group) {
    const tracks = (MUSIC_PATHS[group] || []).slice();
    if (tracks.length === 0) return null;
    // 固定选第一首
    return tracks[0];
  }

  playGroupMusic(group) {
    return new Promise((resolve, reject) => {
      const startPlay = () => {
        const track = this.getLoopTrack(group);
        if (!track) return reject('no_track');
        this.currentTrack = track;
        this.musicStartTime = Date.now();
        this.retryCount = 0;

      // 构建候选 URL 列表：若为 http(s) 直链，只使用该 URL
      let candidates = [];
      if (/^https?:\/\//i.test(track)) {
        candidates = [track];
      } else {
        const noSlash = track.startsWith('/') ? track.substring(1) : track;
        const alt = track.replace('/music/', '/assets/audio/');
        const altNoSlash = (alt.startsWith('/') ? alt.substring(1) : alt);
        const segmentEncode = (p) => p.split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
        const candidatesRaw = [
          track.replace(/^\//, ''),
          track,
          '/' + noSlash,
          noSlash,
          alt,
          '/' + altNoSlash,
          altNoSlash
        ];
        candidates = [
          ...candidatesRaw,
          ...candidatesRaw.map(u => encodeURI(u)),
          ...candidatesRaw.map(u => segmentEncode(u))
        ];
      }

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
                  loop: true,
                  volume: 0.3,
                  html5: true,
                  preload: true,
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
          loop: true,
          volume: 0.3,
          html5: true,
          preload: true,
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
          }
        });
        this.backgroundMusic.play();
      };

      tryNext(0);
      };

      const needLoad = !Array.isArray(MUSIC_PATHS[group]) || MUSIC_PATHS[group].length === 0;
      if (needLoad && this.loadMusicList) {
        this.loadMusicList().then(startPlay).catch(startPlay);
      } else {
        startPlay();
      }
    });
  }

  // 不再需要连续随机连播，保留方法但改为调用单曲循环
  async playGroupForDuration(group, durationMs) {
    await this.loadMusicList();
    return this.playGroupMusic(group);
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