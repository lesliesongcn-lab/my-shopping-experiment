const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 设置响应头以支持ES模块
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.set('Content-Type', 'application/javascript');
  }
  next();
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 音乐清单接口：返回 public/music/{nostalgia,neutral} 下的 mp3 列表
app.get('/api/music-list', (req, res) => {
  const baseDir = path.join(__dirname, 'public', 'music');
  const readGroup = (group) => {
    try {
      const dir = path.join(baseDir, group);
      const files = fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isFile())
        .map(d => d.name)
        .filter(name => /\.mp3$/i.test(name))
        .map(name => `/music/${group}/${name}`);
      return files;
    } catch (e) {
      return [];
    }
  };
  res.json({
    nostalgia: readGroup('nostalgia'),
    neutral: readGroup('neutral')
  });
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`实验运行在: http://localhost:${PORT}`);
});