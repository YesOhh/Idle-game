// pages/mercenaries/mercenaries.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        mercenaries: [],
        goldText: '0'
    },

    onLoad() {
        this.updateDisplay();
    },

    onShow() {
        this.updateDisplay();
    },

    // 更新显示
    updateDisplay() {
        const globalData = app.globalData;

        if (!globalData.mercenaries || globalData.mercenaries.length === 0) {
            const mercData = require('../../data/mercenaries.js');
            globalData.mercenaries = mercData.initMercenaries();
        }

        const mercenaries = globalData.mercenaries.map(merc => {
            const cost = gameEngine.calculateUpgradeCost(merc);
            const dps = merc.count > 0 ? (merc.damage * merc.count / merc.attackInterval) : 0;
            const canAfford = globalData.player.gold >= cost;

            return {
                ...merc,
                costText: gameEngine.formatNumber(cost),
                dpsText: gameEngine.formatNumber(dps),
                canAfford
            };
        });

        this.setData({
            mercenaries,
            goldText: gameEngine.formatNumber(globalData.player.gold)
        });
    },

    // 招募佣兵
    onRecruitMercenary(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary) {
            return;
        }

        const cost = gameEngine.calculateUpgradeCost(mercenary);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.count++;

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
