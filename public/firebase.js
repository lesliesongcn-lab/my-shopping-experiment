// 适配 public 直引：依赖 firebase v8 CDN 与 /firebase-config.js 完成初始化
// Firestore 记录简化接口：subjects/experiment_data 两个集合

window.saveExperimentData = async function(payload){
  try {
    const db = firebase.firestore();
    await db.collection('experiment_data').add({
      created_at: new Date().toISOString(),
      ...payload
    });
  } catch (e) {
    console.error('实验数据保存失败:', e);
  }

  // 同步保存到本地后端，确保有后端落盘可导出
  try {
    await fetch('/api/experiment-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('后端保存失败（已忽略，不影响流程）:', e);
  }
}

