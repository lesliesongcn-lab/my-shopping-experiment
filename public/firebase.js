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
}

