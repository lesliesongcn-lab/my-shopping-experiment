// 这是 public/experiment/audio.js 的副本，内容与 src/js/audio.js 保持一致
// audio.js
import { Howl, Howler } from 'howler';

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
    const data = apiFirst || await tryFetch('/api-json/music-list.json');
    if (data && (data.nostalgia || data.neutral)) {
      MUSIC_PATHS = data;
    } else {
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
    const tracks = MUSIC_PATHS[group] || [];
    if (tracks.length === 0) return null;
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
        const playMusic = () => {
          this.backgroundMusic = new Howl({
            src: [track],
            loop: true,
            volume: 0.3,
            html5: true,
            preload: true,
            onplay: () => {
              this.interrupted = false;
              resolve({track, startTime: this.musicStartTime});
            },
            onloaderror: (id, err) => {
              this.retryCount++;
              if (this.retryCount < this.maxRetry) {
                setTimeout(playMusic, 500);
              } else {
                reject('music_error');
              }
            },
            onend: () => {}
          });
          this.backgroundMusic.play();
        };
        playMusic();
      };

      const needLoad = !Array.isArray(MUSIC_PATHS[group]) || MUSIC_PATHS[group].length === 0;
      if (needLoad) {
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
export default AudioManager;