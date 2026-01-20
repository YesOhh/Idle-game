// pages/battle/battle.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        boss: {
            level: 1,
            currentHp: 100,
            maxHp: 100
        },
        bossHpPercent: 100,
        bossHpText: '100 / 100',

        goldText: '0',
        manualDamageText: '1',
        dpsText: '0',
        upgradeClickCostText: '10',

        damageNumbers: [],
        damageNumberId: 0,
        attacking: false,

        // 佣兵列表
        mercenaries: [],

        // 离线收益
        showOfflineModal: false,
        offlineTimeText: '',
        offlineGoldText: '',
        offlineBossesText: '',

        // 自动攻击定时器
        autoAttackTimer: null,

        // 遗物选择
        showRelicModal: false,
        // 兑换码
        redemptionCode: '',

        // 我的圣物展示
        showMyRelicsModal: false,
        myRelics: [],
        relicBonusSummary: null
    },

    onLoad() {
        this.initGame();
        this.startAutoAttack();
    },

    onUnload() {
        this.stopAutoAttack();
    },

    onHide() {
        // 切换到其他页面（如佣兵页）时不停止攻击，保持后台运行
        // this.stopAutoAttack(); 
    },

    onShow() {
        // 只有当定时器未运行时才启动（避免重复启动或重置节奏）
        if (!this.data.autoAttackTimer) {
            this.startAutoAttack();
        }
        this.updateDisplay();
    },

    // 初始化游戏
    initGame() {
        const globalData = app.globalData;

        // 处理离线收益
        if (globalData.offlineSeconds && globalData.offlineSeconds > 60) {
            this.processOfflineProgress(globalData.offlineSeconds);
        }

        // 初始化/同步佣兵数据
        const mercData = require('../../data/mercenaries.js');
        const defaultMercs = mercData.initMercenaries();

        if (!globalData.mercenaries || globalData.mercenaries.length === 0) {
            globalData.mercenaries = defaultMercs;
        } else {
            // 数据迁移与同步：合并新英雄与由于数据更新导致的属性变化
            defaultMercs.forEach(defaultMerc => {
                const existingMerc = globalData.mercenaries.find(m => m.id === defaultMerc.id);
                if (!existingMerc) {
                    // 如果存档中没有这个英雄（比如新出的传说），则添加进去
                    globalData.mercenaries.push(defaultMerc);
                    console.log(`同步新英雄: ${defaultMerc.name}`);
                } else {
                    // 强制同步基础配置属性 (成本、基础伤害、基础攻速、图标、描述)
                    // 这样即使存档里存了旧的 25w，也会被强制更新为新的 200w
                    existingMerc.baseCost = defaultMerc.baseCost;
                    existingMerc.damage = defaultMerc.damage;
                    existingMerc.attackInterval = defaultMerc.attackInterval;
                    existingMerc.icon = defaultMerc.icon;
                    existingMerc.description = defaultMerc.description;
                }
            });

            // 统一检查迁移字段
            globalData.mercenaries.forEach(merc => {
                if (merc.recruited === undefined) {
                    merc.recruited = (merc.count > 0);
                }
                if (merc.damageLevel === undefined) merc.damageLevel = 0;
                if (merc.intervalLevel === undefined) merc.intervalLevel = 0;

                // 实时重算当前显示数值，确保算法更新后数值同步
                const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
                merc._prestigeSpeedBuff = prestigeBonus.speed; // 设置永久攻速加成

                merc.currentDamage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
                merc.currentInterval = gameEngine.calculateUpgradedInterval(merc);
            });
        }

        this.updateDisplay();
    },

    // 处理离线收益
    processOfflineProgress(offlineSeconds) {
        const globalData = app.globalData;
        const dps = gameEngine.calculateTotalDPS(globalData.mercenaries);

        if (dps > 0) {
            const offlineResult = gameEngine.calculateOfflineProgress(
                dps,
                offlineSeconds,
                globalData.boss.level
            );

            // 应用离线收益
            globalData.player.gold += offlineResult.gold;
            globalData.boss.level = offlineResult.newLevel;

            const newBoss = gameEngine.nextBoss(offlineResult.newLevel - 1);
            globalData.boss = newBoss;

            // 显示离线收益弹窗
            const hours = Math.floor(offlineSeconds / 3600);
            const minutes = Math.floor((offlineSeconds % 3600) / 60);

            this.setData({
                showOfflineModal: true,
                offlineTimeText: `${hours}小时${minutes}分钟`,
                offlineGoldText: gameEngine.formatNumber(offlineResult.gold),
                offlineBossesText: offlineResult.bossesDefeated.toString()
            });
        }
    },

    // 更新战斗统计信息（高频：HP、金币）
    updateBattleStats() {
        const globalData = app.globalData;
        const boss = globalData.boss;
        const player = globalData.player;

        const hpPercent = (boss.maxHp > 0) ? (boss.currentHp / boss.maxHp) * 100 : 0;

        const prestigeBonus = gameEngine.calculatePrestigeBonus(player);
        const dps = gameEngine.calculateTotalDPS(
            globalData.mercenaries,
            this.data._globalDamageBuff || 0,
            this.data._globalSpeedBuff || 0,
            prestigeBonus.damage
        );

        // 计算下一级点击成本
        const nextClickCost = Math.floor(10 * Math.pow(1.5, player.manualDamage) * prestigeBonus.costReduction);

        this.setData({
            boss: boss,
            bossHpPercent: hpPercent,
            bossHpText: `${gameEngine.formatNumber(boss.currentHp)} / ${gameEngine.formatNumber(boss.maxHp)}`,
            goldText: gameEngine.formatNumber(player.gold),
            dpsText: gameEngine.formatNumber(dps),
            manualDamageText: gameEngine.formatNumber(player.manualDamage * prestigeBonus.damage),
            upgradeClickCostText: gameEngine.formatNumber(nextClickCost),
            prestigeCount: player.prestigeCount || 0
        });
    },

    // 更新佣兵列表状态（低频：按钮状态、列表渲染）
    updateMercenaryList() {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);

        // 格式化佣兵数据
        const mercenaries = globalData.mercenaries.map(merc => {
            const recruitCost = gameEngine.calculateRecruitCost(merc);

            // 同步最新的圣物攻速加成
            merc._prestigeSpeedBuff = prestigeBonus.speed;

            // 获取基础值与显示文本 (Base + Bonus)
            const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
            let currentDamage = dmgInfo.final;
            let currentInterval = gameEngine.calculateUpgradedInterval(merc);

            // 应用全局Buff展示
            if (this.data._globalDamageBuff) {
                currentDamage *= (1 + this.data._globalDamageBuff);
            }
            if (this.data._globalSpeedBuff) {
                currentInterval *= (1 - this.data._globalSpeedBuff);
            }

            const mercDPS = merc.recruited ? (currentDamage / currentInterval) : 0;
            const canAfford = !merc.recruited && globalData.player.gold >= recruitCost;

            return {
                ...merc,
                costText: merc.recruited ? '已雇佣' : gameEngine.formatNumber(recruitCost),
                dpsText: gameEngine.formatNumber(mercDPS),
                damageText: dmgInfo.text, // 使用 Base (+Bonus) 格式
                intervalText: currentInterval.toFixed(2),
                canAfford,
                recruited: merc.recruited
            };
        });

        // 只有当数据真正变化时才调用setData
        const currentJson = JSON.stringify(mercenaries);
        if (currentJson !== this.data._lastMercenariesJson) {
            this.setData({
                mercenaries: mercenaries
            });
            this.data._lastMercenariesJson = currentJson;
        }
    },

    // 综合更新（用于初始化或重要事件）
    updateDisplay() {
        this.updateBattleStats();
        this.updateMercenaryList();
    },

    // 点击Boss
    onTapBoss(e) {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        let damage = globalData.player.manualDamage * prestigeBonus.damage;
        let isCrit = false;

        // 全局暴击判定 (来自圣物)
        if (prestigeBonus.critChance > 0 && Math.random() < prestigeBonus.critChance) {
            const mult = 2.0 + (prestigeBonus.critMult || 0); // 基础暴击2倍
            damage *= mult;
            isCrit = true;
        }

        this.dealDamage(damage);
        this.showDamageNumber(damage, e, isCrit ? 'crit' : '');

        // 触发攻击动画
        this.setData({ attacking: true });
        setTimeout(() => {
            this.setData({ attacking: false });
        }, 300);
    },

    // 造成伤害
    dealDamage(damage) {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const result = gameEngine.dealDamageToBoss(globalData.boss, damage, prestigeBonus.gold);

        globalData.boss = result.boss;
        globalData.player.totalDamage += damage;

        // 造成伤害即获得金币 (已在 dealDamageToBoss 中应用 goldMult)
        globalData.player.gold += result.goldEarned;

        if (result.defeated) {
            this.onBossDefeated();
        } else {
            // 仅更新HP和金币，不更新整个列表
            this.updateBattleStats();
        }
    },

    // Boss被击败
    onBossDefeated() {
        const globalData = app.globalData;
        const currentLevel = globalData.boss.level;
        globalData.boss.defeated++;

        // 检查是否通关 (击败 12 号 Boss)
        if (currentLevel === 12) {
            this.stopAutoAttack();

            // 生成 3 个随机遗物
            const choices = gameEngine.getRandomRelicChoices();
            this.setData({
                showRelicModal: true,
                relicChoices: choices
            });
            return;
        }

        // 进入下一个Boss
        const newBoss = gameEngine.nextBoss(currentLevel);
        globalData.boss = newBoss;

        wx.showToast({
            title: `Boss击败!`,
            icon: 'success',
            duration: 1000
        });

        // Boss击败时可以做一次全量更新
        this.updateDisplay();
    },

    // 触发重生
    onPrestige(selectedRelic) {
        const globalData = app.globalData;
        globalData.player.prestigeCount = (globalData.player.prestigeCount || 0) + 1;

        // 添加选中的遗物
        if (selectedRelic) {
            if (!globalData.player.relics) globalData.player.relics = [];
            globalData.player.relics.push(selectedRelic);
        }

        // 调用 app.js 的初始化方法重置变量，但保留永久加成
        app.initNewGame(true);

        // 重载基础佣兵数据
        const mercData = require('../../data/mercenaries.js');
        app.globalData.mercenaries = mercData.initMercenaries();

        // 重新初始化并显示
        this.initGame();
        this.startAutoAttack(); // 修复：重生后重启定时器以刷新UI和自动攻击
        this.updateDisplay();

        wx.showToast({
            title: `开启第 ${globalData.player.prestigeCount + 1} 周目!`,
            icon: 'none',
            duration: 2000
        });
    },

    // 选择遗物
    onSelectRelic(e) {
        const index = e.currentTarget.dataset.index;
        const selectedRelic = this.data.relicChoices[index];

        this.setData({ showRelicModal: false });
        this.onPrestige(selectedRelic);
    },

    // 显示伤害数字
    showDamageNumber(damage, e) {
        // ... (保持不变)
        const id = this.data.damageNumberId + 1;
        const x = Math.random() * 200 + 150; // 随机位置
        const y = Math.random() * 100 + 100;

        const damageNumbers = [...this.data.damageNumbers, {
            id,
            damage: gameEngine.formatNumber(damage),
            x,
            y,
            delay: 0
        }];

        this.setData({
            damageNumbers,
            damageNumberId: id
        });

        // 1秒后移除
        setTimeout(() => {
            this.setData({
                damageNumbers: this.data.damageNumbers.filter(item => item.id !== id)
            });
        }, 1000);
    },

    // 升级点击伤害
    onUpgradeClick() {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = Math.floor(10 * Math.pow(1.5, globalData.player.manualDamage) * prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            globalData.player.manualDamage++;

            wx.showToast({
                title: '升级成功!',
                icon: 'success'
            });

            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 开始自动攻击
    startAutoAttack() {
        this.stopAutoAttack();

        // 记录上一帧时间
        this.lastFrameTime = Date.now();

        // 1. 伤害循环 (0.1秒)
        this.data.autoAttackTimer = setInterval(() => {
            const now = Date.now();
            // 计算两帧之间的时间差（秒）
            const deltaTime = (now - this.lastFrameTime) / 1000;
            this.lastFrameTime = now;

            const globalData = app.globalData;
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
                    if (this.data._globalSpeedBuff) {
                        interval *= (1 - this.data._globalSpeedBuff);
                    }

                    // 如果计时器超过攻击间隔，触发攻击
                    if (merc._attackTimer >= interval) {
                        // 计算基础单次伤害 (加上重生倍率)
                        let damage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);

                        // 获取并应用技能
                        const skill = gameEngine.getMercenarySkill(merc);
                        let isCrit = false;
                        let thisHitDamage = damage;

                        if (skill) {
                            if (skill.type === 'stacking_buff') {
                                // 战士技能：叠加攻击力
                                if (Math.random() < skill.chance) {
                                    merc._stackingBuff = (merc._stackingBuff || 0) + skill.val;
                                    // 飘字提示技能触发
                                    this.showDamageNumber('熟练+1%', null, 'skill');
                                }
                            } else if (skill.type === 'crit') {
                                // 弓箭手技能：暴击
                                if (Math.random() < skill.chance) {
                                    thisHitDamage *= skill.multiplier;
                                    isCrit = true;
                                    // 飘字提示暴击触发
                                    this.showDamageNumber('爆裂!', null, 'skill-crit');
                                }
                            } else if (skill.type === 'global_speed_buff') {
                                // 法师技能：全体加速
                                if (Math.random() < skill.chance) {
                                    // 应用全局加速Buff
                                    this.data._globalSpeedBuff = skill.val;
                                    this.setData({ isSpeedBuffActive: true });
                                    this.updateDisplay();

                                    clearTimeout(this.data._globalSpeedTimer);
                                    this.data._globalSpeedTimer = setTimeout(() => {
                                        this.data._globalSpeedBuff = 0;
                                        this.setData({ isSpeedBuffActive: false });
                                        this.updateDisplay();
                                    }, skill.duration);

                                    this.showDamageNumber('奥术激涌!', null, 'skill-mage');
                                }
                            } else if (skill.type === 'burst_boost') {
                                // 龙骑士技能：毁灭龙息 + 全体伤害提升
                                if (Math.random() < skill.chance) {
                                    thisHitDamage *= skill.multiplier;
                                    isCrit = true;

                                    // 应用全局伤害Buff
                                    this.data._globalDamageBuff = skill.buffVal;
                                    this.setData({ isDamageBuffActive: true });
                                    this.updateDisplay();

                                    clearTimeout(this.data._globalDamageTimer);
                                    this.data._globalDamageTimer = setTimeout(() => {
                                        this.data._globalDamageBuff = 0;
                                        this.setData({ isDamageBuffActive: false });
                                        this.updateDisplay();
                                    }, skill.duration);

                                    this.showDamageNumber('毁灭龙息!', null, 'skill-dragon');
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
                        if (this.data._globalDamageBuff) {
                            thisHitDamage *= (1 + this.data._globalDamageBuff);
                        }

                        thisHitDamage = Math.floor(thisHitDamage);

                        // 可能会超过多个间隔（如果卡顿），这里简单重置或减去间隔
                        while (merc._attackTimer >= interval) {
                            totalFrameDamage += thisHitDamage;
                            merc._attackTimer -= interval;
                            // 注意：如果是多次攻击，理论上每次都要判定暴击，这里简化为判定一次应用到所有积压攻击上，或者只判定第一下
                        }

                        // 如果触发了暴击，显示伤害数字 (避免普通攻击刷屏，只显示暴击)
                        if (isCrit) {
                            this.showDamageNumber(thisHitDamage, null, 'crit');
                        }
                    }
                }
            });

            // 只有当有佣兵真正挥刀砍出伤害时，才结算
            if (totalFrameDamage > 0) {
                this.dealDamage(totalFrameDamage);
            }

        }, 100);

        // 2. 界面状态循环 (0.5秒) - 此时才刷新按钮状态，避免闪烁
        this.data.uiTimer = setInterval(() => {
            this.updateMercenaryList();
        }, 500);
    },

    // 停止自动攻击
    stopAutoAttack() {
        if (this.data.autoAttackTimer) {
            clearInterval(this.data.autoAttackTimer);
            this.data.autoAttackTimer = null;
        }
        if (this.data.uiTimer) {
            clearInterval(this.data.uiTimer);
            this.data.uiTimer = null;
        }
    },

    // 重置游戏
    onResetGame() {
        wx.showModal({
            title: '重置游戏',
            content: '确定要清除所有进度重新开始吗？',
            confirmColor: '#e74c3c',
            success: (res) => {
                if (res.confirm) {
                    // 1. 清除存储
                    wx.clearStorageSync();

                    // 2. 调用 app.js 的初始化方法重置全局变量
                    app.initNewGame();

                    // 3. 额外确保 Boss HP 按新算法重新生成
                    const initialBossHp = gameEngine.calculateBossMaxHp(1);
                    app.globalData.boss.currentHp = initialBossHp;
                    app.globalData.boss.maxHp = initialBossHp;

                    // 4. 重载佣兵数据
                    const mercData = require('../../data/mercenaries.js');
                    app.globalData.mercenaries = mercData.initMercenaries();

                    // 5. 重新初始化页面
                    this.initGame();
                    this.updateDisplay();

                    wx.showToast({
                        title: '游戏已重置',
                        icon: 'success'
                    });
                }
            }
        });
    },

    // 显示伤害数字
    showDamageNumber(damage, e, type = '') {
        // 限制同屏数字数量，防止卡顿
        if (this.data.damageNumbers.length > 20) {
            this.data.damageNumbers.shift();
        }

        const id = this.data.damageNumberId + 1;
        let x, y;

        if (e && e.touches && e.touches.length > 0) {
            // 点击位置
            x = e.touches[0].clientX * 2; // px转rpx大概倍率，或者直接用px
            y = e.touches[0].clientY * 2;
            // 小程序单位对其比较麻烦，这里简化处理：
            // 直接随机位置，忽略点击精确位置，为了视觉统一
            x = Math.random() * 200 + 150;
            y = Math.random() * 100 + 100;
        } else {
            // 自动攻击（暴击）随机位置
            x = Math.random() * 300 + 100;
            y = Math.random() * 100 + 150;
        }

        const damageNumbers = [...this.data.damageNumbers, {
            id,
            damage: typeof damage === 'string' ? damage : gameEngine.formatNumber(damage),
            x,
            y,
            delay: 0,
            type // 'crit' or ''
        }];

        this.setData({
            damageNumbers,
            damageNumberId: id
        });

        // 1秒后移除
        setTimeout(() => {
            this.setData({
                damageNumbers: this.data.damageNumbers.filter(item => item.id !== id)
            });
        }, 1000);
    },
    // 关闭离线收益弹窗
    closeOfflineModal() {
        this.setData({
            showOfflineModal: false
        });
    },

    // 招募佣兵
    onRecruitMercenary(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || mercenary.recruited) {
            return;
        }

        const cost = gameEngine.calculateRecruitCost(mercenary);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.recruited = true;

            wx.showToast({
                title: '招募成功!',
                icon: 'success'
            });

            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 兑换码输入绑定
    onInputCode(e) {
        this.setData({
            redemptionCode: e.detail.value
        });
    },

    // 兑换逻辑
    onRedeem() {
        // ... (保持不变)
        const code = this.data.redemptionCode.trim();
        const globalData = app.globalData;

        if (code === 'SUPER_TEST') {
            // 一键到达最后一个Boss并设定血量为100
            const lastBossLevel = 12;
            const testHp = 100;

            const bossInfo = require('../../data/bosses.js').BOSS_DATA[lastBossLevel - 1];

            globalData.boss = {
                level: lastBossLevel,
                currentHp: testHp,
                maxHp: testHp,
                name: bossInfo.name,
                icon: bossInfo.icon,
                desc: bossInfo.desc,
                isMaxLevel: true
            };

            this.updateDisplay();
            this.setData({ redemptionCode: '' });

            wx.showToast({
                title: '测试模式激活！',
                icon: 'success'
            });
        } else if (code !== '') {
            wx.showToast({
                title: '无效兑换码',
                icon: 'none'
            });
        }
    },

    // 切换圣物弹窗
    onToggleMyRelicsModal() {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);

        this.setData({
            showMyRelicsModal: !this.data.showMyRelicsModal,
            myRelics: globalData.player.relics || [],
            relicBonusSummary: {
                damage: ((prestigeBonus.damage - 1) * 100).toFixed(0),
                gold: ((prestigeBonus.gold - 1) * 100).toFixed(0),
                speed: (prestigeBonus.speed * 100).toFixed(0),
                critChance: (prestigeBonus.critChance * 100).toFixed(0),
                critMult: (prestigeBonus.critMult * 100).toFixed(0),
                costReduction: ((1 - prestigeBonus.costReduction) * 100).toFixed(0)
            }
        });
    },

    // 阻止事件冒泡
    preventClose() { }
});
