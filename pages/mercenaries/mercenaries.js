// pages/mercenaries/mercenaries.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        mercenaries: [],
        goldText: '0',
        refreshTimer: null
    },

    onLoad() {
        this.updateDisplay();
    },

    onShow() {
        this.updateDisplay();
        // 开启自动刷新定时器，实时同步金币变化
        this.data.refreshTimer = setInterval(() => {
            this.updateDisplay();
        }, 500);
    },

    onHide() {
        if (this.data.refreshTimer) {
            clearInterval(this.data.refreshTimer);
            this.data.refreshTimer = null;
        }
    },

    onUnload() {
        if (this.data.refreshTimer) {
            clearInterval(this.data.refreshTimer);
            this.data.refreshTimer = null;
        }
    },

    // 更新显示
    updateDisplay() {
        const globalData = app.globalData;

        if (!globalData.mercenaries || globalData.mercenaries.length === 0) {
            const mercData = require('../../data/mercenaries.js');
            globalData.mercenaries = mercData.initMercenaries();
        }

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);

        const mercenaries = globalData.mercenaries.map(merc => {
            const recruitCost = gameEngine.calculateRecruitCost(merc);
            // 使用统一的升级成本 (应用遗物减费)
            const upgradeCost = gameEngine.calculateMercenaryUpgradeCost(merc, prestigeBonus.costReduction);

            const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
            const currentDamage = dmgInfo.final;
            const currentInterval = gameEngine.calculateUpgradedInterval(merc);

            // 获取技能显示信息
            const skillInfo = gameEngine.getMercenarySkillDisplay(merc);

            // 计算DPS: 只有雇佣了才计算
            const mercDPS = merc.recruited ? (currentDamage / currentInterval) : 0;

            // 判断是否买得起
            const canAffordRecruit = !merc.recruited && globalData.player.gold >= recruitCost;
            // 升级成本相同
            const canAffordUpgrade = merc.recruited && globalData.player.gold >= upgradeCost;

            return {
                ...merc,
                currentDamageText: dmgInfo.text, // 统一使用解耦后的显示格式
                currentInterval,
                recruitCostText: gameEngine.formatNumber(recruitCost),
                // 两个按钮显示相同的成本
                damageCostText: gameEngine.formatNumber(upgradeCost),
                intervalCostText: gameEngine.formatNumber(upgradeCost),
                dpsText: gameEngine.formatNumber(mercDPS),
                canAffordRecruit,
                // 用于样式判断
                canAffordDamage: canAffordUpgrade,
                canAffordInterval: canAffordUpgrade,
                skillInfo // 传递给WXML
            };
        });

        const currentJson = JSON.stringify(mercenaries);

        // 只有当数据真正变化时才更新列表，防止闪烁
        if (currentJson !== this.data._lastJson) {
            this.setData({
                mercenaries
            });
            this.data._lastJson = currentJson;
        }

        // 金币总是需要更新的
        this.setData({
            goldText: gameEngine.formatNumber(globalData.player.gold)
        });
    },

    // 招募佣兵
    onRecruitMercenary(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        // 如果找不到 或者 已经雇佣了，就不执行
        if (!mercenary || mercenary.recruited) {
            return;
        }

        const cost = gameEngine.calculateRecruitCost(mercenary);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.recruited = true;

            const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
            // 首次招募，伤害和间隔使用当前等级（初始为0）计算的值
            mercenary.currentDamage = gameEngine.calculateUpgradedDamage(mercenary, prestigeBonus.damage);
            mercenary.currentInterval = gameEngine.calculateUpgradedInterval(mercenary);

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

    // 升级攻击力
    onUpgradeDamage(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || !mercenary.recruited) {
            return;
        }

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = gameEngine.calculateMercenaryUpgradeCost(mercenary, prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.damageLevel++;
            mercenary.currentDamage = gameEngine.calculateUpgradedDamage(mercenary, prestigeBonus.damage);

            wx.showToast({
                title: '攻击力升级成功!',
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

    // 升级攻击间隔
    onUpgradeInterval(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || !mercenary.recruited) {
            return;
        }

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = gameEngine.calculateMercenaryUpgradeCost(mercenary, prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.intervalLevel++;
            mercenary.currentInterval = gameEngine.calculateUpgradedInterval(mercenary);

            wx.showToast({
                title: '攻速升级成功!',
                icon: 'success'
            });

            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    }
});
