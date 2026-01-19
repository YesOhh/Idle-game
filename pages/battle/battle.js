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
        this.stopAutoAttack();
    },

    onShow() {
        this.startAutoAttack();
        this.updateDisplay();
    },

    // 初始化游戏
    initGame() {
        const globalData = app.globalData;

        // 处理离线收益
        if (globalData.offlineSeconds && globalData.offlineSeconds > 60) {
            this.processOfflineProgress(globalData.offlineSeconds);
        }

        // 初始化佣兵数据（如果没有）
        if (!globalData.mercenaries || globalData.mercenaries.length === 0) {
            const mercData = require('../../data/mercenaries.js');
            globalData.mercenaries = mercData.initMercenaries();
        } else {
            // 数据迁移：处理旧存档
            globalData.mercenaries.forEach(merc => {
                if (merc.recruited === undefined) {
                    merc.recruited = (merc.count > 0);
                    merc.damageLevel = 0;
                    merc.intervalLevel = 0;
                    merc.currentDamage = merc.damage;
                    merc.currentInterval = merc.attackInterval;
                }
                // 确保有currentDamage和currentInterval字段（即使已迁移也可能因为升级逻辑变更需要重算? 暂时不需要重算，初始值为base即可，后续升级会覆盖）
                if (merc.currentDamage === undefined) {
                    merc.currentDamage = merc.damage;
                }
                if (merc.currentInterval === undefined) {
                    merc.currentInterval = merc.attackInterval;
                }
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

    // 更新显示
    updateDisplay() {
        const globalData = app.globalData;
        const boss = globalData.boss;
        const player = globalData.player;

        const hpPercent = (boss.currentHp / boss.maxHp) * 100;
        const dps = gameEngine.calculateTotalDPS(globalData.mercenaries);

        // 计算升级点击伤害的成本
        const upgradeClickCost = Math.floor(10 * Math.pow(1.5, player.manualDamage));

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
                canAfford,
                recruited: merc.recruited
            };
        });

        this.setData({
            boss: boss,
            bossHpPercent: hpPercent,
            bossHpText: `${gameEngine.formatNumber(boss.currentHp)} / ${gameEngine.formatNumber(boss.maxHp)}`,
            goldText: gameEngine.formatNumber(player.gold),
            manualDamageText: gameEngine.formatNumber(player.manualDamage),
            dpsText: gameEngine.formatNumber(dps),
            upgradeClickCostText: gameEngine.formatNumber(upgradeClickCost),
            mercenaries: mercenaries
        });
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
            this.updateDisplay();
        }
    },

    // Boss被击败
    onBossDefeated() {
        const globalData = app.globalData;
        // Boss击败不再给予额外金币奖励，只推进关卡
        // const reward = gameEngine.calculateBossReward(globalData.boss.level);

        // globalData.player.gold += reward;
        globalData.boss.defeated++;

        // 进入下一个Boss
        const newBoss = gameEngine.nextBoss(globalData.boss.level);
        globalData.boss = newBoss;

        wx.showToast({
            title: `Boss击败!`,
            icon: 'success',
            duration: 1000
        });

        this.updateDisplay();
    },

    // 显示伤害数字
    showDamageNumber(damage, e) {
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

        this.data.autoAttackTimer = setInterval(() => {
            const globalData = app.globalData;
            const dps = gameEngine.calculateTotalDPS(globalData.mercenaries);

            if (dps > 0) {
                // 每0.1秒造成DPS/10的伤害
                const damage = dps / 10;
                this.dealDamage(damage);
            }
        }, 100);
    },

    // 停止自动攻击
    stopAutoAttack() {
        if (this.data.autoAttackTimer) {
            clearInterval(this.data.autoAttackTimer);
            this.data.autoAttackTimer = null;
        }
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
