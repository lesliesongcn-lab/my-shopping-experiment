// 这是 public/experiment/shopping-task-entry.js 的副本，内容与 src/js/shopping-task-entry.js 保持一致
// 入口文件：shopping-task-entry.js
// 依赖：audio.js、firebase.js 已通过 <script> 或 Vite 处理

window.addEventListener('DOMContentLoaded', function() {
  let audioManager = window.audioManager || new window.AudioManager();
  // 以被试编号为准：P+单数 -> nostalgia，P+双数 -> neutral。
  // 若没有被试编号，再回退到已有的 localStorage 或随机。
  let group = null;
  try {
    const si = JSON.parse(localStorage.getItem('subjectInfo') || 'null');
    if (si && si.id) {
      const num = parseInt(String(si.id).replace(/\D/g, ''), 10);
      if (!isNaN(num)) {
        group = (num % 2 === 1) ? 'nostalgia' : 'neutral';
        localStorage.setItem('musicGroup', group);
      }
    }
  } catch (e) {}
  if (!group) {
    group = localStorage.getItem('musicGroup');
  }
  if (!group) {
    group = Math.random() < 0.5 ? 'neutral' : 'nostalgia';
    localStorage.setItem('musicGroup', group);
  }
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
      // 顶部标语若存在则保持
    }).catch(() => {
      musicTrack = 'music_error';
      musicStartTime = Date.now();
      // 若没有音乐组件，忽略错误，后续序列播放会重试
    });
  }

  // 需求：进入页面即播放音乐（不等待点击）。若被浏览器阻止，将在首次交互时重试一次。
  // 开始播放音乐：五分钟内随机连播同组曲目，并在成功时写入Firebase
  window.onMusicStarted = ({ group, track, startTime }) => {
    // 若存在全局保存函数，则写入
    if (window.saveExperimentData) {
      window.saveExperimentData({
        type: 'music_start',
        music_condition: group,
        music_track: track,
        music_start_time: startTime
      });
    }
  };
  // 使用新逻辑：在 5 分钟内连续播放该组的多首音乐
  // 为兼容浏览器自动播放策略：在首次用户交互时启动音乐序列
  let sequenceStarted = false;
  const startSequence = () => {
    if (sequenceStarted) return;
    sequenceStarted = true;
    try {
      if (audioManager.playGroupForDuration) {
        audioManager.playGroupForDuration(group, 5 * 60 * 1000);
      } else {
        tryPlayMusic();
      }
    } catch (e) {
      tryPlayMusic();
    }
  };
  // 优先尝试立即启动（部分浏览器允许）；若被拦截，下面的交互事件会再次触发
  setTimeout(startSequence, 0);
  document.addEventListener('pointerdown', startSequence, { once: true });
  document.addEventListener('keydown', startSequence, { once: true });
  document.body.addEventListener('pointerdown', tryPlayMusic, { once: true });

  // ---------------- 购物界面：商品数据与渲染 ----------------
  const BASE_ITEMS = [
    // 食品类
    { id: 'food-coffee',    category: '食品',   name: '咖啡',     image: '/images/食品-咖啡.png',
      classicName: '“醇享”黄金烘焙咖啡豆', ecoName: '“雨林守护”公平贸易咖啡豆',
      classicDesc: '大师级风味： 精选高地豆，经精准黄金比例烘焙，呈现均衡而浓郁的黑巧克力与坚果风味。',
      ecoDesc: '有爱的好味道： 获公平贸易认证，确保咖农福祉，采用遮荫种植，保护雨林生态。', price: 59.0 },
    { id: 'food-vegetable', category: '食品',   name: '蔬菜',     image: '/images/食品-蔬菜.png',
      classicName: '“鲜选”A级净菜沙拉包', ecoName: '“旬物”有机认证蔬菜篮',
      classicDesc: '便捷轻生活： 严选优质产区A级蔬菜，经过清洗、切配、杀菌，开袋即食，省心美味。',
      ecoDesc: '品尝自然本味： 当季有机种植蔬菜，无化学农药，减少环境负担，配送无塑料包装。', price: 29.0 },
    // 纺织类
    { id: 'textile-jacket', category: '纺织',   name: '冲锋衣',   image: '/images/纺织-冲锋衣.png',
      classicName: '“山脊客”全能防风冲锋衣', ecoName: '“森呼吸”低碳环保冲锋衣',
      classicDesc: '专注户外性能： 采用高密度耐磨防风面料，轻便便携，无惧恶劣天气，助你畅快出行。',
      ecoDesc: '为地球减负： 采用再生尼龙面料，历经环保工艺制作，提供可靠防护的同时，减少碳排放。', price: 239.0 },
    { id: 'textile-bag',    category: '纺织',   name: '书包',     image: '/images/纺织-书包.png',
      classicName: '“都市行者”多功能防水书包', ecoName: '“万物新生”再生材料书包',
      classicDesc: '轻松应对日常： 采用高性能防水面料，多隔层分区设计，兼顾超大容量与便利收纳。',
      ecoDesc: '背负有度： 包身主要面料由再生环保材料制成，结实耐用，赋予废弃资源新的生命。', price: 199.0 },
    // 个护类
    { id: 'care-skin',      category: '个护',   name: '护肤',     image: '/images/个护-护肤.png',
      classicName: '“焕能”多效修护乳液', ecoName: '“大地之选”植萃精华乳液',
      classicDesc: '精准护肤： 富含高活性复合成分，专注提亮、修护、保湿，解决多种肌肤问题。',
      ecoDesc: '肌肤与自然共呼吸： 核心成分为天然植物萃取，温和滋养，包装为可回收材质。', price: 129.0 },
    { id: 'care-soap',      category: '个护',   name: '香皂',     image: '/images/个护-皂.png',
      classicName: '“毛孔专家”深层清洁洁面膏', ecoName: '“零塑计划”氨基酸洁面皂',
      classicDesc: '彻底净肤： 主打深层清洁与毛孔护理，泡沫绵密，有效卸除淡妆与多余油脂。',
      ecoDesc: '精简护肤： 植物基氨基酸配方，温和洁净，无塑包装，对环境友好，旅行便携。', price: 19.9 },
    // 日用品类
    { id: 'daily-clean1',   category: '日用',   name: '洗衣液',   image: '/images/日用-清洁1.png',
      classicName: '“护色大师”防静电洗衣液', ecoName: '“简法”可补充装洗衣液',
      classicDesc: '科技护衣： 搞定清洁、柔顺、护色，防静电技术让衣物持久清新顺滑。',
      ecoDesc: '循环减塑： 购买补充装，减少塑料消耗。成分为植物基底，温和呵护衣物与肌肤。', price: 59.0 },
    { id: 'daily-clean2',   category: '日用',   name: '家用清洁剂', image: '/images/日用-清洁2.png',
      classicName: '“油污克星”多用途浓缩清洁剂', ecoName: '“绿叶净”天然成分清洁剂',
      classicDesc: '一招致净： 强效去污配方，一瓶搞定厨房、浴室等多种场景的顽固污垢，省时省力。',
      ecoDesc: '源自自然： 萃取天然植物活性成分，高效去油的同时，生物降解度高，减少水体负担。', price: 39.0 }
  ];

  // 展开为16个卡片：经典/环保两种文案，图片相同
  const PRODUCTS = BASE_ITEMS.flatMap(base => ([
    { key: base.id + '-classic', baseId: base.id, category: base.category, name: base.name, variant: 'classic', tag: '', image: base.image, desc: base.classicDesc },
    { key: base.id + '-eco',     baseId: base.id, category: base.category, name: base.name, variant: 'eco',     tag: '', image: base.image, desc: base.ecoDesc }
  ]));

  const state = {
    selectedItems: [], // 保存 key，例如 food-coffee-eco
    category: '全部',
    sort: 'default'
  };
  window.greenShopping = state; // 供结束时读取

  function renderProducts() {
    const list = document.getElementById('product-list');
    if (!list) return;
    list.innerHTML = '';

    // 过滤与排序
    let items = PRODUCTS.slice();
    if (state.category !== '全部') items = items.filter(p => p.category === state.category);
    if (state.sort === 'price-asc') items.sort((a,b)=> baseOf(a).price - baseOf(b).price);
    if (state.sort === 'price-desc') items.sort((a,b)=> baseOf(b).price - baseOf(a).price);

    items.forEach(p => {
      const base = baseOf(p);
      const card = document.createElement('div');
      card.className = 'product-card';
      const displayName = p.variant === 'eco' ? (base.ecoName || base.name) : (base.classicName || base.name);
      card.innerHTML = `
        <img src="${encodeURI(p.image)}" alt="${p.category}-${p.name}"/>
        <div class="p-mid">
          <div class="title">${displayName}</div>
          <div class="desc">${p.desc}</div>
        </div>
        <div class="p-right">
          <span class="price">￥${base.price.toFixed(2)}</span>
          <button class="primary-btn" data-id="${p.key}">加入购物车</button>
        </div>
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

  function baseOf(prod){
    const b = BASE_ITEMS.find(x=> x.id === prod.baseId);
    return b || { price: 0 };
  }

  function toggleCart(id) {
    const idx = state.selectedItems.indexOf(id);
    if (idx >= 0) {
      state.selectedItems.splice(idx, 1);
    } else {
      state.selectedItems.push(id);
    }
    renderCart();
    renderDrawer();
  }

  function renderCart() {
    const countEl = document.getElementById('cart-count');
    if (countEl) countEl.textContent = String(state.selectedItems.length);
  }

  function renderDrawer(){
    const list = document.getElementById('drawer-list');
    const totalEl = document.getElementById('drawer-total');
    if (!list || !totalEl) return;
    list.innerHTML = '';
    let total = 0;
    state.selectedItems.forEach(id => {
      const p = PRODUCTS.find(x => x.key === id);
      if (!p) return;
      const base = baseOf(p);
      const displayName = p.variant === 'eco' ? (base.ecoName || base.name) : (base.classicName || base.name);
      total += base.price;
      const item = document.createElement('div');
      item.className = 'cart-item';
      item.innerHTML = `
        <img src="${encodeURI(p.image)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;background:#fafafa;"/>
        <div>
          <div style="font-size:13px;color:#2c3e50;">${displayName}</div>
          <div class="meta">￥${base.price.toFixed(2)}</div>
        </div>
        <a href="#" class="remove" data-remove="${p.key}">移除</a>
      `;
      list.appendChild(item);
    });
    totalEl.textContent = '￥' + total.toFixed(2);
    list.querySelectorAll('a[data-remove]').forEach(a => {
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
  renderDrawer();
  initCategoryAndSort();
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
        selected_items: selectedItems,
        selected_categories: Array.from(new Set(selectedItems
          .map(id => PRODUCTS.find(x=>x.key===id))
          .filter(Boolean)
          .map(p => p.category)))
      });
    }
    window.location.href = '/experiment/end.html';
  };

  // 购物车抽屉开关
  const toggleBtn = document.getElementById('cart-toggle');
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-backdrop');
  const closeBtn = document.getElementById('cart-close');
  const openDrawer = () => { drawer.classList.add('show'); backdrop.classList.add('show'); };
  const closeDrawer = () => { drawer.classList.remove('show'); backdrop.classList.remove('show'); };
  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); closeDrawer(); });

  const checkoutBtn = document.getElementById('drawer-checkout');
  if (checkoutBtn) checkoutBtn.addEventListener('click', async ()=>{
    // 直接触发完成逻辑
    document.getElementById('finish-btn').click();
  });

  // 音乐播放完毕时也自动结束
  window.onMusicEnded = () => {
    if (!document.hidden) {
      document.getElementById('finish-btn').click();
    }
  };

  function initCategoryAndSort(){
    const categories = ['全部', ...Array.from(new Set(BASE_ITEMS.map(i=>i.category)))];
    const ul = document.getElementById('category-list');
    if (ul){
      ul.innerHTML = '';
      categories.forEach(cat => {
        const li = document.createElement('li');
        li.textContent = cat;
        if (cat === state.category) li.classList.add('active');
        li.addEventListener('click', () => {
          state.category = cat;
          ul.querySelectorAll('li').forEach(n=>n.classList.remove('active'));
          li.classList.add('active');
          renderProducts();
        });
        ul.appendChild(li);
      });
    }
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect){
      sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        renderProducts();
      });
    }
  }
});
