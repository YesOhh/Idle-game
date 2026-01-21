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
function calculateTotalDPS(mercenaries, globalDamageBuff = 0, globalSpeedBuff = 0, prestigeDamageMult = 1) {
    let totalDPS = 0;

    mercenaries.forEach(merc => {
        if (merc.recruited) {
            // 每个佣兵的DPS = 升级后伤害 / 升级后攻击间隔
            let damage = calculateUpgradedDamage(merc, prestigeDamageMult);
            let interval = calculateUpgradedInterval(merc);

            // 应用临时全局Buff
            if (globalDamageBuff) damage *= (1 + globalDamageBuff);
            if (globalSpeedBuff) interval *= (1 - globalSpeedBuff);

            const mercDPS = damage / interval;
            totalDPS += mercDPS;
        }
    });

    return totalDPS;
}

function calculateUpgradedDamage(mercenary, prestigeDamageMult = 1) {
    // 1. 计算基础伤害 (包含等级加成、里程碑、佣兵个体技能)
    let baseDamage = calculateMercenaryBaseDamage(mercenary);

    // 2. 应用周目/圣物全局加成
    let finalDamage = baseDamage * prestigeDamageMult;

    return Math.floor(finalDamage);
}

/**
 * 计算佣兵的基础伤害 (不含周目/圣物加成)
 */
function calculateMercenaryBaseDamage(mercenary) {
    // 动态伤害系数精修
    let effectiveLevel = mercenary.damageLevel;
    if (mercenary.id === 'legend') {
        effectiveLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0);
    }

    const dynamicDmgExp = 1.24 + (effectiveLevel * 0.0007);
    let damage = Math.floor(mercenary.damage * Math.pow(dynamicDmgExp, effectiveLevel));

    // 里程碑
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0);
    if (totalLevel >= 100) {
        damage *= 4;
    } else if (totalLevel >= 50) {
        damage *= 2;
    }

    // 战士等自带的堆叠Buff (属于该佣兵个体的成长)
    if (mercenary._stackingBuff) {
        damage *= (1 + mercenary._stackingBuff);
    }

    return Math.floor(damage);
}

/**
 * 获取用于显示的属性信息 (基础 + 额外)
 */
function getDamageDisplayInfo(mercenary, prestigeDamageMult = 1) {
    const base = calculateMercenaryBaseDamage(mercenary);
    const final = Math.floor(base * prestigeDamageMult);
    const bonus = final - base;

    return {
        base,
        bonus,
        final,
        text: bonus > 0 ? `${formatNumber(base)} (+${formatNumber(bonus)})` : `${formatNumber(base)}`
    };
}

/**
 * 计算当前攻击间隔
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 攻击间隔（秒）
 */
function calculateUpgradedInterval(mercenary) {
    // 还原之前的“当前算法” (渐进式衰减)
    // 玩家反馈攻速升级太快，这里调慢衰减速度
    // minInterval 是理论极限
    const minInterval = 0.1;

    // 调整衰减率：从 0.9 提升到 0.94 (越大越慢)
    // 修正计算：让攻速越慢的英雄，每级提升的幅度相对更大一点，但整体速度放缓
    let decayRate = 0.94 + (mercenary.attackInterval - 1) * 0.01;
    decayRate = Math.min(0.995, Math.max(0.92, decayRate));

    // [传说] 核心：如果是传说，攻速算法中的“等级”参数 = (攻速等级 + 攻击等级)
    let effectiveLevel = mercenary.intervalLevel;
    if (mercenary.id === 'legend') {
        effectiveLevel = (mercenary.intervalLevel || 0) + (mercenary.damageLevel || 0);
    }

    const decayFactor = Math.pow(decayRate, effectiveLevel);
    let interval = minInterval + (mercenary.attackInterval - minInterval) * decayFactor;

    // 应用里程碑奖励 (Lv 75, Lv 100) - 这里的直接乘算依然保留
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0);
    if (totalLevel >= 75) interval *= 0.8;
    if (totalLevel >= 100) interval *= 0.8;

    // 应用圣物全局攻速加成 (如果有)
    if (mercenary._prestigeSpeedBuff) {
        interval *= (1 - mercenary._prestigeSpeedBuff);
    }

    return Math.max(0.1, Number(interval.toFixed(2)));
}

/**
 * 计算重生/遗物加成
 * @param {Object} player - 玩家对象
 * @returns {Object} - 加成倍率 (damage, gold, costReduction)
 */
function calculatePrestigeBonus(player) {
    if (!player) return {
        damage: 1,
        gold: 1,
        costReduction: 1,
        speed: 0,
        critChance: 0,
        critMult: 0
    };

    const prestigeCount = player.prestigeCount || 0;
    // 基础重生加成：移除自动加成，转为完全靠圣物
    let damageMult = 1;
    let goldMult = 1;
    let costReduction = 1;

    // 新增属性
    let speedBuff = 0;
    let critChance = 0;
    let critMult = 0;

    // 遗物加成
    if (player.relics && player.relics.length > 0) {
        player.relics.forEach(relic => {
            const level = relic.level || 1;
            const totalVal = relic.val * level;

            if (relic.type === 'damage') damageMult += totalVal;
            if (relic.type === 'gold') goldMult += totalVal;
            if (relic.type === 'cost') {
                // 成本削减堆叠：1 - (1-val)^level 或 简单线性？
                // 推荐线性但封顶，或者乘法：
                for (let i = 0; i < level; i++) {
                    costReduction *= (1 - relic.val);
                }
            }
            if (relic.type === 'speed') speedBuff += totalVal;
            if (relic.type === 'crit_chance') critChance += totalVal;
            if (relic.type === 'crit_mult') critMult += totalVal;
        });
    }

    return {
        damage: damageMult,
        gold: goldMult,
        costReduction: costReduction,
        speed: speedBuff,
        critChance: critChance,
        critMult: critMult
    };
}

/**
 * 计算佣兵升级成本 (统一)
 * @param {Object} mercenary - 佣兵对象
 * @returns {number} - 升级成本
 */
function calculateMercenaryUpgradeCost(mercenary, costReduction = 1) {
    // 统一等级 = 攻击等级 + 间隔等级
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    // 动态成本系数算法
    const dynamicExponent = 1.28 + (totalLevel * 0.003);

    let cost = Math.floor(mercenary.baseCost * Math.pow(dynamicExponent, totalLevel));

    // 应用遗物成本削减
    return Math.floor(cost * costReduction);
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
function dealDamageToBoss(boss, damage, prestigeGoldMult = 1) {
    // 核心修复：如果Boss已经死亡，不再产生伤害或触发击败逻辑
    if (boss.currentHp <= 0) {
        return { boss, defeated: false, goldEarned: 0 };
    }

    const newHp = Math.max(0, boss.currentHp - damage);
    const defeated = newHp === 0;
    return {
        boss: {
            ...boss,
            currentHp: newHp
        },
        defeated,
        goldEarned: Math.floor(damage * prestigeGoldMult)  // 造成的伤害 * 重生金币加成 = 获得的金币
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

    // Mage Skill: "Arcane Surge" (Unlock Lv 20)
    if (mercenary.id === 'mage' && totalLevel >= 20) {
        const bonusSpeed = 0.05 + Math.floor((totalLevel - 20) / 10) * 0.05;
        return {
            type: 'global_speed_buff',
            name: '奥术激涌',
            chance: 0.05,
            val: bonusSpeed, // Dynamic speed increase
            duration: 3000, // 3 seconds
            desc: `5%几率使全体攻速提升${(bonusSpeed * 100).toFixed(0)}% (持续3秒)`
        };
    }

    // Dragon Rider Skill: "Devastating Breath" (Unlock Lv 40)
    if (mercenary.id === 'dragon' && totalLevel >= 40) {
        const leaderBuff = Math.min(0.50, 0.20 + Math.floor((totalLevel - 40) / 10) * 0.10);
        return {
            type: 'burst_boost',
            name: '毁灭龙息',
            chance: 0.10,
            multiplier: 30, // 30x damage
            buffVal: leaderBuff, // Dynamic damage boost
            duration: 2000, // 2 seconds
            desc: `10%几率造成30倍伤害，并使全队伤害提升${(leaderBuff * 100).toFixed(0)}% (持续2秒)`
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
            name: '【熟练】',
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
            name: '【爆裂】',
            isUnlocked,
            desc
        };
    }

    if (mercenary.id === 'legend') {
        const isUnlocked = mercenary.recruited;
        return {
            name: '【全能】',
            isUnlocked: !!isUnlocked,
            desc: isUnlocked ? '升级攻击力时攻击速度也会提升，反之亦然' : '（招募后解锁）'
        };
    }

    if (mercenary.id === 'mage') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        let bonusStr = '';
        if (isUnlocked) {
            const bonusSpeed = 0.05 + Math.floor((totalLevel - unlockLv) / 10) * 0.05;
            bonusStr = ` (当前: ${(bonusSpeed * 100).toFixed(0)}%)`;
        }
        return {
            name: '【奥术激涌】',
            isUnlocked,
            desc: isUnlocked ? `5%几率使全体攻速提升${bonusStr} (持续3秒)` : `（达到 Lv.${unlockLv} 解锁）`
        };
    }

    if (mercenary.id === 'dragon') {
        const unlockLv = 40;
        const isUnlocked = totalLevel >= unlockLv;
        let bonusStr = '';
        if (isUnlocked) {
            const leaderBuff = Math.min(0.50, 0.20 + Math.floor((totalLevel - unlockLv) / 10) * 0.10);
            bonusStr = ` (当前增伤: ${(leaderBuff * 100).toFixed(0)}%)`;
        }
        return {
            name: '【毁灭龙息】',
            isUnlocked,
            desc: isUnlocked ? `10%几率触发30倍伤害及全队${bonusStr} (持续2秒)` : `（达到 Lv.${unlockLv} 解锁）`
        };
    }

    return null;
}

/**
 * 遗物定义池
 */
const RELIC_POOL = [
    { id: 'relic_dmg_low', name: '士兵的磨刀石', type: 'damage', val: 0.10, desc: '伤害 +10%', icon: '🪵' },
    { id: 'relic_gold_low', name: '褪色的铜币', type: 'gold', val: 0.10, desc: '金币收益 +10%', icon: '🪙' },
    { id: 'relic_speed_1', name: '机械发条', type: 'speed', val: 0.05, desc: '攻击速度 +5%', icon: '⚙️' },
    { id: 'relic_cost_low', name: '战术速记本', type: 'cost', val: 0.05, desc: '升级成本 -5%', icon: '📖' },
    { id: 'relic_crit_c_1', name: '鹰眼瞄具', type: 'crit_chance', val: 0.02, desc: '暴击率 +2%', icon: '🎯' },
    { id: 'relic_crit_m_1', name: '锋利刀刃', type: 'crit_mult', val: 0.20, desc: '暴击伤害 +20%', icon: '🔪' },
    { id: 'relic_dmg_mid', name: '勇士之证', type: 'damage', val: 0.30, desc: '伤害 +30%', icon: '🏅' },
    { id: 'relic_gold_mid', name: '商人的契约', type: 'gold', val: 0.30, desc: '金币收益 +30%', icon: '📜' }
];

/**
 * 随机获取 3 个不重复的遗物选项
 */
function getRandomRelicChoices() {
    const shuffled = [...RELIC_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
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
    getMercenarySkillDisplay,
    calculatePrestigeBonus,
    getRandomRelicChoices,
    getDamageDisplayInfo,
    calculateMercenaryBaseDamage
};
