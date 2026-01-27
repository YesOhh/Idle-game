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

    // 玩家技能：【长大】(雇佣即解锁)
    // 升级攻击力时同步升级点击伤害
    if (mercenary.id === 'player' && mercenary.recruited) {
        return {
            type: 'sync_click_damage',
            name: '长大',
            desc: '升级攻击力时，点击伤害也同步提升'
        };
    }

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

    // 狂战士技能：【狂暴】(Lv 35解锁) + 【连击】(Lv 50解锁)
    // Boss血量越低，伤害越高（阶梯式加成）
    // 连击：血量越低，越有几率再次攻击
    if (mercenary.id === 'berserker' && totalLevel >= 35) {
        // 基础加成随等级提升：35级100%，每10级+30%
        const baseBonus = 1.0 + Math.floor((totalLevel - 35) / 10) * 0.3;
        // 阶梯：血量<85%/60%/35%/10%时，获得25%/50%/75%/100%的最大加成
        const skill = {
            type: 'berserker_combo',
            name: '狂暴',
            maxBonus: baseBonus,
            thresholds: [
                { hpPercent: 0.85, bonusPercent: 0.25, comboChance: 0.15 },
                { hpPercent: 0.60, bonusPercent: 0.50, comboChance: 0.25 },
                { hpPercent: 0.35, bonusPercent: 0.75, comboChance: 0.35 },
                { hpPercent: 0.10, bonusPercent: 1.00, comboChance: 0.45 }
            ],
            desc: `Boss血量越低伤害越高，最高+${(baseBonus * 100).toFixed(0)}%`
        };
        // 50级解锁连击
        if (totalLevel >= 50) {
            skill.comboUnlocked = true;
        }
        return skill;
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
    // 概率造成Boss当前血量0.01%的伤害，伤害不受任何加成
    if (mercenary.id === 'angel' && totalLevel >= 30) {
        const chance = 0.08 + Math.floor((totalLevel - 30) / 20) * 0.02;
        return {
            type: 'pure_percent_damage',
            name: '圣洁之力',
            chance: chance,
            percentVal: 0.0001, // 0.01%
            ignoreBonus: true,
            desc: `${(chance * 100).toFixed(0)}%几率造成Boss当前血量0.01%伤害(不受加成)`
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
    // 概率造成全部单位攻击力总和的伤害
    if (mercenary.id === 'void_lord' && totalLevel >= 40) {
        const chance = 0.10 + Math.floor((totalLevel - 40) / 15) * 0.03;
        return {
            type: 'total_team_damage',
            name: '虚空侵蚀',
            chance: chance,
            desc: `${(chance * 100).toFixed(0)}%几率造成全队攻击力总和的伤害`
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
    // 每次攻击概率增加百分比攻击力，同时增加攻击间隔
    if (mercenary.id === 'chaos_emperor' && totalLevel >= 45) {
        const chance = 0.15 + Math.floor((totalLevel - 45) / 10) * 0.03;
        const atkBonus = 0.05 + Math.floor((totalLevel - 45) / 15) * 0.02;
        const intervalIncrease = 0.1; // 每次触发增加0.1秒攻击间隔
        return {
            type: 'chaos_stack',
            name: '混沌法则',
            chance: chance,
            atkBonus: atkBonus,
            intervalIncrease: intervalIncrease,
            desc: `${(chance * 100).toFixed(0)}%几率攻击力+${(atkBonus * 100).toFixed(0)}%，但攻击间隔+${intervalIncrease}秒`
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
    // 总等级 = 攻击等级 + 攻速等级 + 1（雇佣时初始等级为1）
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel + 1;

    // 玩家 - 长大 (雇佣即解锁)
    if (mercenary.id === 'player') {
        const isUnlocked = mercenary.recruited;
        const baseDesc = '升级攻击力时，点击伤害也同步提升';
        return {
            name: '【长大】',
            isUnlocked,
            desc: baseDesc,
            baseDesc,
            unlockCondition: '雇佣即解锁'
        };
    }

    // 战士 - 熟练
    if (mercenary.id === 'warrior') {
        const unlockLv = 30;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '每次攻击有几率永久提升攻击力';
        let desc = baseDesc;
        if (isUnlocked) {
            const extraChance = Math.floor((totalLevel - 30) / 10) * 0.01;
            const chance = 0.03 + extraChance;
            desc = `有${(chance * 100).toFixed(0)}%几率永久提升1%攻击力`;
        }

        return {
            name: '【熟练】',
            isUnlocked,
            desc,
            baseDesc,
            unlockCondition: `Lv.${unlockLv}解锁`
        };
    }

    // 弓箭手 - 爆裂
    if (mercenary.id === 'archer') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '攻击有几率造成多倍暴击伤害';
        let desc = baseDesc;
        if (isUnlocked) {
            const extraMult = Math.floor((totalLevel - 20) / 10) * 0.5;
            const multiplier = 3.0 + extraMult;
            desc = `20%几率造成${multiplier.toFixed(1)}倍伤害`;
        }

        return {
            name: '【爆裂】',
            isUnlocked,
            desc,
            baseDesc,
            unlockCondition: `Lv.${unlockLv}解锁`
        };
    }

    // 皇家侍卫 - 皇家守护
    if (mercenary.id === 'royal_guard') {
        const unlockLv = 25;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '攻击时有几率增强全队伤害';
        let desc = baseDesc;
        if (isUnlocked) {
            const buffVal = 0.05 + Math.floor((totalLevel - 25) / 15) * 0.02;
            desc = `8%几率使全队伤害+${(buffVal * 100).toFixed(0)}% (5秒)`;
        }
        return { name: '【皇家守护】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 钢铁士兵 - 钢铁神拳
    if (mercenary.id === 'iron_soldier') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '攻击时有概率触发钢铁系总攻击力伤害';
        let desc = baseDesc;
        if (isUnlocked) {
            const mult = 0.4 + Math.floor((totalLevel - 20) / 10) * 0.15;
            desc = `10%几率造成钢铁系总攻击力${(mult * 100).toFixed(0)}%伤害`;
        }
        return { name: '【钢铁神拳】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 狂战士 - 狂暴 + 连击
    if (mercenary.id === 'berserker') {
        const unlockLv1 = 35;
        const unlockLv2 = 50;
        const isUnlocked1 = totalLevel >= unlockLv1;
        const isUnlocked2 = totalLevel >= unlockLv2;
        
        // 狂暴技能描述
        let skill1Desc = 'Boss血量越低，伤害越高';
        if (isUnlocked1) {
            const maxBonus = 1.0 + Math.floor((totalLevel - 35) / 10) * 0.3;
            const b1 = (maxBonus * 0.25 * 100).toFixed(0);
            const b2 = (maxBonus * 0.50 * 100).toFixed(0);
            const b3 = (maxBonus * 0.75 * 100).toFixed(0);
            const b4 = (maxBonus * 1.00 * 100).toFixed(0);
            skill1Desc = `血量<85%/60%/35%/10%时，伤害+${b1}%/${b2}%/${b3}%/${b4}%`;
        }
        
        // 连击技能描述
        let skill2Desc = '血量越低，越有几率再次攻击';
        if (isUnlocked2) {
            skill2Desc = `血量<85%/60%/35%/10%时，15%/25%/35%/45%几率连击`;
        }
        
        return {
            name: '【狂暴】+【连击】',
            isUnlocked: isUnlocked1,
            desc: isUnlocked1 ? skill1Desc : skill1Desc,
            baseDesc: 'Boss血量越低，伤害越高',
            unlockCondition: `Lv.${unlockLv1}解锁`,
            // 第二个技能信息
            skill2: {
                name: '【连击】',
                isUnlocked: isUnlocked2,
                desc: skill2Desc,
                baseDesc: '血量越低，越有几率再次攻击',
                unlockCondition: `Lv.${unlockLv2}解锁`
            }
        };
    }

    // 法师 - 奥术激涌
    if (mercenary.id === 'mage') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '攻击时有几率使全体攻速提升';
        let desc = baseDesc;
        if (isUnlocked) {
            const bonusSpeed = 0.05 + Math.floor((totalLevel - unlockLv) / 10) * 0.05;
            desc = `5%几率使全体攻速提升${(bonusSpeed * 100).toFixed(0)}% (持续3秒)`;
        }
        return { name: '【奥术激涌】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 冰之女儿 - 冰霜冻结
    if (mercenary.id === 'ice_daughter') {
        const unlockLv = 25;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '攻击时有概率冻结Boss增加其受到伤害';
        let desc = baseDesc;
        if (isUnlocked) {
            const debuffVal = 0.15 + Math.floor((totalLevel - 25) / 10) * 0.05;
            desc = `12%几率使Boss受伤+${(debuffVal * 100).toFixed(0)}% (4秒)`;
        }
        return { name: '【冰霜冻结】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 夜剑客 - 暗影突袭
    if (mercenary.id === 'night_swordsman') {
        const unlockLv = 20;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '极高暴击率的暗影攻击';
        let desc = baseDesc;
        if (isUnlocked) {
            const critChance = Math.min(0.60, 0.35 + Math.floor((totalLevel - 20) / 10) * 0.05);
            const critMult = 2.0 + Math.floor((totalLevel - 20) / 15) * 0.3;
            desc = `${(critChance * 100).toFixed(0)}%几率造成${critMult.toFixed(1)}倍伤害`;
        }
        return { name: '【暗影突袭】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 亡灵法师 - 亡灵召唤
    if (mercenary.id === 'necromancer') {
        const unlockLv = 30;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '召唤骷髅军团协助攻击';
        let desc = baseDesc;
        if (isUnlocked) {
            const count = Math.min(5, 1 + Math.floor((totalLevel - 30) / 20));
            const dmg = 0.10 + Math.floor((totalLevel - 30) / 10) * 0.03;
            desc = `召唤${count}个骷髅，各造成${(dmg * 100).toFixed(0)}%伤害`;
        }
        return { name: '【亡灵召唤】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 圣职者 - 神圣祝福
    if (mercenary.id === 'priest') {
        const unlockLv = 25;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '为全队提供永久伤害加成光环';
        let desc = baseDesc;
        if (isUnlocked) {
            const auraVal = 0.08 + Math.floor((totalLevel - 25) / 10) * 0.03;
            desc = `全队永久伤害+${(auraVal * 100).toFixed(0)}%`;
        }
        return { name: '【神圣祝福】', isUnlocked, desc, baseDesc, unlockCondition: `Lv.${unlockLv}解锁` };
    }

    // 龙骑士 - 龙魂觉醒
    if (mercenary.id === 'dragon') {
        const unlockLv = 40;
        const isUnlocked = totalLevel >= unlockLv;
        const baseDesc = '积累龙魂能量释放毁灭龙息';
        let desc = baseDesc;
        if (isUnlocked) {
            const burstMult = 50 + Math.floor((totalLevel - unlockLv) / 10) * 15;
            const burnDmg = 0.05 + Math.floor((totalLevel - unlockLv) / 15) * 0.02;
            desc = `每10次攻击释放${burstMult}倍龙息+灼烧${(burnDmg * 100).toFixed(0)}%/秒`;
        }
        return {
            name: '【龙魂觉醒】',
            isUnlocked,
            desc,
            baseDesc,
            unlockCondition: `Lv.${unlockLv}解锁`
        };
    }

    // 天使 - 圣洁之力
    if (mercenary.id === 'angel') {
        const unlockLv = 30;
        const isUnlocked = totalLevel >= unlockLv;
        let desc = '概率造成Boss当前血量百分比伤害';
        if (isUnlocked) {
            const chance = 0.08 + Math.floor((totalLevel - 30) / 20) * 0.02;
            desc = `${(chance * 100).toFixed(0)}%几率造成Boss当前血量0.01%伤害(不受加成)`;
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
        let desc = '概率造成全队攻击力总和的伤害';
        if (isUnlocked) {
            const chance = 0.10 + Math.floor((totalLevel - 40) / 15) * 0.03;
            desc = `${(chance * 100).toFixed(0)}%几率造成全队攻击力总和的伤害`;
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
        let desc = '每次攻击概率增加攻击力，但也增加攻击间隔';
        if (isUnlocked) {
            const chance = 0.15 + Math.floor((totalLevel - 45) / 10) * 0.03;
            const atkBonus = 0.05 + Math.floor((totalLevel - 45) / 15) * 0.02;
            desc = `${(chance * 100).toFixed(0)}%几率攻击力+${(atkBonus * 100).toFixed(0)}%，攻击间隔+0.1秒`;
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
