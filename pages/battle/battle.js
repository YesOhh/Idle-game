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
        autoAttackTimer: null
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
                merc.currentDamage = gameEngine.calculateUpgradedDamage(merc);
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
        const dps = gameEngine.calculateTotalDPS(globalData.mercenaries);

        this.setData({
            boss: boss,
            bossHpPercent: hpPercent,
            bossHpText: `${gameEngine.formatNumber(boss.currentHp)} / ${gameEngine.formatNumber(boss.maxHp)}`,
            goldText: gameEngine.formatNumber(player.gold),
            dpsText: gameEngine.formatNumber(dps),
            manualDamageText: gameEngine.formatNumber(player.manualDamage)
        });
    },

    // 更新佣兵列表状态（低频：按钮状态、列表渲染）
    updateMercenaryList() {
        const globalData = app.globalData;

        // 格式化佣兵数据
        const mercenaries = globalData.mercenaries.map(merc => {
            const recruitCost = gameEngine.calculateRecruitCost(merc);
            const currentDamage = gameEngine.calculateUpgradedDamage(merc);
            const currentInterval = gameEngine.calculateUpgradedInterval(merc);
            const mercDPS = merc.recruited ? (currentDamage / currentInterval) : 0;
            const canAfford = !merc.recruited && globalData.player.gold >= recruitCost;

            return {
                ...merc,
                costText: merc.recruited ? '已雇佣' : gameEngine.formatNumber(recruitCost),
                dpsText: gameEngine.formatNumber(mercDPS),
                damageText: gameEngine.formatNumber(currentDamage),
                intervalText: currentInterval,
                canAfford,
                recruited: merc.recruited
            };
        });

        // 只有当数据真正变化时才调用setData
        // 简单的 JSON 比较可以有效防止对象引用变化导致的无谓重绘
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
        const damage = globalData.player.manualDamage;

        this.dealDamage(damage);
        // this.showDamageNumber(damage, e); // 暂时注释掉伤害数字，因为频率可能太高？不，只有手动点击才显示
        this.showDamageNumber(damage, e);

        // 触发攻击动画
        this.setData({ attacking: true });
        setTimeout(() => {
            this.setData({ attacking: false });
        }, 300);
    },

    // 造成伤害
    dealDamage(damage) {
        const globalData = app.globalData;
        const result = gameEngine.dealDamageToBoss(globalData.boss, damage);

        globalData.boss = result.boss;
        globalData.player.totalDamage += damage;

        // 造成伤害即获得金币
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
        globalData.boss.defeated++;

        // 进入下一个Boss
        const newBoss = gameEngine.nextBoss(globalData.boss.level);
        globalData.boss = newBoss;

        wx.showToast({
            title: `Boss击败!`,
            icon: 'success',
            duration: 1000
        });

        // Boss击败时可以做一次全量更新
        this.updateDisplay();
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
        const cost = Math.floor(10 * Math.pow(1.5, globalData.player.manualDamage));

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
                    const interval = gameEngine.calculateUpgradedInterval(merc);

                    // 如果计时器超过攻击间隔，触发攻击
                    if (merc._attackTimer >= interval) {
                        // 计算基础单次伤害
                        let damage = gameEngine.calculateUpgradedDamage(merc);

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
                                    this.showDamageNumber('暴击!', null, 'skill-crit');
                                }
                            }
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

    // 阻止事件冒泡
    preventClose() { }
});
