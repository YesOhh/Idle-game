// app.js
const saveManager = require('./utils/saveManager.js');

App({
  onLaunch() {
    console.log('游戏启动');
    
    // 加载游戏数据
    const savedData = saveManager.loadGame();
    if (savedData) {
      this.globalData = savedData;
      console.log('加载已保存的游戏数据');
    } else {
      // 初始化新游戏
      this.initNewGame();
      console.log('初始化新游戏');
    }
    
    // 设置自动保存
    this.startAutoSave();
  },
  
  onHide() {
    // 应用隐藏时保存游戏
    saveManager.saveGame(this.globalData);
  },
  
  onUnload() {
    // 应用卸载时保存游戏
    saveManager.saveGame(this.globalData);
  },
  
  // 初始化新游戏
  initNewGame() {
    this.globalData = {
      // 玩家数据
      player: {
        gold: 0,           // 金币
        totalDamage: 0,    // 总伤害
        manualDamage: 1,   // 手动点击伤害
        clickCount: 0      // 点击次数
      },
      
      // Boss数据
      boss: {
        level: 1,
        currentHp: 100,
        maxHp: 100,
        defeated: 0        // 击败的Boss数量
      },
      
      // 佣兵数据
      mercenaries: [],
      
      // 游戏统计
      stats: {
        playTime: 0,       // 游戏时长（秒）
        lastSaveTime: Date.now()
      }
    };
  },
  
  // 开始自动保存
  startAutoSave() {
    // 每30秒自动保存一次
    setInterval(() => {
      saveManager.saveGame(this.globalData);
      console.log('自动保存游戏');
    }, 30000);
  },
  
  // 全局数据
  globalData: null
});
