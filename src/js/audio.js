// 这是 public/experiment/audio.js 的副本，内容与 src/js/audio.js 保持一致
// audio.js
import { Howl, Howler } from 'howler';

const MUSIC_PATHS = {
  nostalgia: [
    '/music/nostalgia/黄家驹 - 光辉岁月1.mp3'
  ],
  neutral: [
    '/music/neutral/田源 - 乌梅子酱 2.mp3'
  ]
};

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

  getRandomTrack(group) {
    const tracks = MUSIC_PATHS[group] || [];
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
      const playMusic = () => {
        this.backgroundMusic = new Howl({
          src: [track],
          loop: true,
          volume: 0.3,
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
          onend: () => {
            this.interrupted = true;
            this.interruptedAt = Date.now();
          }
        });
        this.backgroundMusic.play();
      };
      playMusic();
    });
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