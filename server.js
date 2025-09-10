const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// 解析 JSON 请求体
app.use(express.json());

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));
// 额外暴露 /src 以便加载样式与静态资源（如 /src/css/main.css）
app.use('/src', express.static(path.join(__dirname, 'src')));

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

// 简单的轮流分配：在 data/assign.json 中记录上次分配结果
const ASSIGN_FILE = path.join(__dirname, 'data', 'assign.json');
function readAssign(){
  try {
    const dir = path.dirname(ASSIGN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(ASSIGN_FILE)) fs.writeFileSync(ASSIGN_FILE, JSON.stringify({ last: null }), 'utf8');
    return JSON.parse(fs.readFileSync(ASSIGN_FILE, 'utf8'));
  } catch(e) { return { last: null }; }
}
function writeAssign(obj){
  const dir = path.dirname(ASSIGN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ASSIGN_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
// 不加鉴权，供信息页调用，返回 { group: 'neutral' | 'nostalgia' }
app.get('/api/assign-group', (req, res) => {
  const a = readAssign();
  const next = a.last === 'neutral' ? 'nostalgia' : 'neutral';
  writeAssign({ last: next });
  const now = new Date();
  const id = 'P' + now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  res.json({ group: next, participant_id: id });
});

// 基础访问控制（Basic Auth）用于保护 /admin 与数据接口
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'eco123';
function basicAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const [type, creds] = hdr.split(' ');
  if (type === 'Basic' && creds) {
    const [user, pass] = Buffer.from(creds, 'base64').toString().split(':');
    if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Restricted"');
  return res.status(401).send('Unauthorized');
}

// 数据存储文件路径
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'experiment-data.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readAllData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function appendData(record) {
  const all = readAllData();
  all.push(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf8');
}

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

// 管理端与数据读取接口保护（写入接口不鉴权，便于前端提交）
app.use(['/admin', '/api/experiment-stats', '/api/experiment-export.csv'], basicAuth);
// 查询全部数据也需要保护
app.use('/api/experiment-data', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'DELETE') return basicAuth(req, res, next);
  return next();
});

// 实验数据写入
app.post('/api/experiment-data', (req, res) => {
  try {
    const payload = req.body || {};
    const record = {
      _id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      received_at: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      user_agent: req.headers['user-agent'] || '',
      ...payload
    };
    appendData(record);
    res.json({ ok: true, id: record._id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// 删除单个实验数据
app.delete('/api/experiment-data/:id', (req, res) => {
  try {
    const id = req.params.id;
    const list = readAllData();
    const filteredList = list.filter(item => item._id !== id);
    
    if (filteredList.length === list.length) {
      return res.status(404).json({ ok: false, error: '数据未找到' });
    }
    
    // 重写整个数据文件
    fs.writeFileSync(DATA_FILE, JSON.stringify(filteredList, null, 2));
    res.json({ ok: true, message: '数据删除成功' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// 清空所有数据
app.delete('/api/experiment-data', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    res.json({ ok: true, message: '所有数据已清空' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// 获取所有实验数据
app.get('/api/experiment-data', (req, res) => {
  res.json(readAllData());
});

// 汇总统计
app.get('/api/experiment-stats', (req, res) => {
  const list = readAllData();
  const participants = new Set();
  let totalPurchases = 0;
  let ecoCount = 0;
  let classicCount = 0;
  let totalDurationMs = 0;
  let durationSamples = 0;
  let totalSpend = 0;

  list.forEach((r) => {
    const pid = r.participant_id || (r.subjectInfo && r.subjectInfo.id) || r.id;
    if (pid) participants.add(pid);
    if (Array.isArray(r.selected_items)) {
      totalPurchases += r.selected_items.length;
      r.selected_items.forEach((id) => {
        if (/\-eco$/.test(id)) ecoCount++; else classicCount++;
      });
    }
    if (typeof r.purchase_duration_ms === 'number') {
      totalDurationMs += r.purchase_duration_ms;
      durationSamples += 1;
    }
    if (typeof r.total_price === 'number') {
      totalSpend += r.total_price;
    }
  });

  const greenRatio = (ecoCount + classicCount) > 0 ? (ecoCount / (ecoCount + classicCount)) : 0;
  const avgDecisionSec = durationSamples > 0 ? (totalDurationMs / durationSamples / 1000) : 0;

  res.json({
    participants: participants.size,
    totalPurchases,
    greenRatio,
    avgDecisionSec,
    totalSpend
  });
});

// 导出被试层数据为CSV（Participant-level）
app.get('/api/experiment-export.csv', (req, res) => {
  try {
    const list = readAllData();
    const headers = [
      // 1.1 被试基本信息
      'participant_id','group','gender','age_range','education',
      // 1.2 实验表现
      'purchase_duration_sec','total_price','eco_selected','classic_selected','green_ratio',
      // 1.3 操作检查
      'device_type','platform','music_interrupted'
    ];
    const lines = [headers.join(',')];
    list.forEach((r) => {
      const subject = r.subjectInfo || {};
      const durationSec = r.purchase_duration_ms ? (r.purchase_duration_ms / 1000).toFixed(2) : '';
      const musicInterrupted = r.music_interrupted === true ? 1 : 0;
      
      // 重新计算绿色消费比例：eco_selected / 16
      const ecoSelected = Number(r.eco_selected) || 0;
      const greenRatio = (ecoSelected / 16).toFixed(4);
      
      const row = [
        // 1.1 被试基本信息
        JSON.stringify(r.participant_id || subject.id || ''),
        JSON.stringify(r.music_condition || r.group || ''),
        JSON.stringify(r.gender || subject.gender || ''),
        JSON.stringify(r.ageRange || subject.ageRange || ''),
        JSON.stringify(r.education || subject.education || ''),
        // 1.2 实验表现
        JSON.stringify(durationSec),
        JSON.stringify(r.total_price || 0),
        JSON.stringify(r.eco_selected || 0),
        JSON.stringify(r.classic_selected || 0),
        JSON.stringify(greenRatio),
        // 1.3 操作检查
        JSON.stringify(r.device_type || ''),
        JSON.stringify(r.platform || ''),
        JSON.stringify(musicInterrupted)
      ];
      lines.push(row.join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="participant-level-export.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

// 导出商品层数据为CSV（Item-level）
app.get('/api/product-level-export.csv', (req, res) => {
  try {
    const list = readAllData();
    const headers = [
      // 2.1 被试信息
      'participant_id','group',
      // 2.2 商品信息
      'product_id','category','variant','price',
      // 2.3 选择结果
      'selected',
      // 2.4 时间信息（预留）
      'decision_time_sec'
    ];
    const lines = [headers.join(',')];
    
    // 定义所有商品的基础信息（用于重建商品选择数据）
    const BASE_ITEMS = [
      { id: 'food-coffee',    category: '食品',   name: '咖啡',     classicName: '"醇享"黄金烘焙咖啡豆', ecoName: '"雨林守护"公平贸易咖啡豆', price: 59.0 },
      { id: 'food-vegetable', category: '食品',   name: '蔬菜',     classicName: '"鲜选"A级净菜沙拉包', ecoName: '"旬物"有机认证蔬菜篮', price: 29.0 },
      { id: 'textile-jacket', category: '纺织',   name: '冲锋衣',   classicName: '"山脊客"全能防风冲锋衣', ecoName: '"森呼吸"低碳环保冲锋衣', price: 239.0 },
      { id: 'textile-bag',    category: '纺织',   name: '书包',     classicName: '"都市行者"多功能防水书包', ecoName: '"万物新生"再生材料书包', price: 199.0 },
      { id: 'care-skin',      category: '个护',   name: '护肤',     classicName: '"焕能"多效修护乳液', ecoName: '"大地之选"植萃精华乳液', price: 129.0 },
      { id: 'care-soap',      category: '个护',   name: '香皂',     classicName: '"毛孔专家"深层清洁洁面膏', ecoName: '"零塑计划"氨基酸洁面皂', price: 19.9 },
      { id: 'daily-clean1',   category: '日用',   name: '洗衣液',   classicName: '"护色大师"防静电洗衣液', ecoName: '"简法"可补充装洗衣液', price: 59.0 },
      { id: 'daily-clean2',   category: '日用',   name: '家用清洁剂', classicName: '"油污克星"多用途浓缩清洁剂', ecoName: '"绿叶净"天然成分清洁剂', price: 39.0 }
    ];
    
    // 生成所有商品变体
    const ALL_PRODUCTS = BASE_ITEMS.flatMap(base => ([
      { key: base.id + '-classic', baseId: base.id, category: base.category, name: base.name, variant: 'classic', displayName: base.classicName, price: base.price },
      { key: base.id + '-eco',     baseId: base.id, category: base.category, name: base.name, variant: 'eco',     displayName: base.ecoName, price: base.price }
    ]));
    
    list.forEach((r) => {
      const subject = r.subjectInfo || {};
      const selectedItems = Array.isArray(r.selected_items) ? r.selected_items : [];
      
      // 为每个商品生成一行数据
      ALL_PRODUCTS.forEach(product => {
        const isSelected = selectedItems.includes(product.key) ? 1 : 0;
        const row = [
          // 2.1 被试信息
          JSON.stringify(r.participant_id || subject.id || ''),
          JSON.stringify(r.music_condition || r.group || ''),
          // 2.2 商品信息
          JSON.stringify(product.key || ''),
          JSON.stringify(product.category || ''),
          JSON.stringify(product.variant || ''),
          JSON.stringify(product.price || ''),
          // 2.3 选择结果
          JSON.stringify(isSelected),
          // 2.4 时间信息（预留，目前为空）
          JSON.stringify('')
        ];
        lines.push(row.join(','));
      });
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="item-level-export.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error('Product level export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`实验运行在: http://localhost:3000`);
});