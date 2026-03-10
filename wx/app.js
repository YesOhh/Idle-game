// app.js
const saveManager = require('./utils/saveManager.js');
const gameEngine = require('./utils/gameEngine.js');
const { SKILL_LIBRARY } = require('./data/skills.js');

App({
  onLaunch() {
    console.log('游戏启动');

    // 加载游戏数据
    const savedData = saveManager.loadGame();
    if (savedData) {
      this.globalData = savedData;
      // Migrate: berserker_combo → berserker_rage
      if (this.globalData.mercenaries) {
        for (const merc of this.globalData.mercenaries) {
          if (merc.evolvedSkillId === 'berserker_combo') merc.evolvedSkillId = 'berserker_rage';
        }
      }
      // 里程碑迁移：补算旧存档的一次性翻倍奖励
      gameEngine.migrateMilestoneDamageBonus(this.globalData.mercenaries);
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

    // 启动传授技能定时器 (60秒)
    this._startTeachingSkillTimer();

    // 启动经验技能定时器 (10秒)
    this._startExperienceSkillTimer();

    console.log('全局战斗系统已启动');
  },

  // 启动传授技能定时器
  _startTeachingSkillTimer() {
    if (this._teachingTimer) {
      clearInterval(this._teachingTimer);
    }

    // 每60秒触发一次传授技能
    this._teachingTimer = setInterval(() => {
      this._processTeachingSkill();
    }, 60000);
  },

  // 处理传授技能逻辑
  _processTeachingSkill() {
    const globalData = this.globalData;
    if (!globalData || !globalData.mercenaries) return;

    // 找到士兵（royal_guard）并检查技能是否解锁
    const soldier = globalData.mercenaries.find(m => m.id === 'royal_guard' && m.recruited);
    if (!soldier) return;

    const skill = SKILL_LIBRARY['team_damage_buff'];
    if (!skill) return;
    const totalLevel = (soldier.damageLevel || 0) + (soldier.intervalLevel || 0) + 1;
    if (totalLevel < skill.baseUnlockLevel) return;

    // 计算士兵基础攻击力（不含转生加成）的1%，避免转生倍率双重叠加
    const soldierBaseDamage = gameEngine.calculateMercenaryBaseDamage(soldier);
    const params = skill.getParams(totalLevel);
    const bonusDamage = Math.floor(soldierBaseDamage * params.bonusRatio);

    if (bonusDamage <= 0) return;

    // 给其他基础系单位增加永久攻击力加成
    let teachCount = 0;
    globalData.mercenaries.forEach(merc => {
      if (merc.recruited && merc.id !== 'royal_guard') {
        // 使用 _teachingBonus 存储传授获得的永久加成
        merc._teachingBonus = (merc._teachingBonus || 0) + bonusDamage;
        teachCount++;
      }
    });

    if (teachCount > 0) {
      // 通知战斗界面更新
      this._notifyBattleUpdate({
        skillTriggered: {
          mercId: 'royal_guard',
          type: 'teaching',
          text: `传授 +${gameEngine.formatNumber(bonusDamage)}!`
        }
      });
      console.log(`传授技能触发：${teachCount}个所有单位各获得 +${bonusDamage} 攻击力`);
    }
  },

  // 启动经验技能定时器
  _startExperienceSkillTimer() {
    if (this._experienceTimer) {
      clearInterval(this._experienceTimer);
    }

    // 每10秒触发一次经验技能
    this._experienceTimer = setInterval(() => {
      this._processExperienceSkill();
    }, 10000);
  },

  // 处理经验技能逻辑
  _processExperienceSkill() {
    const globalData = this.globalData;
    if (!globalData || !globalData.mercenaries) return;

    const soldier = globalData.mercenaries.find(m => m.id === 'royal_guard' && m.recruited);
    if (!soldier) return;

    const totalLevel = (soldier.damageLevel || 0) + (soldier.intervalLevel || 0) + 1;
    const dmgLv = soldier.damageLevel || 0;
    const bonus = 1 + Math.floor(totalLevel * dmgLv / 30);

    soldier._experienceBonus = (soldier._experienceBonus || 0) + bonus;

    // 通知战斗界面更新
    this._notifyBattleUpdate({
      skillTriggered: {
        mercId: 'royal_guard',
        type: 'experience',
        text: `经验 +${bonus}`
      }
    });
    console.log(`经验技能触发：士兵攻击力 +${bonus}`);
  },

  // 停止全局战斗
  stopGlobalBattle() {
    if (this._battleTimer) {
      clearInterval(this._battleTimer);
      this._battleTimer = null;
    }
    if (this._teachingTimer) {
      clearInterval(this._teachingTimer);
      this._teachingTimer = null;
    }
    if (this._experienceTimer) {
      clearInterval(this._experienceTimer);
      this._experienceTimer = null;
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

        // 应用万物终结攻速光环
        if (this._ultimateAura && this._ultimateAura.speed) {
          interval *= (1 - this._ultimateAura.speed);
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
          let bonusGold = 0; // 技能额外金币

          if (skill) {
            if (skill.type === 'gold_on_attack') {
              // 空空技能：妙手 - 每次攻击额外获得金币
              const extraGold = Math.floor(damage * skill.multiplier);
              bonusGold = extraGold;
              skillTriggered = { type: 'gold', text: `+${gameEngine.formatNumber(extraGold)}💰` };
            } else if (skill.type === 'stacking_buff') {
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
            } else if (skill.type === 'dragon_soul') {
              // 龙骑士技能：龙魂觉醒 - 积攒龙魂释放龙息
              merc._dragonSoulStacks = (merc._dragonSoulStacks || 0) + 1;

              // 满层时释放龙息
              if (merc._dragonSoulStacks >= skill.maxStacks) {
                merc._dragonSoulStacks = 0;
                thisHitDamage *= skill.burstMultiplier;
                isCrit = true;

                // 灼烧效果：每秒造成攻击力百分比伤害
                const burnDamagePerTick = Math.floor(damage * skill.burnDamage);
                const burnTicks = skill.burnDuration / 1000; // 转换为秒数

                // 启动灼烧定时器
                if (this._dragonBurnTimer) clearInterval(this._dragonBurnTimer);
                let burnCount = 0;
                this._dragonBurnTimer = setInterval(() => {
                  burnCount++;
                  if (burnCount > burnTicks || !this.globalData.boss || this.globalData.boss.currentHp <= 0) {
                    clearInterval(this._dragonBurnTimer);
                    this._dragonBurnTimer = null;
                    return;
                  }
                  // 造成灼烧伤害
                  this._dealGlobalDamage(burnDamagePerTick);
                  this._notifyBattleUpdate({
                    skill: { type: 'burn', text: `灼烧 ${gameEngine.formatNumber(burnDamagePerTick)}` }
                  });
                }, 1000);

                skillTriggered = { type: 'damage_buff', text: `龙息 x${skill.burstMultiplier}!` };
              }
            } else if (skill.type === 'chaos_stack') {
              // 混沌帝王技能：混沌法则 - 攻击力叠加但攻击间隔也增加
              if (Math.random() < skill.chance) {
                // 叠加攻击力加成
                merc._chaosAtkBuff = (merc._chaosAtkBuff || 0) + skill.atkBonus;
                // 叠加攻击间隔惩罚
                merc._chaosIntervalPenalty = (merc._chaosIntervalPenalty || 0) + skill.intervalIncrease;

                const stackCount = Math.round((merc._chaosAtkBuff || 0) / skill.atkBonus);
                skillTriggered = { type: 'chaos', text: `混沌x${stackCount}` };
              }
              // 应用混沌攻击力加成到本次伤害
              if (merc._chaosAtkBuff) {
                thisHitDamage *= (1 + merc._chaosAtkBuff);
              }
            } else if (skill.type === 'berserker_rage') {
              // 狂暴：Boss血量越低伤害越高
              const boss = this.globalData.boss;
              const hpPercent = boss.currentHp / boss.maxHp;
              let bonusPercent = 0;
              for (const threshold of skill.thresholds) {
                if (hpPercent < threshold.hpPercent) {
                  bonusPercent = threshold.bonusPercent;
                }
              }
              if (bonusPercent > 0) {
                thisHitDamage *= (1 + skill.maxBonus * bonusPercent);
              }
            } else if (skill.type === 'combo_strike') {
              // 连击：Boss血量越低连击概率越高
              const boss = this.globalData.boss;
              const hpPercent = boss.currentHp / boss.maxHp;
              let comboChance = 0;
              for (const threshold of skill.thresholds) {
                if (hpPercent < threshold.hpPercent) {
                  comboChance = threshold.comboChance;
                }
              }
              if (comboChance > 0) {
                let comboCount = 0;
                let comboDamage = 0;
                while (Math.random() < comboChance) {
                  comboCount++;
                  comboDamage += damage;
                }
                if (comboCount > 0) {
                  thisHitDamage += comboDamage;
                  skillTriggered = { type: 'combo', text: `连击x${comboCount}!` };
                }
              }
            } else if (skill.type === 'time_burst') {
              // 时光技能：时空涟漪 - 每60秒释放多次攻击
              // 初始化计时器
              if (typeof merc._timeBurstTimer === 'undefined') {
                merc._timeBurstTimer = 0;
              }
              // 累加时间（使用攻击间隔作为时间单位）
              const interval = gameEngine.calculateUpgradedInterval(merc);
              merc._timeBurstTimer += interval * 1000; // 转换为毫秒

              // 检查是否达到触发间隔
              if (merc._timeBurstTimer >= skill.interval) {
                merc._timeBurstTimer = 0;

                // 释放多次时空攻击
                const attackCount = skill.attackCount;
                const burstDamage = Math.floor(thisHitDamage * skill.damageMultiplier);
                let totalBurstDamage = burstDamage * attackCount;

                // 本次攻击变成爆发伤害
                thisHitDamage = totalBurstDamage;
                isCrit = true;

                skillTriggered = { type: 'time_burst', text: `时空涟漪 x${attackCount}!` };
              }
            } else if (skill.type === 'experience_growth' || skill.type === 'team_damage_buff') {
              // 经验/传授：通过定时器触发，攻击时不做处理
            } else if (skill.type === 'iron_fist') {
              // 钢铁神拳：概率造成钢铁系总攻击力伤害
              if (Math.random() < skill.chance) {
                // 计算钢铁系佣兵总攻击力
                let ironTotalDamage = 0;
                globalData.mercenaries.forEach(m => {
                  if (m.recruited && m.category === 'iron') {
                    ironTotalDamage += gameEngine.calculateUpgradedDamage(m, prestigeBonus.damage);
                  }
                });
                const extraDamage = Math.floor(ironTotalDamage * skill.multiplier);
                thisHitDamage += extraDamage;
                isCrit = true;
                skillTriggered = { type: 'iron_fist', text: `钢铁神拳 +${gameEngine.formatNumber(extraDamage)}!` };
              }
            } else if (skill.type === 'boss_debuff') {
              // 冰霜冻结：概率使Boss受到伤害增加
              if (Math.random() < skill.chance) {
                this._bossDebuff = skill.val;
                this._bossDebuffActive = true;

                if (this._bossDebuffTimer) clearTimeout(this._bossDebuffTimer);
                this._bossDebuffTimer = setTimeout(() => {
                  this._bossDebuff = 0;
                  this._bossDebuffActive = false;
                  this._notifyBattleUpdate({ buffChanged: true });
                }, skill.duration);

                skillTriggered = { type: 'freeze', text: `冰霜冻结 +${(skill.val * 100).toFixed(0)}%!` };
              }
            } else if (skill.type === 'summon') {
              // 亡灵召唤：召唤骷髅协助攻击
              const skeletonDamage = Math.floor(damage * skill.damageRatio);
              const totalSummonDamage = skeletonDamage * skill.count;
              thisHitDamage += totalSummonDamage;
              skillTriggered = { type: 'summon', text: `召唤x${skill.count} +${gameEngine.formatNumber(totalSummonDamage)}` };
            } else if (skill.type === 'damage_aura') {
              // 神圣祝福：永久全队伤害加成（通过全局变量累积）
              if (!this._damageAura) {
                this._damageAura = skill.val;
              }
              // 光环效果在下面的全局伤害Buff处统一应用
            } else if (skill.type === 'pure_percent_damage') {
              // 圣洁之力：概率造成Boss当前血量百分比伤害
              if (Math.random() < skill.chance) {
                const boss = this.globalData.boss;
                const percentDamage = Math.floor(boss.currentHp * skill.percentVal);
                // 这个伤害不受任何加成影响，直接加到本次伤害
                thisHitDamage += percentDamage;
                skillTriggered = { type: 'holy', text: `圣洁之力 ${gameEngine.formatNumber(percentDamage)}` };
              }
            } else if (skill.type === 'total_team_damage') {
              // 虚空侵蚀：概率造成全队攻击力总和伤害
              if (Math.random() < skill.chance) {
                let teamTotalDamage = 0;
                globalData.mercenaries.forEach(m => {
                  if (m.recruited) {
                    teamTotalDamage += gameEngine.calculateUpgradedDamage(m, prestigeBonus.damage);
                  }
                });
                thisHitDamage += teamTotalDamage;
                isCrit = true;
                skillTriggered = { type: 'void', text: `虚空侵蚀 +${gameEngine.formatNumber(teamTotalDamage)}!` };
              }
            } else if (skill.type === 'periodic_burst') {
              // 浴火重生：每60秒自动造成大量伤害
              if (typeof merc._periodicBurstTimer === 'undefined') {
                merc._periodicBurstTimer = 0;
              }
              const interval = gameEngine.calculateUpgradedInterval(merc);
              merc._periodicBurstTimer += interval * 1000;

              if (merc._periodicBurstTimer >= skill.interval) {
                merc._periodicBurstTimer = 0;
                thisHitDamage *= skill.multiplier;
                isCrit = true;
                skillTriggered = { type: 'phoenix', text: `浴火重生 x${skill.multiplier}!` };
              }
            } else if (skill.type === 'ultimate') {
              // 万物终结：全能技能 - 全队伤害+攻速+暴击
              // 永久光环效果
              if (!this._ultimateAura) {
                this._ultimateAura = {
                  damage: skill.teamDamageBonus,
                  speed: skill.teamSpeedBonus
                };
              }
              // 自身暴击判定
              if (Math.random() < skill.critChance) {
                thisHitDamage *= skill.critMult;
                isCrit = true;
                skillTriggered = { type: 'ultimate', text: `万物终结 x${skill.critMult}!` };
              }
            } else if (skill.type === 'knight_heavy_armor') {
              // 「稳固」技能：每隔8秒造成等同攻击力的额外伤害
              if (typeof merc._fortifyTimer === 'undefined') merc._fortifyTimer = 0;
              merc._fortifyTimer += interval * 1000;
              if (merc._fortifyTimer >= 8000) {
                merc._fortifyTimer = 0;
                const fortifyDmg = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
                thisHitDamage += fortifyDmg;
                skillTriggered = { type: 'knight_fortify', text: `稳固 +${gameEngine.formatNumber(fortifyDmg)}!` };
              }
            }
          }

          // 处理副技能（如狂战士的连击）
          const secondarySkill = gameEngine.getSecondaryMercSkill(merc);
          if (secondarySkill) {
            if (secondarySkill.type === 'combo_strike') {
              const boss = this.globalData.boss;
              const hpPercent = boss.currentHp / boss.maxHp;
              let comboChance = 0;
              for (const threshold of secondarySkill.thresholds) {
                if (hpPercent < threshold.hpPercent) {
                  comboChance = threshold.comboChance;
                }
              }
              if (comboChance > 0) {
                let comboCount = 0;
                let comboDamage = 0;
                while (Math.random() < comboChance) {
                  comboCount++;
                  comboDamage += damage;
                }
                if (comboCount > 0) {
                  thisHitDamage += comboDamage;
                  skillTriggered = { type: 'combo', text: `连击x${comboCount}!` };
                }
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

          // 应用全局伤害Buff (皇家守护)
          if (this._globalDamageBuff) {
            thisHitDamage *= (1 + this._globalDamageBuff);
          }

          // 应用神圣祝福光环
          if (this._damageAura) {
            thisHitDamage *= (1 + this._damageAura);
          }

          // 应用万物终结光环
          if (this._ultimateAura) {
            thisHitDamage *= (1 + this._ultimateAura.damage);
          }

          // 应用Boss减益 (冰霜冻结)
          if (this._bossDebuff) {
            thisHitDamage *= (1 + this._bossDebuff);
          }

          thisHitDamage = Math.floor(thisHitDamage);

          // 可能会超过多个间隔（如果卡顿），这里简单重置或减去间隔
          while (merc._attackTimer >= interval) {
            totalFrameDamage += thisHitDamage;
            merc._attackTimer -= interval;
          }

          // 通知战斗页面显示伤害飘字
          this._notifyBattleUpdate({
            mercDamage: {
              damage: thisHitDamage,
              mercName: merc.name,
              isCrit: isCrit
            }
          });

          // 通知战斗页面显示技能效果
          if (skillTriggered) {
            this._notifyBattleUpdate({
              skill: skillTriggered
            });
          }

          // 处理技能额外金币（妙手技能）
          if (bonusGold > 0) {
            this.globalData.player.gold += bonusGold;
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
