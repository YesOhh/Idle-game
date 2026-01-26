// pages/mercenaries/mercenaries.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        // Boss数据
        boss: {
            level: 1,
            currentHp: 100,
            maxHp: 100
        },
        bossHpPercent: 100,
        bossHpText: '100',
        prestigeCount: 0,
        goldText: '0',
        
        // 佣兵管理相关
        manageMercenaries: [],
        manageMercRows: [],
        selectedMercId: null,
        selectedMerc: null,
        selectedRowIndex: -1,
        
        // 刷新定时器
        refreshTimer: null
    },

    onLoad() {
        this.updateDisplay();
    },

    onShow() {
        this.updateDisplay();
        // 开启自动刷新定时器
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

    updateDisplay() {
        const globalData = app.globalData;
        
        // 更新Boss数据
        if (globalData.boss) {
            const boss = globalData.boss;
            const bossHpPercent = Math.max(0, (boss.currentHp / boss.maxHp) * 100);
            this.setData({
                boss: boss,
                bossHpPercent: bossHpPercent,
                bossHpText: gameEngine.formatNumber(boss.currentHp),
                prestigeCount: globalData.player.prestigeCount || 0,
                goldText: gameEngine.formatNumber(globalData.player.gold)
            });
        }
        
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
    },

    // 点击Boss（在佣兵页面也可以攻击）
    onTapBoss() {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        let damage = globalData.player.manualDamage * prestigeBonus.damage;

        // 全局暴击判定
        if (prestigeBonus.critChance > 0 && Math.random() < prestigeBonus.critChance) {
            const mult = 2.0 + (prestigeBonus.critMult || 0);
            damage *= mult;
        }

        const result = gameEngine.dealDamageToBoss(globalData.boss, damage, prestigeBonus.gold);
        globalData.boss = result.boss;
        globalData.player.gold += result.goldEarned;

        if (result.defeated) {
            // Boss被击败，生成新Boss
            const newBoss = gameEngine.nextBoss(globalData.boss.level);
            globalData.boss = newBoss;
            
            wx.showToast({
                title: 'Boss击败!',
                icon: 'success',
                duration: 1000
            });
        }

        this.updateDisplay();
    }
});
