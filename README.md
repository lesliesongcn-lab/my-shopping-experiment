# 怀旧与绿色消费行为实验平台
一个轻量高效的心理学实验平台，研究怀旧情绪对绿色消费行为的影响。

## 🎯 项目概述

本平台提供快速部署的心理学实验方案，包含：
- 被试信息收集
- 2D虚拟购物环境
- 实时数据记录
- 可视化数据看板

## ✨ 主要功能
### 实验模块
- 欢迎页面：实验介绍和知情同意
- 信息收集：被试基础信息登记
- 2D购物场景：
    - 静态商品图片展示（绿色/普通商品分类）
    - 点击交互购买功能
    -背景音乐自动播放（自然音效/白噪音分组）
- 实验完成：感谢页面与数据提交确认

### 数据管理
- 实时数据存储：Firebase控制台
- 管理后台：内置统计仪表盘
- 一键导出：CSV/JSON格式支持

## 🛠️ 技术栈
前端技术栈
- Vite - 极速构建工具
- 原生JavaScript - 轻量交互逻辑
- CSS3 - 响应式布局与动画
- Firebase SDK - 实时数据同步

## 后端服务
- Firebase Firestore - 无服务器数据库
- Firebase Authentication - 匿名用户跟踪
- Airtable - 可选数据可视化增强

## 📦 安装和运行
环境要求
Node.js 18+
Firebase项目（免费额度足够）

### 本地开发
bash
# 1. 安装依赖
npm install
# 2. 配置Firebase
cp .env.example .env # 填入你的Firebase配置
# 3. 启动开发服务器
npm run dev
访问 http://localhost:5175

### 生产部署
bash
npm run build
# 将dist/目录上传至Firebase Hosting或Vercel

# 🎮 使用指南
## 被试流程
- 访问实验URL → 阅读知情同意
- 填写被试编号（自动生成）
- 在2D商店中选择商品（3-5分钟时限）
- 查看简要统计并结束

## 研究人员操作
登录 Firebase控制台
查看实时数据集
使用内置分析工具或导出原始数据

# 📊 核心数据字段
字段	类型	说明
subject_id	string	匿名被试ID
music_type	string	音乐分组（nature/white_noise）
selected_products	array	购买商品ID列表
decision_time	number	总决策时间(ms)
green_ratio	float	绿色商品选择比例

# 🛡️ 数据安全
所有数据匿名存储（无PII信息）
实验链接含一次性访问token
支持自动清理过期数据

