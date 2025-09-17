// 这是 public/experiment/shopping-task-entry.js 的副本，内容与 src/js/shopping-task-entry.js 保持一致
// 入口文件：shopping-task-entry.js
// 依赖：audio.js、firebase.js 已通过 <script> 或 Vite 处理

window.addEventListener('DOMContentLoaded', function() {
  let audioManager = window.audioManager || new window.AudioManager();
  let group = localStorage.getItem('musicGroup') || 'neutral';
  let musicTrack = null;
  let musicStartTime = null;
  let musicInterrupted = false;
  let musicInterruptedAt = null;
  let musicPlayed = false;

  // 只在用户第一次交互后播放音乐，避免自动播放被拦截
  function tryPlayMusic() {
    if (musicPlayed) return;
    musicPlayed = true;
    audioManager.playGroupMusic(group).then(({track, startTime}) => {
      musicTrack = track;
      musicStartTime = startTime;
      document.getElementById('bgm-type').innerText = group === 'nostalgia' ? '怀旧音乐' : '中性音乐';
      // 不再赋值 audio 标签
    }).catch(() => {
      musicTrack = 'music_error';
      musicStartTime = Date.now();
      document.getElementById('bgm-type').innerText = '音乐加载失败';
    });
  }

  // 监听用户第一次点击
  document.body.addEventListener('pointerdown', tryPlayMusic, { once: true });

  // ---------------- 购物界面：商品数据与渲染 ----------------
  const BASE_ITEMS = [
    { id: 'food-coffee',    category: '食品',   name: '咖啡',   image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/food-coffee.png',   classicDesc: '醇香口感，提神醒脑',            ecoDesc: '公平贸易咖啡豆，环保包装' },
    { id: 'food-vegetable', category: '食品',   name: '蔬菜',   image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/food-vegetables.png',   classicDesc: '新鲜采摘，营养均衡',            ecoDesc: '有机种植，更可持续' },
    { id: 'textile-jacket', category: '纺织',   name: '冲锋衣', image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/textile-jacket.png', classicDesc: '防风防雨，耐磨耐穿',            ecoDesc: '再生面料，降低环境足迹' },
    { id: 'textile-bag',    category: '纺织',   name: '书包',   image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/textile-backpack.png',   classicDesc: '大容量多隔层，轻便耐用',        ecoDesc: '回收纤维制成，绿色出行' },
    { id: 'care-skin',      category: '个护',   name: '护肤',   image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/personal-care-skincare.png',   classicDesc: '深层滋养，水润保湿',            ecoDesc: '天然配方，无动物实验' },
    { id: 'care-soap',      category: '个护',   name: '香皂',   image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/personal-care-soap.png',     classicDesc: '洁净去污，温和不刺激',          ecoDesc: '可降解成分，纸质外包装' },
    { id: 'daily-clean1',   category: '日用',   name: '清洁剂A', image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/daily-cleaner-1.png', classicDesc: '强效去渍，使用便捷',            ecoDesc: '植物基配方，对水体更友好' },
    { id: 'daily-clean2',   category: '日用',   name: '清洁剂B', image: 'https://psychology-experiment-music.oss-cn-hongkong.aliyuncs.com/green-shopping-experiment/public/images/daily-cleaner-2.png', classicDesc: '快速清洁，气味清新',            ecoDesc: '低挥发无刺激，环保补充装' }
  ];

  // 展开为16个卡片：经典/环保两种文案，图片相同
  const PRODUCTS = BASE_ITEMS.flatMap(base => ([
    { key: base.id + '-classic', baseId: base.id, category: base.category, name: base.name, variant: 'classic', tag: '经典', image: base.image, desc: base.classicDesc },
    { key: base.id + '-eco',     baseId: base.id, category: base.category, name: base.name, variant: 'eco',     tag: '环保', image: base.image, desc: base.ecoDesc }
  ]));

  const state = {
    selectedItems: [] // 保存 key，例如 food-coffee-eco
  };
  window.greenShopping = state; // 供结束时读取

  function renderProducts() {
    const list = document.getElementById('product-list');
    if (!list) return;
    list.innerHTML = '';
    PRODUCTS.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card' + (p.variant === 'eco' ? ' green' : '');
      card.innerHTML = `
        <div class="tag">${p.tag}</div>
        <img src="${encodeURI(p.image)}" alt="${p.category}-${p.name}" style="width:100%;height:100px;object-fit:contain;"/>
        <div style="margin-top:8px;font-weight:600;">${p.category} · ${p.name}</div>
        <div style="font-size:12px;color:#666;margin:6px 0 10px;">${p.desc}</div>
        <button class="primary-btn" data-id="${p.key}" style="width:100%;padding:8px 0;border:none;border-radius:8px;background:linear-gradient(45deg,#81c784,#4db6ac);color:#fff;cursor:pointer;">加入购物车</button>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        toggleCart(id);
      });
    });
  }

  function toggleCart(id) {
    const idx = state.selectedItems.indexOf(id);
    if (idx >= 0) {
      state.selectedItems.splice(idx, 1);
    } else {
      state.selectedItems.push(id);
    }
    renderCart();
  }

  function renderCart() {
    const ul = document.getElementById('cart-list');
    if (!ul) return;
    ul.innerHTML = '';
    state.selectedItems.forEach(id => {
      const p = PRODUCTS.find(x => x.key === id);
      if (!p) return;
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.style.margin = '6px 0';
      li.innerHTML = `
        <span style="font-size:13px;color:#2c3e50;">${p.category}-${p.name}（${p.tag}）</span>
        <a href="#" data-remove="${p.key}" style="float:right;color:#e74c3c;text-decoration:none;">移除</a>
      `;
      ul.appendChild(li);
    });

    ul.querySelectorAll('a[data-remove]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.getAttribute('data-remove');
        toggleCart(id);
      });
    });
  }

  // ---------------- 倒计时 ----------------
  function startTimer(seconds) {
    const el = document.getElementById('timer');
    let remain = seconds;
    const tick = () => {
      const m = String(Math.floor(remain / 60)).padStart(2, '0');
      const s = String(remain % 60).padStart(2, '0');
      if (el) el.textContent = `剩余时间：${m}:${s}`;
      if (remain <= 0) {
        clearInterval(t);
        document.getElementById('finish-btn').click();
      }
      remain--;
    };
    tick();
    const t = setInterval(tick, 1000);
  }

  // 初始化渲染
  renderProducts();
  renderCart();
  startTimer(5 * 60);

  document.getElementById('finish-btn').onclick = async function() {
    audioManager.stop();
    if (window.musicInterrupted) {
      musicInterrupted = true;
      musicInterruptedAt = window.musicInterruptedAt;
    }
    let selectedItems = window.greenShopping ? window.greenShopping.selectedItems : [];
    let participant_id = window.participantData ? window.participantData.participant_id : 'unknown';
    let gender = window.participantData ? window.participantData.gender : 'unknown';
    if (window.saveExperimentData) {
      await window.saveExperimentData({
        participant_id,
        gender,
        music_condition: group,
        music_track: musicTrack,
        music_start_time: musicStartTime,
        music_interrupted: musicInterrupted,
        music_interrupted_at: musicInterruptedAt,
        selected_items: selectedItems
      });
    }
    window.location.href = '/experiment/end.html';
  };
});
