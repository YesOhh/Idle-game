// utils/gameEngine.js - 核心游戏引擎

/**
 * 格式化大数字
 * @param {number} num - 要格式化的数字
 * @returns {string} - 格式化后的字符串
 */
function formatNumber(num) {
    if (num < 1000) {
        // 如果是整数，显示整数；如果是小数，保留1位，并去除末尾的0
        return parseFloat(num.toFixed(1)).toString();
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
    // 只有12个Boss，数值需要指数级爆炸
    // 玩家要求：提高到500倍
    // Boss 1: 30,000 (3万)
    // Boss 2: 30,000 * 500 = 15,000,000 (1500万)
    // Boss 3: 1500万 * 500 = 75亿
    // 每一级都是500倍的跨度，这真的是天文数字了
    return Math.floor(30000 * Math.pow(500.0, level - 1));
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
    // 动态伤害系数精修：
    // 玩家要求：初期提高（不再那么慢），但后期增长要平缓，不能太高
    // 基础系数提升至 1.24 (接近原本好评的1.25固定值)
    // 增长斜率大幅降低 0.002 -> 0.0007
    // Lv 0: 1.24 (强力起步)
    // Lv 50: 1.24 + 0.035 = 1.275
    // Lv 100: 1.24 + 0.07 = 1.31 (基本持平之前的 1.32，保持长线可控)
    const dynamicDmgExp = 1.24 + (mercenary.damageLevel * 0.0007);

    // 基础伤害计算
    let damage = Math.floor(mercenary.damage * Math.pow(dynamicDmgExp, mercenary.damageLevel));

    // 总等级 = 攻击等级 + 间隔等级
    // 假设初始等级是0? 或者 mercenary.damageLevel 就是等级。
    // 看代码 mercenary.damageLevel 初始是0。所以 totalLevel 就是投入的点数。
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    // 4. 应用等级里程碑加成
    if (totalLevel >= 100) {
        damage *= 4;
    } else if (totalLevel >= 50) {
        damage *= 2;
    }

    // 5. 应用技能属性加成 (如战士的永久叠加Buff)
    if (mercenary._stackingBuff) {
        damage *= (1 + mercenary._stackingBuff);
    }

    return Math.floor(damage);
}

/**
 * 计算升级后的攻击间隔
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级后的攻击间隔
 */
function calculateUpgradedInterval(mercenary) {
    // 最小攻击间隔阈值 (秒)
    const minInterval = 0.3;

    // 动态衰减系数：初始攻速越慢，提升越难（衰减系数越大）
    // 基础系数 0.9 (对应1.0s的单位)
    // 每慢 1秒，系数 +0.015 (变得更接近1，即衰减更慢)
    // 上限 0.99 (防止变成1或更大导致不衰减)
    let decayRate = 0.9 + (mercenary.attackInterval - 1) * 0.015;
    decayRate = Math.min(0.99, Math.max(0.9, decayRate));

    // 渐进式公式
    const decayFactor = Math.pow(decayRate, mercenary.intervalLevel);
    let interval = minInterval + (mercenary.attackInterval - minInterval) * decayFactor;

    // 里程碑加成
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    // Lv 75: 间隔减少20%
    if (totalLevel >= 75) interval *= 0.8;
    // Lv 100: 间隔再减少20% (总共x0.64)
    if (totalLevel >= 100) interval *= 0.8;

    // 保留2位小数
    return Math.round(interval * 100) / 100;
}

/**
 * 计算佣兵升级成本 (统一)
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级成本
 */
function calculateMercenaryUpgradeCost(mercenary) {
    // 统一等级 = 攻击等级 + 间隔等级
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    // 动态成本系数算法：
    // 玩家要求：把初期系数稍微增加一点
    // 基础系数 1.25 -> 1.28
    // 每级增加 0.003
    // Lv 0: 1.28
    // Lv 43: 1.28 + 0.129 = 1.409 (合适)
    // Lv 100: 1.28 + 0.3 = 1.58 (硬上限)
    const dynamicExponent = 1.28 + (totalLevel * 0.003);

    return Math.floor(mercenary.baseCost * Math.pow(dynamicExponent, totalLevel));
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

const { BOSS_DATA } = require('../data/bosses.js');

/**
 * 进入下一个Boss
 * @param {number} currentLevel - 当前Boss等级
 * @returns {Object} - 新的Boss对象
 */
function nextBoss(currentLevel) {
    // 只有12关，超过12关则保持在第12关
    const newLevel = Math.min(12, currentLevel + 1);
    const maxHp = calculateBossMaxHp(newLevel);
    const bossInfo = BOSS_DATA[newLevel - 1];

    return {
        level: newLevel,
        currentHp: maxHp,
        maxHp: maxHp,
        name: bossInfo.name,
        icon: bossInfo.icon,
        desc: bossInfo.desc,
        isMaxLevel: newLevel === 12
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
    // 离线效率为70%
    const offlineEfficiency = 0.7;
    const effectiveDPS = dps * offlineEfficiency;

    // 先计算剩余总伤害
    let remainingDamage = Math.floor(effectiveDPS * actualOfflineTime);

    // 初始化变量
    let totalGold = remainingDamage; // 金币收益 = 总伤害
    let bossesDefeated = 0;
    let currentLevel = bossLevel;

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

/**
 * 获取佣兵技能信息
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - 技能配置或null
 */
function getMercenarySkill(mercenary) {
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    // 战士技能：【熟练】(Lv 30解锁)
    // 每次攻击有几率提高1%攻击力
    if (mercenary.id === 'warrior' && totalLevel >= 30) {
        // 初始几率3%，每10级增加1%
        const extraChance = Math.floor((totalLevel - 30) / 10) * 0.01;
        const chance = 0.03 + extraChance;

        return {
            type: 'stacking_buff',
            name: '熟练',
            chance: chance,
            val: 0.01, // 提升1%
            desc: `每次攻击有 ${(chance * 100).toFixed(0)}% 几率永久叠加1%攻击力`
        };
    }

    // 弓箭手技能：【爆裂】(Lv 20解锁)
    // 20%几率暴击
    if (mercenary.id === 'archer' && totalLevel >= 20) {
        // 初始倍率3倍，每10级增加0.5倍
        const extraMult = Math.floor((totalLevel - 20) / 10) * 0.5;
        const multiplier = 3.0 + extraMult;

        return {
            type: 'crit',
            name: '爆裂',
            chance: 0.20, // 固定20%
            multiplier: multiplier,
            desc: `20% 几率造成 ${multiplier.toFixed(1)}倍 伤害`
        };
    }

    return null;
}

/**
 * 获取佣兵技能显示信息 (用于UI)
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - UI显示用的技能信息
 */
function getMercenarySkillDisplay(mercenary) {
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    if (mercenary.id === 'warrior') {
        const unlockLv = 30;
        const isUnlocked = totalLevel >= unlockLv;

        let desc = '每次攻击有几率永久提升攻击力';
        if (isUnlocked) {
            const extraChance = Math.floor((totalLevel - 30) / 10) * 0.01;
            const chance = 0.03 + extraChance;
            desc = `有${(chance * 100).toFixed(0)}%几率永久提升1%攻击力`;
        } else {
            desc = '（达到 Lv.30 解锁）';
        }

        return {
            name: '技能:【熟练】',
            isUnlocked,
            desc
        };
    }

    if (mercenary.id === 'archer') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;

        let desc = '攻击有几率造成多倍暴击伤害';
        if (isUnlocked) {
            const extraMult = Math.floor((totalLevel - 20) / 10) * 0.5;
            const multiplier = 3.0 + extraMult;
            desc = `20%几率造成${multiplier.toFixed(1)}倍伤害`;
        } else {
            desc = '（达到 Lv.20 解锁）';
        }

        return {
            name: '技能:【爆裂】',
            isUnlocked,
            desc
        };
    }

    return null;
}

module.exports = {
    calculateTotalDPS,
    calculateUpgradedDamage,
    calculateUpgradedInterval,
    calculateMercenaryUpgradeCost,
    calculateRecruitCost,
    dealDamageToBoss,
    calculateBossMaxHp,
    calculateBossReward,
    nextBoss,
    calculateOfflineProgress,
    formatNumber,
    getMercenarySkill,
    getMercenarySkillDisplay // 导出显示函数
};
