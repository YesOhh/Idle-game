// utils/gameEngine.js - 核心游戏引擎

/**
 * 格式化大数字（纯数字显示，带千分位分隔符）
 * @param {number} num - 要格式化的数字
 * @returns {string} - 格式化后的字符串
 */
function formatNumber(num) {
    if (num < 1) {
        return parseFloat(num.toFixed(2)).toString();
    }
    // 取整并添加千分位分隔符
    return Math.floor(num).toLocaleString('en-US');
}

/**
 * 计算Boss的最大血量
 * @param {number} level - Boss等级
 * @returns {number} - 最大血量
 */
function calculateBossMaxHp(level) {
    // 每一级都是135倍的跨度
    return Math.floor(30000 * Math.pow(135, level - 1));
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

    // 2. 应用传授技能的永久加成
    if (mercenary._teachingBonus) {
        baseDamage += mercenary._teachingBonus;
    }

    // 3. 应用周目/圣物全局加成
    let finalDamage = baseDamage * prestigeDamageMult;

    return Math.floor(finalDamage);
}

/**
 * 计算佣兵的基础伤害 (不含周目/圣物加成)
 *
 * 参考《打BOSS》原版规律：
 * - 攻击力是【加法增长】，不是乘法！
 * - 阶段划分：升级1-4次为阶段0，之后每5次升级进入下一阶段
 * - 增加值查表：[2, 3, 4, 6, 9, 13, 19, 28, 42, 63, 95, 142, 212...]
 * - 超出查表范围后使用 1.5 倍增长
 * - 第一级增加值 = floor(baseAtk / 2)，通过 scale = baseAtk / 4 实现
 * - 51级及以后：增加值翻倍
 * - 101级及以后：增加值再翻倍 (总共4倍)
 */

// 增加值查表 (基于 baseAtk=4 的基准值)
const ADD_VALUE_TABLE = [2, 3, 4, 6, 9, 13, 19, 28, 42, 63, 95, 142, 212];

/**
 * 获取升级次数对应的阶段
 * @param {number} upgradeCount - 升级次数 (从1开始)
 * @returns {number} - 阶段编号 (从0开始)
 */
function getUpgradeTier(upgradeCount) {
    // 升级1-4次: 阶段0
    // 升级5-9次: 阶段1
    // 升级10-14次: 阶段2
    // ...
    if (upgradeCount <= 4) return 0;
    return Math.floor((upgradeCount - 5) / 5) + 1;
}

function calculateMercenaryBaseDamage(mercenary) {
    let effectiveLevel = mercenary.damageLevel || 0;
    if (mercenary.id === 'legend') {
        effectiveLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0);
    }

    // 使用加法增长计算伤害 (原版机制)
    const baseAtk = mercenary.damage;
    const scale = baseAtk / 4;  // 缩放系数，使得第一级增加值 = floor(baseAtk / 2)
    let damage = baseAtk;

    // 计算每次升级增加的攻击力
    for (let upgrade = 1; upgrade <= effectiveLevel; upgrade++) {
        const resultLevel = upgrade + 1;  // 升级后的等级
        const tier = getUpgradeTier(upgrade);

        // 查表获取基础增加值，超出范围则按1.5倍增长
        let baseAdd = tier < ADD_VALUE_TABLE.length
            ? ADD_VALUE_TABLE[tier]
            : Math.floor(ADD_VALUE_TABLE[12] * Math.pow(1.5, tier - 12));

        // 根据佣兵基础攻击力缩放
        let addValue = Math.floor(baseAdd * scale);

        // 51级及以后：增加值翻倍
        if (resultLevel >= 51) addValue *= 2;
        // 101级及以后：增加值再翻倍
        if (resultLevel >= 101) addValue *= 2;

        damage += Math.max(1, addValue);
    }

    // 战士等自带的堆叠Buff (属于该佣兵个体的成长)
    if (mercenary._stackingBuff) {
        damage *= (1 + mercenary._stackingBuff);
    }

    // 骑士「重装」技能的额外攻击力加成
    if (mercenary._knightHeavyBonus) {
        damage += mercenary._knightHeavyBonus;
    }

    // 士兵「经验」技能的攻击力加成
    if (mercenary._experienceBonus) {
        damage += mercenary._experienceBonus;
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
    // [传说] 核心：如果是传说，攻速算法中的"等级"参数 = (攻速等级 + 攻击等级)
    let effectiveLevel = mercenary.intervalLevel || 0;
    if (mercenary.id === 'legend') {
        effectiveLevel = (mercenary.intervalLevel || 0) + (mercenary.damageLevel || 0);
    }

    // 每级减少1%，即乘以0.99
    let interval = mercenary.attackInterval * Math.pow(0.99, effectiveLevel);

    // 应用里程碑奖励 (Lv 75, Lv 100)
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0);
    if (totalLevel >= 75) interval *= 0.8;
    if (totalLevel >= 100) interval *= 0.8;

    // 应用圣物全局攻速加成 (如果有)
    if (mercenary._prestigeSpeedBuff) {
        interval *= (1 - mercenary._prestigeSpeedBuff);
    }

    // 混沌帝王：应用混沌法则的攻击间隔惩罚
    if (mercenary._chaosIntervalPenalty) {
        interval += mercenary._chaosIntervalPenalty;
    }

    // 最低间隔限制为0.1秒
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
 *
 * 参考《打BOSS》原版规律：
 * - 首次升级价格 = 雇佣价格 / 2
 * - 升级价格增长率 = 1.15 (每级是上一级的1.15倍)
 * - 特殊：默认雇佣单位(baseCost=0)，首次升级价格 = 15
 */
function calculateMercenaryUpgradeCost(mercenary, costReduction = 1) {
    // 统一等级 = 攻击等级 + 间隔等级
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;

    // 首次升级价格 = 雇佣价格 / 2，默认雇佣单位特殊处理
    const baseUpgradeCost = mercenary.baseCost > 0 ? mercenary.baseCost / 2 : 15;

    // 每级增长1.15倍
    const growthRate = 1.15;
    let cost = Math.floor(baseUpgradeCost * Math.pow(growthRate, totalLevel));

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

    // 直接修改原对象的血量，避免竞态条件
    // (多个伤害来源同时操作时，替换对象会导致伤害丢失)
    boss.currentHp = Math.max(0, boss.currentHp - damage);
    const defeated = boss.currentHp === 0;

    return {
        boss: boss,  // 返回同一个对象引用
        defeated,
        goldEarned: Math.floor(damage * prestigeGoldMult)
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
 * @param {number} currentBossHp - 当前Boss剩余血量
 * @returns {Object} - 离线收益信息
 */
function calculateOfflineProgress(dps, offlineSeconds, bossLevel, currentBossHp) {
    // 限制离线时间最多8小时
    const maxOfflineTime = 8 * 60 * 60;
    const actualOfflineTime = Math.min(offlineSeconds, maxOfflineTime);

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

    // 第一个Boss使用当前剩余血量（而不是满血）
    let firstBossHp = currentBossHp;

    while (tempDamage > 0 && bossesDefeated < 100) {
        // 第一个Boss使用传入的剩余血量，后续Boss使用满血量
        const bossHp = (bossesDefeated === 0) ? firstBossHp : calculateBossMaxHp(currentLevel);

        if (tempDamage >= bossHp) {
            tempDamage -= bossHp;
            bossesDefeated++;
            currentLevel++;
        } else {
            break;
        }
    }

    // tempDamage 是剩余的伤害，用于扣除当前 Boss 的血量
    return {
        gold: totalGold,
        bossesDefeated,
        newLevel: currentLevel,
        remainingDamage: tempDamage,  // 剩余伤害，用于扣除当前 Boss 血量
        timeProcessed: actualOfflineTime
    };
}

// 引入技能库
const skillSystem = require('../data/skills.js');

/**
 * 获取佣兵技能信息（使用技能库）
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - 技能配置或null
 */
function getMercenarySkill(mercenary) {
    return skillSystem.getUnitSkill(mercenary);
}

/**
 * 获取佣兵技能显示信息（使用技能库）
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - UI显示用的技能信息
 */
function getMercenarySkillDisplay(mercenary) {
    return skillSystem.getUnitSkillDisplay(mercenary);
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
