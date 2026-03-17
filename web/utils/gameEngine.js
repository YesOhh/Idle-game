// utils/gameEngine.js - 核心游戏引擎 (ES Module version)
import { BOSS_DATA } from '../data/bosses.js';
import { getUnitSkill, getSecondaryUnitSkill, getUnitSkillDisplay, getEvolvedUnitSkill, getEvolvedUnitSkillDisplay, getEvolvableSkills, DEFAULT_UNIT_SKILLS, SECONDARY_UNIT_SKILLS, SKILL_LIBRARY } from '../data/skills.js';

export const MIN_INTERVAL = 0.05;

// BigInt arithmetic helpers
export function toBigInt(val) {
    if (typeof val === 'bigint') return val;
    if (typeof val === 'number') return BigInt(Math.floor(val));
    if (typeof val === 'string') { try { return BigInt(val); } catch { return 0n; } }
    return 0n;
}

export function bigMul(val, multiplier) {
    if (typeof val !== 'bigint') val = toBigInt(val);
    if (multiplier === 1) return val;
    if (multiplier === 0) return 0n;
    const PRECISION = 1000000n;
    return val * BigInt(Math.round(multiplier * 1000000)) / PRECISION;
}

export function formatNumber(num) {
    if (typeof num === 'bigint') {
        if (num <= 0n) return '0';
        return num.toLocaleString('en-US');
    }
    if (num < 1) return parseFloat(num.toFixed(2)).toString();
    return Math.floor(num).toLocaleString('en-US');
}

export function calculateBossMaxHp(level) {
    return 30000n * (135n ** BigInt(level - 1));
}

const ADD_VALUE_TABLE = [2, 3, 4, 6, 9, 13, 19, 28, 42, 63, 95, 142, 212];

function getUpgradeTier(upgradeCount) {
    if (upgradeCount <= 4) return 0;
    return Math.floor((upgradeCount - 5) / 5) + 1;
}

// 查询佣兵是否拥有指定类型的技能（检查默认技能、副技能和进化技能）
function hasSkillType(mercenary, skillType) {
    const defaultSkillId = DEFAULT_UNIT_SKILLS[mercenary.id];
    const secondarySkillId = SECONDARY_UNIT_SKILLS[mercenary.id];
    const evolvedSkillId = mercenary.evolvedSkillId;
    const defaultDef = defaultSkillId ? SKILL_LIBRARY[defaultSkillId] : null;
    const secondaryDef = secondarySkillId ? SKILL_LIBRARY[secondarySkillId] : null;
    const evolvedDef = evolvedSkillId ? SKILL_LIBRARY[evolvedSkillId] : null;
    return (defaultDef && defaultDef.type === skillType) || (secondaryDef && secondaryDef.type === skillType) || (evolvedDef && evolvedDef.type === skillType);
}

// 统计佣兵拥有指定类型技能的数量（0/1/2/3）
function countSkillType(mercenary, skillType) {
    let count = 0;
    const defaultSkillId = DEFAULT_UNIT_SKILLS[mercenary.id];
    const secondarySkillId = SECONDARY_UNIT_SKILLS[mercenary.id];
    const evolvedSkillId = mercenary.evolvedSkillId;
    const defaultDef = defaultSkillId ? SKILL_LIBRARY[defaultSkillId] : null;
    const secondaryDef = secondarySkillId ? SKILL_LIBRARY[secondarySkillId] : null;
    const evolvedDef = evolvedSkillId ? SKILL_LIBRARY[evolvedSkillId] : null;
    if (defaultDef && defaultDef.type === skillType) count++;
    if (secondaryDef && secondaryDef.type === skillType) count++;
    if (evolvedDef && evolvedDef.type === skillType) count++;
    return count;
}

// 计算纯升级伤害（不含任何加成和里程碑）
export function calculateRawUpgradeDamage(mercenary) {
    let effectiveLevel = mercenary.damageLevel || 0;
    const dualCount = countSkillType(mercenary, 'legend_dual_growth');
    if (dualCount > 0) {
        effectiveLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) * dualCount;
    }
    const baseAtk = mercenary.damage;
    const scaleNumer = BigInt(baseAtk);
    const scaleDenom = 4n;
    const hasExtreme = hasSkillType(mercenary, 'extreme_focus');
    let damage = BigInt(baseAtk);
    let currentTier = -1;
    let baseAddBig = 0n;
    for (let upgrade = 1; upgrade <= effectiveLevel; upgrade++) {
        const newTier = getUpgradeTier(upgrade);
        if (newTier !== currentTier) {
            if (newTier < ADD_VALUE_TABLE.length) {
                baseAddBig = BigInt(ADD_VALUE_TABLE[newTier]);
            } else if (currentTier < ADD_VALUE_TABLE.length) {
                baseAddBig = BigInt(ADD_VALUE_TABLE[ADD_VALUE_TABLE.length - 1]);
                for (let t = ADD_VALUE_TABLE.length; t <= newTier; t++) baseAddBig = baseAddBig * 3n / 2n;
            } else {
                for (let t = currentTier + 1; t <= newTier; t++) baseAddBig = baseAddBig * 3n / 2n;
            }
            currentTier = newTier;
        }
        let addValue = baseAddBig * scaleNumer / scaleDenom;
        if (hasExtreme) addValue = addValue * 11n / 5n;
        damage += addValue > 0n ? addValue : 1n;
    }
    return damage;
}

export function calculateMercenaryBaseDamage(mercenary) {
    let damage = calculateRawUpgradeDamage(mercenary);
    // 里程碑奖励（一次性翻倍，存储在 _milestoneDamageBonus 中）
    if (mercenary._milestoneDamageBonus) damage += toBigInt(mercenary._milestoneDamageBonus);
    if (mercenary._knightHeavyBonus) damage += toBigInt(mercenary._knightHeavyBonus);
    if (mercenary._experienceBonus) damage += toBigInt(mercenary._experienceBonus);
    return damage;
}

// 里程碑攻击力检查：跨越50/100级时一次性翻倍当前攻击力（含传授加成）
export function applyMilestoneDamageCheck(merc, oldDisplayLevel, newDisplayLevel) {
    if (oldDisplayLevel < 50 && newDisplayLevel >= 50) {
        const rawDmg = calculateRawUpgradeDamage(merc);
        const existing = toBigInt(merc._milestoneDamageBonus || 0);
        const teachingBonus = toBigInt(merc._teachingBonus || 0);
        merc._milestoneDamageBonus = rawDmg + teachingBonus + 2n * existing;
    }
    if (oldDisplayLevel < 100 && newDisplayLevel >= 100) {
        const rawDmg = calculateRawUpgradeDamage(merc);
        const existing = toBigInt(merc._milestoneDamageBonus || 0);
        const teachingBonus = toBigInt(merc._teachingBonus || 0);
        merc._milestoneDamageBonus = rawDmg + teachingBonus + 2n * existing;
    }
}

// 旧存档迁移：补算里程碑奖励
export function migrateMilestoneDamageBonus(mercenaries) {
    if (!mercenaries) return;
    mercenaries.forEach(merc => {
        if (merc._milestoneDamageBonus === undefined || merc._milestoneDamageBonus === null) {
            const displayLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
            const rawDmg = calculateRawUpgradeDamage(merc);
            const teachingBonus = toBigInt(merc._teachingBonus || 0);
            if (displayLevel >= 100) {
                merc._milestoneDamageBonus = 3n * rawDmg + 3n * teachingBonus;
            } else if (displayLevel >= 50) {
                merc._milestoneDamageBonus = rawDmg + teachingBonus;
            }
        }
    });
}

export function calculateUpgradedDamage(mercenary, prestigeDamageMult = 1) {
    let baseDamage = calculateMercenaryBaseDamage(mercenary);
    if (mercenary._teachingBonus) baseDamage += toBigInt(mercenary._teachingBonus);
    // 熟练Buff：永久固定加成，每次触发时 += 当前攻击力×1%
    if (mercenary._stackingBuff) baseDamage += toBigInt(mercenary._stackingBuff);
    let result = bigMul(baseDamage, prestigeDamageMult);
    // 混沌法则：乘法叠加，每次触发 ×(1+atkBonus)
    if (mercenary._chaosAtkMult && mercenary._chaosAtkMult > 1) result = bigMul(result, mercenary._chaosAtkMult);
    return result;
}

export function getDamageDisplayInfo(mercenary, prestigeDamageMult = 1) {
    let base = calculateMercenaryBaseDamage(mercenary);
    if (mercenary._teachingBonus) base += toBigInt(mercenary._teachingBonus);
    if (mercenary._stackingBuff) base += toBigInt(mercenary._stackingBuff);
    let final = bigMul(base, prestigeDamageMult);
    // 混沌法则：乘法叠加
    if (mercenary._chaosAtkMult && mercenary._chaosAtkMult > 1) final = bigMul(final, mercenary._chaosAtkMult);
    const bonus = final - base;
    return { base, bonus, final, text: bonus > 0n ? `${formatNumber(base)} (+${formatNumber(bonus)})` : `${formatNumber(base)}` };
}

export function hasSkillOfType(mercenary, skillType) {
    return hasSkillType(mercenary, skillType);
}

export function calculateUpgradedInterval(mercenary) {
    let effectiveLevel = mercenary.intervalLevel || 0;
    const dualCount = countSkillType(mercenary, 'legend_dual_growth');
    if (dualCount > 0) {
        effectiveLevel = (mercenary.intervalLevel || 0) + (mercenary.damageLevel || 0) * dualCount;
    }
    let interval = mercenary.attackInterval * Math.pow(0.99, effectiveLevel);
    // 里程碑：显示等级 = damageLevel + intervalLevel + 1
    const displayLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;
    if (displayLevel >= 75) interval /= 1.2;
    if (displayLevel >= 100) interval /= 1.2;
    if (mercenary._prestigeSpeedBuff) interval /= (1 + mercenary._prestigeSpeedBuff);
    if (mercenary._chaosIntervalPenalty) interval += mercenary._chaosIntervalPenalty;
    // 「极」技能：每级攻击力升级降低0.5%攻速
    if (hasSkillType(mercenary, 'extreme_focus')) {
        const dmgLvl = mercenary.damageLevel || 0;
        if (dmgLvl > 0) interval *= Math.pow(1.005, dmgLvl);
    }
    return Math.max(MIN_INTERVAL, Number(interval.toFixed(4)));
}

export function calculatePrestigeBonus(player) {
    if (!player) return { damage: 1, gold: 1, costReduction: 1, speed: 0, catDamage: {}, catSpeed: {} };
    let damageMult = 1, goldMult = 1, costReduction = 1, speedBuff = 0;
    const catDamage = {}; // { basic: 0.10, iron: 0.10, ... }
    const catSpeed = {};  // { basic: 0.08, magic: 0.08, ... }
    if (player.relics && player.relics.length > 0) {
        player.relics.forEach(relic => {
            const level = relic.level || 1;
            const totalVal = relic.val * level;
            if (relic.type === 'damage') damageMult += totalVal;
            if (relic.type === 'gold') goldMult += totalVal;
            if (relic.type === 'cost') { for (let i = 0; i < level; i++) costReduction *= (1 - relic.val); }
            if (relic.type === 'speed') speedBuff += totalVal;
            if (relic.type === 'cat_damage' && relic.category) {
                catDamage[relic.category] = (catDamage[relic.category] || 0) + totalVal;
            }
            if (relic.type === 'cat_speed' && relic.category) {
                catSpeed[relic.category] = (catSpeed[relic.category] || 0) + totalVal;
            }
        });
    }
    return { damage: damageMult, gold: goldMult, costReduction, speed: speedBuff, catDamage, catSpeed };
}

export function calculateMercenaryUpgradeCost(mercenary, costReduction = 1) {
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;
    const baseUpgradeCost = mercenary.baseCost > 0 ? mercenary.baseCost / 2 : 15;
    let cost = baseUpgradeCost * Math.pow(1.15, totalLevel);
    cost = Math.floor(cost * costReduction);
    return isFinite(cost) ? toBigInt(cost) : toBigInt(Number.MAX_SAFE_INTEGER);
}

export function calculateRecruitCost(mercenary) {
    return toBigInt(mercenary.baseCost);
}

export function dealDamageToBoss(boss, damage, prestigeGoldMult = 1) {
    if (boss.currentHp <= 0n) return { boss, defeated: false, goldEarned: 0n };
    const dmg = toBigInt(damage);
    boss.currentHp = boss.currentHp - dmg;
    if (boss.currentHp < 0n) boss.currentHp = 0n;
    return { boss, defeated: boss.currentHp === 0n, goldEarned: bigMul(dmg, prestigeGoldMult) };
}

export function nextBoss(currentLevel) {
    const newLevel = Math.min(12, currentLevel + 1);
    const maxHp = calculateBossMaxHp(newLevel);
    const bossInfo = BOSS_DATA[newLevel - 1];
    return { level: newLevel, currentHp: maxHp, maxHp, name: bossInfo.name, icon: bossInfo.icon, desc: bossInfo.desc, isMaxLevel: newLevel === 12 };
}

export function calculateOfflineProgress(mercenaries, offlineSeconds, bossLevel, currentBossHp, prestigeBonus) {
    const maxOfflineTime = 8 * 60 * 60;
    const actualOfflineTime = Math.min(offlineSeconds, maxOfflineTime);
    let totalDamage = 0n;
    mercenaries.forEach(merc => {
        if (!merc.recruited) return;
        const interval = calculateUpgradedInterval(merc);
        let damage = calculateUpgradedDamage(merc, prestigeBonus.damage);
        if (merc.category && prestigeBonus.catDamage && prestigeBonus.catDamage[merc.category]) {
            damage = bigMul(damage, 1 + prestigeBonus.catDamage[merc.category]);
        }
        let effectiveInterval = interval;
        if (merc.category && prestigeBonus.catSpeed && prestigeBonus.catSpeed[merc.category]) {
            effectiveInterval /= (1 + prestigeBonus.catSpeed[merc.category]);
        }
        effectiveInterval = Math.max(0.1, effectiveInterval);
        const hits = BigInt(Math.floor(actualOfflineTime / effectiveInterval));
        totalDamage += hits * damage;
    });
    let bossesDefeated = 0, currentLevel = bossLevel;
    let tempDamage = totalDamage;
    let firstBossHp = toBigInt(currentBossHp);
    while (tempDamage > 0n && currentLevel <= 12) {
        const bossHp = (bossesDefeated === 0) ? firstBossHp : calculateBossMaxHp(currentLevel);
        if (tempDamage >= bossHp) { tempDamage -= bossHp; bossesDefeated++; if (currentLevel < 12) currentLevel++; else break; } else break;
    }
    const goldEarned = bigMul(totalDamage, prestigeBonus.gold);
    return { totalDamage, gold: goldEarned, bossesDefeated, newLevel: currentLevel, remainingDamage: tempDamage, timeProcessed: actualOfflineTime };
}

export function getMercenarySkill(mercenary) {
    return getUnitSkill(mercenary);
}

export function getSecondaryMercSkill(mercenary) {
    return getSecondaryUnitSkill(mercenary);
}

// Returns the primary skill matching skill1 panel (no battle-time override)
export function getDisplaySkill(mercenary) {
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;
    const skillId = DEFAULT_UNIT_SKILLS[mercenary.id];
    if (!skillId) return null;
    const skillDef = SKILL_LIBRARY[skillId];
    if (!skillDef) return null;
    if (totalLevel < skillDef.baseUnlockLevel) return null;
    if (skillDef.type === 'sync_click_damage' && !mercenary.recruited) return null;
    const params = skillDef.getParams(totalLevel);
    return { ...params, id: skillDef.id, type: skillDef.type, name: skillDef.name, icon: skillDef.icon, desc: skillDef.getDescription(totalLevel) };
}

export function getMercenarySkillDisplay(mercenary) {
    return getUnitSkillDisplay(mercenary);
}

export function getEvolvedMercSkill(mercenary) {
    return getEvolvedUnitSkill(mercenary);
}

export function getEvolvedMercSkillDisplay(mercenary) {
    return getEvolvedUnitSkillDisplay(mercenary);
}

export function getEvolvableSkillsForMerc(mercId) {
    return getEvolvableSkills(mercId);
}

export const RELIC_POOL = [
    // 全局通用
    { id: 'relic_dmg_all', name: '士兵的磨刀石', type: 'damage', val: 0.05, desc: '全体伤害 +5%', icon: '🪵' },
    { id: 'relic_gold', name: '褪色的铜币', type: 'gold', val: 0.10, desc: '金币收益 +10%', icon: '🪙' },
    { id: 'relic_speed_all', name: '机械发条', type: 'speed', val: 0.05, desc: '全体攻速 +5%', icon: '⚙️' },
    { id: 'relic_cost', name: '战术速记本', type: 'cost', val: 0.05, desc: '升级成本 -5%', icon: '📖' },
    // 基础系
    { id: 'relic_basic_dmg', name: '新兵训练手册', type: 'cat_damage', category: 'basic', val: 0.10, desc: '基础系伤害 +10%', icon: '⭐' },
    { id: 'relic_basic_spd', name: '轻装行军靴', type: 'cat_speed', category: 'basic', val: 0.08, desc: '基础系攻速 +8%', icon: '👢' },
    // 钢铁系
    { id: 'relic_iron_dmg', name: '精钢锻锤', type: 'cat_damage', category: 'iron', val: 0.10, desc: '钢铁系伤害 +10%', icon: '🔨' },
    { id: 'relic_iron_spd', name: '蒸汽驱动核心', type: 'cat_speed', category: 'iron', val: 0.08, desc: '钢铁系攻速 +8%', icon: '🔧' },
    // 魔法系
    { id: 'relic_magic_dmg', name: '秘法水晶球', type: 'cat_damage', category: 'magic', val: 0.10, desc: '魔法系伤害 +10%', icon: '🔮' },
    { id: 'relic_magic_spd', name: '时间沙漏碎片', type: 'cat_speed', category: 'magic', val: 0.08, desc: '魔法系攻速 +8%', icon: '⏳' },
    // 圣洁系
    { id: 'relic_holy_dmg', name: '圣光祝福卷轴', type: 'cat_damage', category: 'holy', val: 0.10, desc: '圣洁系伤害 +10%', icon: '📿' },
    { id: 'relic_holy_spd', name: '天使之翼羽', type: 'cat_speed', category: 'holy', val: 0.08, desc: '圣洁系攻速 +8%', icon: '🪽' },
    // 远古系
    { id: 'relic_ancient_dmg', name: '远古符文石板', type: 'cat_damage', category: 'ancient', val: 0.10, desc: '远古系伤害 +10%', icon: '🗿' },
    { id: 'relic_ancient_spd', name: '虚空脉动宝珠', type: 'cat_speed', category: 'ancient', val: 0.08, desc: '远古系攻速 +8%', icon: '💎' },
    // 传说系
    { id: 'relic_legend_dmg', name: '龙王的遗宝', type: 'cat_damage', category: 'legend', val: 0.10, desc: '传说系伤害 +10%', icon: '👑' },
    { id: 'relic_legend_spd', name: '命运齿轮', type: 'cat_speed', category: 'legend', val: 0.08, desc: '传说系攻速 +8%', icon: '🌀' }
];

export function getRandomRelicChoices() {
    const shuffled = [...RELIC_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}
