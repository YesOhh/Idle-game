// utils/gameEngine.js - 核心游戏引擎

/**
 * 格式化大数字
 * @param {number} num - 要格式化的数字
 * @returns {string} - 格式化后的字符串
 */
function formatNumber(num) {
    if (num < 1000) {
        return Math.floor(num).toString();
    }

    const units = ['', '千', '万', '亿', '兆', '京', '垓', '秭', '穰'];
    const unitValue = [1, 1e3, 1e4, 1e8, 1e12, 1e16, 1e20, 1e24, 1e28];

    for (let i = unitValue.length - 1; i >= 0; i--) {
        if (num >= unitValue[i]) {
            const value = num / unitValue[i];
            if (value >= 1000) {
                return value.toFixed(2) + units[i];
            }
            return value.toFixed(1) + units[i];
        }
    }

    return num.toExponential(2);
}

/**
 * 计算Boss的最大血量
 * @param {number} level - Boss等级
 * @returns {number} - 最大血量
 */
function calculateBossMaxHp(level) {
    // 血量公式: 100 * (1.5 ^ level)
    return Math.floor(100 * Math.pow(1.5, level));
}

/**
 * 计算击败Boss的金币奖励
 * @param {number} level - Boss等级
 * @returns {number} - 金币奖励
 */
function calculateBossReward(level) {
    // 奖励公式: 10 * level * (1.2 ^ level)
    return Math.floor(10 * level * Math.pow(1.2, level));
}

/**
 * 计算总DPS（每秒伤害）
 * @param {Array} mercenaries - 佣兵数组
 * @returns {number} - 总DPS
 */
function calculateTotalDPS(mercenaries) {
    let totalDPS = 0;

    mercenaries.forEach(merc => {
        if (merc.count > 0) {
            // 每个佣兵的DPS = 基础伤害 * 数量 * 攻击速度
            const mercDPS = merc.damage * merc.count * (1 / merc.attackInterval);
            totalDPS += mercDPS;
        }
    });

    return totalDPS;
}

/**
 * 计算佣兵升级成本
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级成本
 */
function calculateUpgradeCost(mercenary) {
    // 成本公式: 基础成本 * (1.15 ^ 当前数量)
    return Math.floor(mercenary.baseCost * Math.pow(1.15, mercenary.count));
}

/**
 * 处理Boss受到伤害
 * @param {Object} boss - Boss对象
 * @param {number} damage - 伤害值
 * @returns {Object} - 更新后的Boss对象和是否击败
 */
function dealDamageToBoss(boss, damage) {
    const newHp = Math.max(0, boss.currentHp - damage);
    const defeated = newHp === 0;

    return {
        boss: {
            ...boss,
            currentHp: newHp
        },
        defeated
    };
}

/**
 * 进入下一个Boss
 * @param {number} currentLevel - 当前Boss等级
 * @returns {Object} - 新的Boss对象
 */
function nextBoss(currentLevel) {
    const newLevel = currentLevel + 1;
    const maxHp = calculateBossMaxHp(newLevel);

    return {
        level: newLevel,
        currentHp: maxHp,
        maxHp: maxHp
    };
}

/**
 * 计算离线收益
 * @param {number} dps - 每秒伤害
 * @param {number} offlineSeconds - 离线秒数
 * @param {number} bossLevel - 当前Boss等级
 * @returns {Object} - 离线收益信息
 */
function calculateOfflineProgress(dps, offlineSeconds, bossLevel) {
    // 限制离线时间最多8小时
    const maxOfflineTime = 8 * 60 * 60;
    const actualOfflineTime = Math.min(offlineSeconds, maxOfflineTime);

    // 离线效率为70%
    const offlineEfficiency = 0.7;
    const effectiveDPS = dps * offlineEfficiency;

    let totalGold = 0;
    let bossesDefeated = 0;
    let currentLevel = bossLevel;
    let remainingDamage = effectiveDPS * actualOfflineTime;

    // 模拟击败Boss
    while (remainingDamage > 0 && bossesDefeated < 100) {
        const bossHp = calculateBossMaxHp(currentLevel);

        if (remainingDamage >= bossHp) {
            remainingDamage -= bossHp;
            totalGold += calculateBossReward(currentLevel);
            bossesDefeated++;
            currentLevel++;
        } else {
            break;
        }
    }

    return {
        gold: totalGold,
        bossesDefeated,
        newLevel: currentLevel,
        timeProcessed: actualOfflineTime
    };
}

module.exports = {
    formatNumber,
    calculateBossMaxHp,
    calculateBossReward,
    calculateTotalDPS,
    calculateUpgradeCost,
    dealDamageToBoss,
    nextBoss,
    calculateOfflineProgress
};
