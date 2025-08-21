// experiment.js
import jsPsych from 'jspsych';
import { saveSubjectInfo } from './firebase.js';
import AudioManager from './audio.js';

console.log('jsPsych version:', jsPsych.version); // 检查 jsPsych 是否正确加载

// 分组逻辑：首次访问分配分组并存储
function assignMusicGroup() {
  let group = localStorage.getItem('musicGroup');
  if (!group) {
    group = Math.random() < 0.5 ? 'nostalgia' : 'neutral';
    localStorage.setItem('musicGroup', group);
  }
  return group;
}

const experiment = {
  init() {
    console.log('Experiment initialization started'); // 实验初始化开始

    // 定义实验时间(3-5分钟，这里设为4分钟)
    const shoppingTime = 4 * 60; // 4分钟

    const timeline = [];

    // 被试信息收集页面
    const demographicsTrial = {
      type: jsPsych.SurveyHtmlForm,
      preamble: '<div class="demographics-screen"><div class="instructions"><h3>指导语</h3><p>欢迎您参与本次实验研究！本实验旨在了解消费者的绿色购物行为，您的参与将对我们的研究非常有帮助。</p><ul><li>本实验完全匿名，您的个人信息仅用于实验分组，不会泄露您的隐私</li><li>实验数据仅用于学术研究，不会用于任何商业用途</li><li>您可以随时退出实验而无需承担任何后果</li><li>请根据您的真实情况填写以下信息</li></ul></div>',
      html: '<div class="demographics-form"><div class="form-group"><label for="participant_id">被试编号:</label><input type="text" id="participant_id" name="participant_id" required></div><div class="form-group"><label for="gender">性别:</label><select id="gender" name="gender" required><option value="">请选择</option><option value="male">男</option><option value="female">女</option><option value="other">其他</option></select></div></div>',
      button_label: '开始体验',
      on_load: () => {
        console.log('Demographics trial loaded'); // 被试信息页面加载
        // 更新容器样式
        const container = document.querySelector('.jspsych-content-wrapper');
        if (container) {
          container.style.background = 'transparent';
        }
      },
      on_finish: (data) => {
        console.log('Demographics collected:', data);
        // 存储被试信息到全局变量
        window.participantData = {
          participant_id: data.response.participant_id,
          gender: data.response.gender
        };
        // 分组分配
        const group = assignMusicGroup();
        window.participantData.music_condition = group;
        // 保存分组到Firebase
        saveSubjectInfo({
          participant_id: data.response.participant_id,
          gender: data.response.gender,
          music_condition: group
        });
      }
    };
    timeline.push(demographicsTrial);

    // 欢迎页面
    const welcomeTrial = {
      type: jsPsych.HtmlKeyboardResponse,
      stimulus: `
        <div class="welcome-screen">
          <h1>购物模拟体验</h1>
          <p>欢迎使用本平台进行一次简短的选购体验</p>
          <p>您将在3D虚拟商店中进行购物，限时${shoppingTime / 60}分钟</p>
          <p>请根据您的直觉选择商品</p>
          <p>按任意键开始</p>
        </div>
      `,
      on_load: () => {
        console.log('Welcome trial loaded'); // 欢迎页面加载
      }
    };
    timeline.push(welcomeTrial);

    // 购物任务
    const shoppingTrial = {
      type: jsPsych.HtmlButtonResponse,
      stimulus: '<div id="shopping-scene" class="loading"><div class="spinner"></div></div>',
      choices: ['结束购物'],
      trial_duration: shoppingTime * 1000, // 转换为毫秒
      on_start: () => {
        console.log('Shopping trial started'); // 购物任务开始

        // 音乐播放逻辑
        const group = window.participantData.music_condition;
        if (!window.audioManager) {
          window.audioManager = new AudioManager();
        }
        window.audioManager.playGroupMusic(group)
          .then(({track, startTime}) => {
            window.musicTrack = track;
            window.musicStartTime = startTime;
          })
          .catch((err) => {
            window.musicTrack = 'music_error';
            window.musicStartTime = Date.now();
          });

        // 移除加载提示
        setTimeout(() => {
          const sceneElement = document.getElementById('shopping-scene');
          if (sceneElement) {
            sceneElement.classList.remove('loading');
          }
        }, 2000); // 模拟加载时间

        // 初始化2D购物场景
        window.greenShopping = new GreenShopping2D();
      },
      on_finish: (data) => {
        console.log('Shopping trial finished'); // 购物任务结束
        if (window.audioManager) {
          window.audioManager.stop();
        }
        // 记录购物数据
        data.selected_items = window.greenShopping ? window.greenShopping.selectedItems : [];
        // 添加被试信息
        data.participant_id = window.participantData ? window.participantData.participant_id : 'unknown';
        data.gender = window.participantData ? window.participantData.gender : 'unknown';
        // 记录音乐相关数据
        data.music_condition = window.participantData.music_condition;
        data.music_track = window.musicTrack;
        data.music_start_time = window.musicStartTime;
      }
    };
    timeline.push(shoppingTrial);

    // 结束页面
    const debriefTrial = {
      type: jsPsych.HtmlKeyboardResponse,
      stimulus: `
        <div class="debrief-screen">
          <h1>实验结束</h1>
          <p>感谢您的参与！</p>
          <p>您的数据已成功记录</p>
          <p>按任意键退出</p>
        </div>
      `,
      on_load: () => {
        console.log('Debrief trial loaded'); // 结束页面加载
      }
    };
    timeline.push(debriefTrial);

    // 数据导出
    const dataExportTrial = {
      type: jsPsych.CallFunction,
      func: () => {
        const data = jsPsych.data.get().csv();
        console.log('实验数据:', data);

        // 提供数据下载功能
        const blob = new Blob([data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'green-shopping-experiment-data.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };
    timeline.push(dataExportTrial);

    // 启动实验
    jsPsych.run(timeline);
    console.log('Experiment started'); // 实验启动
  }
};

// 初始化实验
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired'); // DOMContentLoaded事件触发
  experiment.init();
});

export default experiment;