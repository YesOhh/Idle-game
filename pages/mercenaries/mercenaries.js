// pages/mercenaries/mercenaries.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        goldText: '0',

        // 佣兵管理相关
        manageMercenaries: [],
        manageMercRows: [],
        selectedMercId: null,
        selectedMerc: null,
        selectedRowIndex: -1
    },

    onLoad() {
        this.updateDisplay();
    },

    onShow() {
        this.updateDisplay();
        // 启动定时刷新，因为全局战斗会持续产生金币
        this.startRefreshTimer();
    },

    onHide() {
        // 页面隐藏时停止刷新
        this.stopRefreshTimer();
    },

    onUnload() {
        this.stopRefreshTimer();
    },

    // 启动刷新定时器
    startRefreshTimer() {
        this.stopRefreshTimer();
        this._refreshTimer = setInterval(() => {
            this.updateDisplay();
        }, 500);
    },

    // 停止刷新定时器
    stopRefreshTimer() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    },

    updateDisplay() {
        const globalData = app.globalData;

        // 只更新金币
        this.setData({
            goldText: gameEngine.formatNumber(globalData.player.gold)
        });

        this.updateManageMercenaryList();
    },

    // 更新佣兵管理列表
    updateManageMercenaryList() {
        const globalData = app.globalData;
        if (!globalData.mercenaries) return;

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);

        let manageMercenaries = globalData.mercenaries.map(merc => {
            const recruitCost = gameEngine.calculateRecruitCost(merc);
            const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
            const currentDamage = dmgInfo.final;
            const currentInterval = gameEngine.calculateUpgradedInterval(merc);

            let skillInfo = gameEngine.getMercenarySkillDisplay(merc);
            if (skillInfo && skillInfo.name) {
                const match = skillInfo.name.match(/【(.+?)】/);
                skillInfo.shortName = match ? match[1] : skillInfo.name;
            }

            return {
                ...merc,
                recruitCost,
                currentDamageText: gameEngine.formatNumber(currentDamage),
                currentInterval: currentInterval.toFixed(4),
                recruitCostText: gameEngine.formatNumber(recruitCost),
                canAffordRecruit: !merc.recruited && globalData.player.gold >= recruitCost,
                skillInfo
            };
        });

        // 按价格从低到高排序
        manageMercenaries.sort((a, b) => a.recruitCost - b.recruitCost);

        // 每行3个，分组
        const ITEMS_PER_ROW = 3;
        const manageMercRows = [];
        for (let i = 0; i < manageMercenaries.length; i += ITEMS_PER_ROW) {
            manageMercRows.push({
                rowIndex: Math.floor(i / ITEMS_PER_ROW),
                items: manageMercenaries.slice(i, i + ITEMS_PER_ROW)
            });
        }

        // 更新选中的佣兵信息
        let selectedMerc = null;
        if (this.data.selectedMercId) {
            selectedMerc = manageMercenaries.find(m => m.id === this.data.selectedMercId);
        }

        this.setData({
            manageMercenaries,
            manageMercRows,
            selectedMerc
        });
    },

    // 选择佣兵
    onSelectMerc(e) {
        const mercId = e.currentTarget.dataset.id;
        const manageMercenaries = this.data.manageMercenaries;

        const mercIndex = manageMercenaries.findIndex(m => m.id === mercId);
        const ITEMS_PER_ROW = 3;
        const rowIndex = Math.floor(mercIndex / ITEMS_PER_ROW);

        if (this.data.selectedMercId === mercId) {
            this.setData({
                selectedMercId: null,
                selectedMerc: null,
                selectedRowIndex: -1
            });
        } else {
            const selectedMerc = manageMercenaries.find(m => m.id === mercId);
            this.setData({
                selectedMercId: mercId,
                selectedMerc,
                selectedRowIndex: rowIndex
            });
        }
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
    }
});
