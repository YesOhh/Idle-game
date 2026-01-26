// app.js
const saveManager = require('./utils/saveManager.js');
const gameEngine = require('./utils/gameEngine.js');

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
    // 开始全局自动战斗
    this.startGlobalBattle();
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
  initNewGame(keepPermanent = false) {
    // 如果是重生，保留永久加成数据
    let prestigeData = {
      prestigeCount: 0,
      relics: []
    };

    if (keepPermanent && this.globalData && this.globalData.player) {
      prestigeData.prestigeCount = this.globalData.player.prestigeCount || 0;
      prestigeData.relics = this.globalData.player.relics || [];
    }

    this.globalData = {
      // 玩家数据
      player: {
        gold: 0,           // 金币
        totalDamage: 0,    // 总伤害
        manualDamage: 1,   // 手动点击伤害
        clickCount: 0,     // 点击次数
        // 永久存档字段
        prestigeCount: prestigeData.prestigeCount,
        relics: prestigeData.relics
      },

      // Boss数据
      boss: {
        level: 1,
        currentHp: 30000,  // 根据最新的 Boss 1 血量
        maxHp: 30000,
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

  // ========== 全局自动战斗系统 ==========
  // 将战斗逻辑放在全局，这样切换页面也能继续战斗

  // 开始全局战斗
  startGlobalBattle() {
    this.stopGlobalBattle();
    this._lastFrameTime = Date.now();

    // 战斗计算循环 (0.1秒)
    this._battleTimer = setInterval(() => {
      this._processBattleTick();
    }, 100);

    console.log('全局战斗系统已启动');
  },

  // 停止全局战斗
  stopGlobalBattle() {
    if (this._battleTimer) {
      clearInterval(this._battleTimer);
      this._battleTimer = null;
    }
  },

  // 暂停全局战斗 (用于重生选择遗物时)
  pauseGlobalBattle() {
    this._battlePaused = true;
  },

  // 恢复全局战斗
  resumeGlobalBattle() {
    this._battlePaused = false;
  },

  // 处理一帧战斗逻辑
  _processBattleTick() {
    if (this._battlePaused) return;

    const now = Date.now();
    const deltaTime = (now - this._lastFrameTime) / 1000;
    this._lastFrameTime = now;

    const globalData = this.globalData;
    if (!globalData || !globalData.mercenaries) return;

    let totalFrameDamage = 0;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);

    // 遍历所有佣兵，计算各自的攻击CD
    globalData.mercenaries.forEach(merc => {
      if (merc.recruited) {
        // 初始化计时器
        if (typeof merc._attackTimer === 'undefined') {
          merc._attackTimer = 0;
        }

        // 累加时间
        merc._attackTimer += deltaTime;

        // 获取当前攻击间隔
        let interval = gameEngine.calculateUpgradedInterval(merc);

        // 应用全局加速Buff (法师奥术激涌)
        if (this._globalSpeedBuff) {
          interval *= (1 - this._globalSpeedBuff);
        }

        // 如果计时器超过攻击间隔，触发攻击
        if (merc._attackTimer >= interval) {
          // 计算基础单次伤害 (加上重生倍率)
          let damage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);

          // 获取并应用技能
          const skill = gameEngine.getMercenarySkill(merc);
          let isCrit = false;
          let thisHitDamage = damage;
          let skillTriggered = null;

          if (skill) {
            if (skill.type === 'stacking_buff') {
              // 战士技能：叠加攻击力
              if (Math.random() < skill.chance) {
                merc._stackingBuff = (merc._stackingBuff || 0) + skill.val;
                skillTriggered = { type: 'stacking_buff', text: '熟练+1%' };
              }
            } else if (skill.type === 'crit') {
              // 弓箭手技能：暴击
              if (Math.random() < skill.chance) {
                thisHitDamage *= skill.multiplier;
                isCrit = true;
                skillTriggered = { type: 'crit', text: '爆裂!' };
              }
            } else if (skill.type === 'global_speed_buff') {
              // 法师技能：全体加速
              if (Math.random() < skill.chance) {
                this._globalSpeedBuff = skill.val;
                this._speedBuffActive = true;

                if (this._globalSpeedTimer) clearTimeout(this._globalSpeedTimer);
                this._globalSpeedTimer = setTimeout(() => {
                  this._globalSpeedBuff = 0;
                  this._speedBuffActive = false;
                  this._notifyBattleUpdate({ buffChanged: true });
                }, skill.duration);

                skillTriggered = { type: 'speed_buff', text: '奥术激涌!' };
              }
            } else if (skill.type === 'burst_boost') {
              // 龙骑士技能：毁灭龙息 + 全体伤害提升
              if (Math.random() < skill.chance) {
                thisHitDamage *= skill.multiplier;
                isCrit = true;

                this._globalDamageBuff = skill.buffVal;
                this._damageBuffActive = true;

                if (this._globalDamageTimer) clearTimeout(this._globalDamageTimer);
                this._globalDamageTimer = setTimeout(() => {
                  this._globalDamageBuff = 0;
                  this._damageBuffActive = false;
                  this._notifyBattleUpdate({ buffChanged: true });
                }, skill.duration);

                skillTriggered = { type: 'damage_buff', text: '毁灭龙息!' };
              }
            }
          }

          // 全局暴击判定 (圣物加成，且如果该次攻击还没触发技能暴击)
          if (!isCrit && prestigeBonus.critChance > 0) {
            if (Math.random() < prestigeBonus.critChance) {
              thisHitDamage *= (2.0 + prestigeBonus.critMult);
              isCrit = true;
            }
          }

          // 应用全局伤害Buff (龙骑士龙威)
          if (this._globalDamageBuff) {
            thisHitDamage *= (1 + this._globalDamageBuff);
          }

          thisHitDamage = Math.floor(thisHitDamage);

          // 可能会超过多个间隔（如果卡顿），这里简单重置或减去间隔
          while (merc._attackTimer >= interval) {
            totalFrameDamage += thisHitDamage;
            merc._attackTimer -= interval;
          }

          // 通知战斗页面显示技能效果
          if (skillTriggered || isCrit) {
            this._notifyBattleUpdate({
              skill: skillTriggered,
              crit: isCrit,
              damage: thisHitDamage
            });
          }
        }
      }
    });

    // 只有当有佣兵真正挥刀砍出伤害时，才结算
    if (totalFrameDamage > 0) {
      this._dealGlobalDamage(totalFrameDamage);
    }
  },

  // 处理伤害结算
  _dealGlobalDamage(damage) {
    const globalData = this.globalData;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
    const result = gameEngine.dealDamageToBoss(globalData.boss, damage, prestigeBonus.gold);

    globalData.boss = result.boss;
    globalData.player.totalDamage += damage;
    globalData.player.gold += result.goldEarned;

    if (result.defeated) {
      this._onGlobalBossDefeated();
    } else {
      // 通知战斗页面更新显示
      this._notifyBattleUpdate({ statsChanged: true });
    }
  },

  // Boss被击败 (全局处理)
  _onGlobalBossDefeated() {
    const globalData = this.globalData;
    const currentLevel = globalData.boss.level;
    globalData.boss.defeated++;

    // 检查是否通关 (击败 12 号 Boss)
    if (currentLevel === 12) {
      this.pauseGlobalBattle();
      this._notifyBattleUpdate({
        bossDefeated: true,
        showRelicModal: true,
        bossLevel: currentLevel
      });
      return;
    }

    // 进入下一个Boss
    const newBoss = gameEngine.nextBoss(currentLevel);
    globalData.boss = newBoss;

    // 通知战斗页面更新
    this._notifyBattleUpdate({
      bossDefeated: true,
      bossLevel: currentLevel
    });
  },

  // 通知战斗页面更新 (供页面订阅)
  _notifyBattleUpdate(data) {
    if (this._battleUpdateCallback) {
      this._battleUpdateCallback(data);
    }
  },

  // 订阅战斗更新 (供战斗页面调用)
  subscribeBattleUpdate(callback) {
    this._battleUpdateCallback = callback;
  },

  // 取消订阅
  unsubscribeBattleUpdate() {
    this._battleUpdateCallback = null;
  },

  // 获取全局Buff状态
  getBuffState() {
    return {
      speedBuffActive: this._speedBuffActive || false,
      damageBuffActive: this._damageBuffActive || false
    };
  },

  // 全局数据
  globalData: null
});
