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

    // 2. 应用周目/圣物全局加成
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

    // 皇家侍卫技能：【皇家守护】(Lv 25解锁)
    // 攻击时小概率使全队攻击力提升
    if (mercenary.id === 'royal_guard' && totalLevel >= 25) {
        const buffVal = 0.05 + Math.floor((totalLevel - 25) / 15) * 0.02;
        return {
            type: 'team_damage_buff',
            name: '皇家守护',
            chance: 0.08,
            val: buffVal,
            duration: 5000,
            desc: `8%几率使全队伤害提升${(buffVal * 100).toFixed(0)}% (持续5秒)`
        };
    }

    // 钢铁士兵技能：【钢铁神拳】(Lv 20解锁)
    // 攻击时有概率造成钢铁系佣兵攻击力总和的额外伤害
    if (mercenary.id === 'iron_soldier' && totalLevel >= 20) {
        const multiplier = 0.4 + Math.floor((totalLevel - 20) / 10) * 0.15;
        return {
            type: 'iron_fist',
            name: '钢铁神拳',
            chance: 0.10,
            multiplier: multiplier,
            desc: `10%几率造成钢铁系总攻击力${(multiplier * 100).toFixed(0)}%的额外伤害`
        };
    }

    // 狂战士技能：【狂暴】(Lv 35解锁)
    // Boss血量越低，伤害越高
    if (mercenary.id === 'berserker' && totalLevel >= 35) {
        const maxBonus = 1.0 + Math.floor((totalLevel - 35) / 10) * 0.3;
        return {
            type: 'low_hp_bonus',
            name: '狂暴',
            maxBonus: maxBonus,
            desc: `Boss血量越低伤害越高，最高+${(maxBonus * 100).toFixed(0)}%`
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

    // 冰之女儿技能：【冰霜冻结】(Lv 25解锁)
    // 攻击时有概率冻结Boss，使其受到的伤害增加
    if (mercenary.id === 'ice_daughter' && totalLevel >= 25) {
        const debuffVal = 0.15 + Math.floor((totalLevel - 25) / 10) * 0.05;
        return {
            type: 'boss_debuff',
            name: '冰霜冻结',
            chance: 0.12,
            val: debuffVal,
            duration: 4000,
            desc: `12%几率使Boss受到伤害+${(debuffVal * 100).toFixed(0)}% (持续4秒)`
        };
    }

    // 夜剑客技能：【暗影突袭】(Lv 20解锁)
    // 极高暴击率，但暴击倍率较低
    if (mercenary.id === 'night_swordsman' && totalLevel >= 20) {
        const critChance = Math.min(0.60, 0.35 + Math.floor((totalLevel - 20) / 10) * 0.05);
        const critMult = 2.0 + Math.floor((totalLevel - 20) / 15) * 0.3;
        return {
            type: 'crit',
            name: '暗影突袭',
            chance: critChance,
            multiplier: critMult,
            desc: `${(critChance * 100).toFixed(0)}%几率造成${critMult.toFixed(1)}倍伤害`
        };
    }

    // 亡灵法师技能：【亡灵召唤】(Lv 30解锁)
    // 每次攻击召唤小骷髅造成额外伤害
    if (mercenary.id === 'necromancer' && totalLevel >= 30) {
        const skeletonCount = Math.min(5, 1 + Math.floor((totalLevel - 30) / 20));
        const skeletonDmg = 0.10 + Math.floor((totalLevel - 30) / 10) * 0.03;
        return {
            type: 'summon',
            name: '亡灵召唤',
            count: skeletonCount,
            damageRatio: skeletonDmg,
            desc: `召唤${skeletonCount}个骷髅，各造成${(skeletonDmg * 100).toFixed(0)}%伤害`
        };
    }

    // 圣职者技能：【神圣祝福】(Lv 25解锁)
    // 持续为全队提供伤害加成光环
    if (mercenary.id === 'priest' && totalLevel >= 25) {
        const auraVal = 0.08 + Math.floor((totalLevel - 25) / 10) * 0.03;
        return {
            type: 'damage_aura',
            name: '神圣祝福',
            val: auraVal,
            desc: `为全队提供${(auraVal * 100).toFixed(0)}%永久伤害加成`
        };
    }

    // 龙骑士技能：【龙魂觉醒】(Lv 40解锁)
    // 每次攻击积累龙魂能量，满层时释放毁灭龙息
    if (mercenary.id === 'dragon' && totalLevel >= 40) {
        const maxStacks = 10; // 需要10次攻击积满
        const burstMultiplier = 50 + Math.floor((totalLevel - 40) / 10) * 15; // 50倍起，每10级+15倍
        const burnDamage = 0.05 + Math.floor((totalLevel - 40) / 15) * 0.02; // 灼烧：5%攻击力/秒
        return {
            type: 'dragon_soul',
            name: '龙魂觉醒',
            maxStacks: maxStacks,
            burstMultiplier: burstMultiplier,
            burnDamage: burnDamage,
            burnDuration: 5000, // 灼烧持续5秒
            desc: `每${maxStacks}次攻击释放龙息，造成${burstMultiplier}倍伤害并灼烧5秒(${(burnDamage * 100).toFixed(0)}%/秒)`
        };
    }

    // 天使技能：【圣洁之力】(Lv 30解锁)
    // 攻击时有概率触发圣洁净化，造成Boss最大血量百分比伤害
    if (mercenary.id === 'angel' && totalLevel >= 30) {
        const percentDmg = 0.001 + Math.floor((totalLevel - 30) / 20) * 0.0005;
        return {
            type: 'percent_damage',
            name: '圣洁之力',
            chance: 0.08,
            percentVal: percentDmg,
            desc: `8%几率造成Boss最大血量${(percentDmg * 100).toFixed(2)}%的伤害`
        };
    }

    // 时光行者技能：【时间静止】(Lv 35解锁)
    // 有概率使全队下次攻击伤害翻倍
    if (mercenary.id === 'time_walker' && totalLevel >= 35) {
        const multiplier = 2.0 + Math.floor((totalLevel - 35) / 10) * 0.5;
        return {
            type: 'next_attack_boost',
            name: '时间静止',
            chance: 0.06,
            multiplier: multiplier,
            desc: `6%几率使全队下次攻击伤害x${multiplier.toFixed(1)}`
        };
    }

    // 虚空领主技能：【虚空侵蚀】(Lv 40解锁)
    // 每次攻击造成Boss当前血量百分比伤害
    if (mercenary.id === 'void_lord' && totalLevel >= 40) {
        const percentDmg = 0.0005 + Math.floor((totalLevel - 40) / 15) * 0.0002;
        return {
            type: 'current_hp_damage',
            name: '虚空侵蚀',
            percentVal: percentDmg,
            desc: `每次攻击额外造成Boss当前血量${(percentDmg * 100).toFixed(3)}%的伤害`
        };
    }

    // 不死鸟技能：【浴火重生】(Lv 35解锁)
    // 战斗中每60秒自动触发一次爆发伤害
    if (mercenary.id === 'phoenix' && totalLevel >= 35) {
        const burstMult = 50 + Math.floor((totalLevel - 35) / 10) * 20;
        return {
            type: 'periodic_burst',
            name: '浴火重生',
            interval: 60000, // 60秒
            multiplier: burstMult,
            desc: `每60秒自动造成${burstMult}倍伤害`
        };
    }

    // 混沌帝王技能：【混沌法则】(Lv 45解锁)
    // 攻击间隔越长，伤害倍率越高
    if (mercenary.id === 'chaos_emperor' && totalLevel >= 45) {
        const baseMult = 1.5 + Math.floor((totalLevel - 45) / 10) * 0.3;
        return {
            type: 'slow_power',
            name: '混沌法则',
            baseMultiplier: baseMult,
            desc: `攻击间隔每1秒，伤害+${(baseMult * 100).toFixed(0)}%`
        };
    }

    // 神圣巨龙技能：【万物终结】(Lv 50解锁)
    // 集合所有技能效果的终极技能
    if (mercenary.id === 'sacred_dragon' && totalLevel >= 50) {
        const allBonus = 0.15 + Math.floor((totalLevel - 50) / 10) * 0.05;
        return {
            type: 'ultimate',
            name: '万物终结',
            teamDamageBonus: allBonus,
            teamSpeedBonus: allBonus * 0.5,
            critChance: 0.25,
            critMult: 5.0,
            desc: `全队伤害+${(allBonus * 100).toFixed(0)}%，攻速+${(allBonus * 50).toFixed(0)}%，25%暴击5倍伤害`
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

    // 战士 - 熟练
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

    // 弓箭手 - 爆裂
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

    // 皇家侍卫 - 皇家守护
    if (mercenary.id === 'royal_guard') {
        const unlockLv = 25;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '攻击时有几率增强全队伤害';
        if (isUnlocked) {
            const buffVal = 0.05 + Math.floor((totalLevel - 25) / 15) * 0.02;
            desc = `8%几率使全队伤害+${(buffVal * 100).toFixed(0)}% (5秒)`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【皇家守护】', isUnlocked, desc };
    }

    // 钢铁士兵 - 钢铁神拳
    if (mercenary.id === 'iron_soldier') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '攻击时有概率触发钢铁系总攻击力伤害';
        if (isUnlocked) {
            const mult = 0.4 + Math.floor((totalLevel - 20) / 10) * 0.15;
            desc = `10%几率造成钢铁系总攻击力${(mult * 100).toFixed(0)}%伤害`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【钢铁神拳】', isUnlocked, desc };
    }

    // 狂战士 - 狂暴
    if (mercenary.id === 'berserker') {
        const unlockLv = 35;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = 'Boss血量越低，伤害越高';
        if (isUnlocked) {
            const maxBonus = 1.0 + Math.floor((totalLevel - 35) / 10) * 0.3;
            desc = `Boss血量越低伤害越高，最高+${(maxBonus * 100).toFixed(0)}%`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【狂暴】', isUnlocked, desc };
    }

    // 法师 - 奥术激涌
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

    // 冰之女儿 - 冰霜冻结
    if (mercenary.id === 'ice_daughter') {
        const unlockLv = 25;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '攻击时有概率冻结Boss增加其受到伤害';
        if (isUnlocked) {
            const debuffVal = 0.15 + Math.floor((totalLevel - 25) / 10) * 0.05;
            desc = `12%几率使Boss受伤+${(debuffVal * 100).toFixed(0)}% (4秒)`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【冰霜冻结】', isUnlocked, desc };
    }

    // 夜剑客 - 暗影突袭
    if (mercenary.id === 'night_swordsman') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '极高暴击率的暗影攻击';
        if (isUnlocked) {
            const critChance = Math.min(0.60, 0.35 + Math.floor((totalLevel - 20) / 10) * 0.05);
            const critMult = 2.0 + Math.floor((totalLevel - 20) / 15) * 0.3;
            desc = `${(critChance * 100).toFixed(0)}%几率造成${critMult.toFixed(1)}倍伤害`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【暗影突袭】', isUnlocked, desc };
    }

    // 亡灵法师 - 亡灵召唤
    if (mercenary.id === 'necromancer') {
        const unlockLv = 30;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '召唤骷髅军团协助攻击';
        if (isUnlocked) {
            const count = Math.min(5, 1 + Math.floor((totalLevel - 30) / 20));
            const dmg = 0.10 + Math.floor((totalLevel - 30) / 10) * 0.03;
            desc = `召唤${count}个骷髅，各造成${(dmg * 100).toFixed(0)}%伤害`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【亡灵召唤】', isUnlocked, desc };
    }

    // 圣职者 - 神圣祝福
    if (mercenary.id === 'priest') {
        const unlockLv = 25;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '为全队提供永久伤害加成光环';
        if (isUnlocked) {
            const auraVal = 0.08 + Math.floor((totalLevel - 25) / 10) * 0.03;
            desc = `全队永久伤害+${(auraVal * 100).toFixed(0)}%`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【神圣祝福】', isUnlocked, desc };
    }

    // 龙骑士 - 龙魂觉醒
    if (mercenary.id === 'dragon') {
        const unlockLv = 40;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '积累龙魂能量释放毁灭龙息';
        if (isUnlocked) {
            const burstMult = 50 + Math.floor((totalLevel - unlockLv) / 10) * 15;
            const burnDmg = 0.05 + Math.floor((totalLevel - unlockLv) / 15) * 0.02;
            desc = `每10次攻击释放${burstMult}倍龙息+灼烧${(burnDmg * 100).toFixed(0)}%/秒`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return {
            name: '【龙魂觉醒】',
            isUnlocked,
            desc
        };
    }

    // 天使 - 圣洁之力
    if (mercenary.id === 'angel') {
        const unlockLv = 30;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '触发圣洁净化造成百分比伤害';
        if (isUnlocked) {
            const pct = 0.001 + Math.floor((totalLevel - 30) / 20) * 0.0005;
            desc = `8%几率造成Boss最大血量${(pct * 100).toFixed(2)}%伤害`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【圣洁之力】', isUnlocked, desc };
    }

    // 时光行者 - 时间静止
    if (mercenary.id === 'time_walker') {
        const unlockLv = 35;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '使全队下次攻击伤害翻倍';
        if (isUnlocked) {
            const mult = 2.0 + Math.floor((totalLevel - 35) / 10) * 0.5;
            desc = `6%几率使全队下次攻击伤害x${mult.toFixed(1)}`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【时间静止】', isUnlocked, desc };
    }

    // 虚空领主 - 虚空侵蚀
    if (mercenary.id === 'void_lord') {
        const unlockLv = 40;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '每次攻击造成Boss当前血量百分比伤害';
        if (isUnlocked) {
            const pct = 0.0005 + Math.floor((totalLevel - 40) / 15) * 0.0002;
            desc = `每次额外造成Boss当前血量${(pct * 100).toFixed(3)}%伤害`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【虚空侵蚀】', isUnlocked, desc };
    }

    // 不死鸟 - 浴火重生
    if (mercenary.id === 'phoenix') {
        const unlockLv = 35;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '周期性自动触发大量伤害';
        if (isUnlocked) {
            const mult = 50 + Math.floor((totalLevel - 35) / 10) * 20;
            desc = `每60秒自动造成${mult}倍伤害`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【浴火重生】', isUnlocked, desc };
    }

    // 传说 - 全能
    if (mercenary.id === 'legend') {
        const isUnlocked = mercenary.recruited;
        return {
            name: '【全能】',
            isUnlocked: !!isUnlocked,
            desc: isUnlocked ? '升级攻击力时攻击速度也会提升，反之亦然' : '（招募后解锁）'
        };
    }

    // 混沌帝王 - 混沌法则
    if (mercenary.id === 'chaos_emperor') {
        const unlockLv = 45;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '攻击间隔越长伤害越高';
        if (isUnlocked) {
            const mult = 1.5 + Math.floor((totalLevel - 45) / 10) * 0.3;
            desc = `攻击间隔每1秒，伤害+${(mult * 100).toFixed(0)}%`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【混沌法则】', isUnlocked, desc };
    }

    // 神圣巨龙 - 万物终结
    if (mercenary.id === 'sacred_dragon') {
        const unlockLv = 50;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '终极技能，集合所有效果';
        if (isUnlocked) {
            const bonus = 0.15 + Math.floor((totalLevel - 50) / 10) * 0.05;
            desc = `全队伤害+${(bonus * 100).toFixed(0)}%，攻速+${(bonus * 50).toFixed(0)}%，25%暴击5倍`;
        } else {
            desc = `（达到 Lv.${unlockLv} 解锁）`;
        }
        return { name: '【万物终结】', isUnlocked, desc };
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
