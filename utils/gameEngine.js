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
        if (merc.recruited) {
            // 每个佣兵的DPS = 升级后伤害 / 升级后攻击间隔
            const damage = calculateUpgradedDamage(merc);
            const interval = calculateUpgradedInterval(merc);
            const mercDPS = damage / interval;
            totalDPS += mercDPS;
        }
    });

    return totalDPS;
}

/**
 * 计算升级后的攻击力
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级后的攻击力
 */
function calculateUpgradedDamage(mercenary) {
    // 每级提升10%攻击力
    return Math.floor(mercenary.damage * Math.pow(1.1, mercenary.damageLevel));
}

/**
 * 计算升级后的攻击间隔
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级后的攻击间隔
 */
function calculateUpgradedInterval(mercenary) {
    // 每级减少5%攻击间隔（最低0.1秒）
    const interval = mercenary.attackInterval * Math.pow(0.95, mercenary.intervalLevel);
    // 保留2位小数
    return Math.max(0.1, Math.round(interval * 100) / 100);
}

/**
 * 计算攻击力升级成本
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级成本
 */
function calculateDamageUpgradeCost(mercenary) {
    const totalLevels = mercenary.damageLevel + mercenary.intervalLevel;
    // 基础成本 * (1.5 ^ 总等级)
    return Math.floor(mercenary.baseCost * Math.pow(1.5, totalLevels));
}

/**
 * 计算攻击间隔升级成本
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级成本
 */
function calculateIntervalUpgradeCost(mercenary) {
    const totalLevels = mercenary.damageLevel + mercenary.intervalLevel;
    // 基础成本 * (1.3 ^ 总等级)
    return Math.floor(mercenary.baseCost * Math.pow(1.3, totalLevels));
}

/**
 * 计算雇佣成本
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 雇佣成本
 */
function calculateRecruitCost(mercenary) {
    return mercenary.baseCost;
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
        defeated,
        goldEarned: damage  // 新增：造成的伤害=获得的金币
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

    // 金币收益 = 总伤害 (因为伤害=金币)
    totalGold = Math.floor(remainingDamage);

    // 模拟击败Boss (用于计算等级提升)
    let tempDamage = remainingDamage;

    while (tempDamage > 0 && bossesDefeated < 100) {
        const bossHp = calculateBossMaxHp(currentLevel);

        if (tempDamage >= bossHp) {
            tempDamage -= bossHp;
            // totalGold += calculateBossReward(currentLevel); // 不再给予击杀奖励
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
    calculateUpgradedDamage,
    calculateUpgradedInterval,
    calculateDamageUpgradeCost,
    calculateIntervalUpgradeCost,
    calculateRecruitCost,
    dealDamageToBoss,
    nextBoss,
    calculateOfflineProgress
};
