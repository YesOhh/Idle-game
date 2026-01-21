// pages/relics/relics.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        relics: [],
        bonusSummary: null,
        selectedId: null
    },

    onShow() {
        this.loadRelics();
    },

    loadRelics() {
        const globalData = app.globalData;
        const player = globalData.player;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(player);

        const relics = (player.relics || []).map(relic => {
            const level = relic.level || 1;
            let currentEffectText = '';
            let baseValText = '';

            if (relic.type === 'damage') {
                currentEffectText = `+${(relic.val * level * 100).toFixed(0)}%`;
                baseValText = `+${(relic.val * 100).toFixed(0)}%`;
            } else if (relic.type === 'gold') {
                currentEffectText = `+${(relic.val * level * 100).toFixed(0)}%`;
                baseValText = `+${(relic.val * 100).toFixed(0)}%`;
            } else if (relic.type === 'speed') {
                currentEffectText = `+${(relic.val * level * 100).toFixed(0)}%`;
                baseValText = `+${(relic.val * 100).toFixed(0)}%`;
            } else if (relic.type === 'cost') {
                // 成本计算稍微复杂点，这里仅显示标称值
                currentEffectText = `-${(relic.val * level * 100).toFixed(0)}% (约)`;
                baseValText = `-${(relic.val * 100).toFixed(0)}%`;
            } else if (relic.type === 'crit_chance') {
                currentEffectText = `+${(relic.val * level * 100).toFixed(0)}%`;
                baseValText = `+${(relic.val * 100).toFixed(0)}%`;
            } else if (relic.type === 'crit_mult') {
                currentEffectText = `+${(relic.val * level * 100).toFixed(0)}%`;
                baseValText = `+${(relic.val * 100).toFixed(0)}%`;
            }

            return {
                ...relic,
                currentEffectText,
                baseValText
            };
        });

        this.setData({
            relics,
            bonusSummary: {
                damage: ((prestigeBonus.damage - 1) * 100).toFixed(0),
                gold: ((prestigeBonus.gold - 1) * 100).toFixed(0),
                speed: (prestigeBonus.speed * 100).toFixed(0),
                critChance: (prestigeBonus.critChance * 100).toFixed(0),
                critMult: (prestigeBonus.critMult * 100).toFixed(0),
                costReduction: ((1 - prestigeBonus.costReduction) * 100).toFixed(0)
            }
        });
    },

    onSelectRelic(e) {
        const id = e.currentTarget.dataset.id;
        this.setData({
            selectedId: this.data.selectedId === id ? null : id
        });
    }
});
