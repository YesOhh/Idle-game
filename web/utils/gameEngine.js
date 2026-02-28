// utils/gameEngine.js - 核心游戏引擎 (ES Module version)
import { BOSS_DATA } from '../data/bosses.js';
import { getUnitSkill, getUnitSkillDisplay } from '../data/skills.js';

export function formatNumber(num) {
    if (num < 1) return parseFloat(num.toFixed(2)).toString();
    return Math.floor(num).toLocaleString('en-US');
}

export function calculateBossMaxHp(level) {
    return Math.floor(30000 * Math.pow(135, level - 1));
}

const ADD_VALUE_TABLE = [2, 3, 4, 6, 9, 13, 19, 28, 42, 63, 95, 142, 212];

function getUpgradeTier(upgradeCount) {
    if (upgradeCount <= 4) return 0;
    return Math.floor((upgradeCount - 5) / 5) + 1;
}

// 计算纯升级伤害（不含任何加成和里程碑）
export function calculateRawUpgradeDamage(mercenary) {
    let effectiveLevel = mercenary.damageLevel || 0;
    if (mercenary.id === 'legend') {
        effectiveLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0);
    }
    const baseAtk = mercenary.damage;
    const scale = baseAtk / 4;
    let damage = baseAtk;
    for (let upgrade = 1; upgrade <= effectiveLevel; upgrade++) {
        const tier = getUpgradeTier(upgrade);
        let baseAdd = tier < ADD_VALUE_TABLE.length ? ADD_VALUE_TABLE[tier] : Math.floor(ADD_VALUE_TABLE[12] * Math.pow(1.5, tier - 12));
        let addValue = Math.floor(baseAdd * scale);
        damage += Math.max(1, addValue);
    }
    return damage;
}

export function calculateMercenaryBaseDamage(mercenary) {
    let damage = calculateRawUpgradeDamage(mercenary);
    // 里程碑奖励（一次性翻倍，存储在 _milestoneDamageBonus 中）
    if (mercenary._milestoneDamageBonus) damage += mercenary._milestoneDamageBonus;
    if (mercenary._stackingBuff) damage *= (1 + mercenary._stackingBuff);
    if (mercenary._knightHeavyBonus) damage += mercenary._knightHeavyBonus;
    if (mercenary._experienceBonus) damage += mercenary._experienceBonus;
    return Math.floor(damage);
}

// 里程碑攻击力检查：跨越50/100级时一次性翻倍当前攻击力
export function applyMilestoneDamageCheck(merc, oldDisplayLevel, newDisplayLevel) {
    if (oldDisplayLevel < 50 && newDisplayLevel >= 50) {
        const rawDmg = calculateRawUpgradeDamage(merc);
        const existing = merc._milestoneDamageBonus || 0;
        merc._milestoneDamageBonus = rawDmg + 2 * existing;
    }
    if (oldDisplayLevel < 100 && newDisplayLevel >= 100) {
        const rawDmg = calculateRawUpgradeDamage(merc);
        const existing = merc._milestoneDamageBonus || 0;
        merc._milestoneDamageBonus = rawDmg + 2 * existing;
    }
}

// 旧存档迁移：补算里程碑奖励
export function migrateMilestoneDamageBonus(mercenaries) {
    if (!mercenaries) return;
    mercenaries.forEach(merc => {
        if (merc._milestoneDamageBonus === undefined || merc._milestoneDamageBonus === null) {
            const displayLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
            const rawDmg = calculateRawUpgradeDamage(merc);
            if (displayLevel >= 100) {
                merc._milestoneDamageBonus = 3 * rawDmg;
            } else if (displayLevel >= 50) {
                merc._milestoneDamageBonus = rawDmg;
            }
        }
    });
}

export function calculateUpgradedDamage(mercenary, prestigeDamageMult = 1) {
    let baseDamage = calculateMercenaryBaseDamage(mercenary);
    if (mercenary._teachingBonus) baseDamage += mercenary._teachingBonus;
    return Math.floor(baseDamage * prestigeDamageMult);
}

export function getDamageDisplayInfo(mercenary, prestigeDamageMult = 1) {
    let base = calculateMercenaryBaseDamage(mercenary);
    if (mercenary._teachingBonus) base += mercenary._teachingBonus;
    const final = Math.floor(base * prestigeDamageMult);
    const bonus = final - Math.floor(base);
    return { base: Math.floor(base), bonus, final, text: bonus > 0 ? `${formatNumber(Math.floor(base))} (+${formatNumber(bonus)})` : `${formatNumber(Math.floor(base))}` };
}

export function calculateUpgradedInterval(mercenary) {
    let effectiveLevel = mercenary.intervalLevel || 0;
    if (mercenary.id === 'legend') {
        effectiveLevel = (mercenary.intervalLevel || 0) + (mercenary.damageLevel || 0);
    }
    let interval = mercenary.attackInterval * Math.pow(0.99, effectiveLevel);
    // 里程碑：显示等级 = damageLevel + intervalLevel + 1
    const displayLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;
    if (displayLevel >= 75) interval *= 0.8;
    if (displayLevel >= 100) interval *= 0.8;
    if (mercenary._prestigeSpeedBuff) interval *= (1 - mercenary._prestigeSpeedBuff);
    if (mercenary._chaosIntervalPenalty) interval += mercenary._chaosIntervalPenalty;
    return Math.max(0.1, Number(interval.toFixed(4)));
}

export function calculatePrestigeBonus(player) {
    if (!player) return { damage: 1, gold: 1, costReduction: 1, speed: 0, critChance: 0, critMult: 0 };
    let damageMult = 1, goldMult = 1, costReduction = 1, speedBuff = 0, critChance = 0, critMult = 0;
    if (player.relics && player.relics.length > 0) {
        player.relics.forEach(relic => {
            const level = relic.level || 1;
            const totalVal = relic.val * level;
            if (relic.type === 'damage') damageMult += totalVal;
            if (relic.type === 'gold') goldMult += totalVal;
            if (relic.type === 'cost') { for (let i = 0; i < level; i++) costReduction *= (1 - relic.val); }
            if (relic.type === 'speed') speedBuff += totalVal;
            if (relic.type === 'crit_chance') critChance += totalVal;
            if (relic.type === 'crit_mult') critMult += totalVal;
        });
    }
    return { damage: damageMult, gold: goldMult, costReduction, speed: speedBuff, critChance, critMult };
}

export function calculateMercenaryUpgradeCost(mercenary, costReduction = 1) {
    const totalLevel = mercenary.damageLevel + mercenary.intervalLevel;
    const baseUpgradeCost = mercenary.baseCost > 0 ? mercenary.baseCost / 2 : 15;
    let cost = Math.floor(baseUpgradeCost * Math.pow(1.15, totalLevel));
    return Math.floor(cost * costReduction);
}

export function calculateRecruitCost(mercenary) {
    return mercenary.baseCost;
}

export function dealDamageToBoss(boss, damage, prestigeGoldMult = 1) {
    if (boss.currentHp <= 0) return { boss, defeated: false, goldEarned: 0 };
    boss.currentHp = Math.max(0, boss.currentHp - damage);
    return { boss, defeated: boss.currentHp === 0, goldEarned: Math.floor(damage * prestigeGoldMult) };
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
    // Per-merc: floor(offlineTime / interval) * damage, no skills
    let totalDamage = 0;
    mercenaries.forEach(merc => {
        if (!merc.recruited) return;
        const interval = calculateUpgradedInterval(merc);
        const damage = calculateUpgradedDamage(merc, prestigeBonus.damage);
        const hits = Math.floor(actualOfflineTime / interval);
        totalDamage += hits * damage;
    });
    // Simulate boss kills
    let bossesDefeated = 0, currentLevel = bossLevel, tempDamage = totalDamage, firstBossHp = currentBossHp;
    while (tempDamage > 0 && currentLevel <= 12) {
        const bossHp = (bossesDefeated === 0) ? firstBossHp : calculateBossMaxHp(currentLevel);
        if (tempDamage >= bossHp) { tempDamage -= bossHp; bossesDefeated++; if (currentLevel < 12) currentLevel++; else break; } else break;
    }
    const goldEarned = Math.floor(totalDamage * prestigeBonus.gold);
    return { totalDamage, gold: goldEarned, bossesDefeated, newLevel: currentLevel, remainingDamage: tempDamage, timeProcessed: actualOfflineTime };
}

export function getMercenarySkill(mercenary) {
    return getUnitSkill(mercenary);
}

export function getMercenarySkillDisplay(mercenary) {
    return getUnitSkillDisplay(mercenary);
}

export const RELIC_POOL = [
    { id: 'relic_dmg_low', name: '士兵的磨刀石', type: 'damage', val: 0.10, desc: '伤害 +10%', icon: '🪵' },
    { id: 'relic_gold_low', name: '褪色的铜币', type: 'gold', val: 0.10, desc: '金币收益 +10%', icon: '🪙' },
    { id: 'relic_speed_1', name: '机械发条', type: 'speed', val: 0.05, desc: '攻击速度 +5%', icon: '⚙️' },
    { id: 'relic_cost_low', name: '战术速记本', type: 'cost', val: 0.05, desc: '升级成本 -5%', icon: '📖' },
    { id: 'relic_crit_c_1', name: '鹰眼瞄具', type: 'crit_chance', val: 0.02, desc: '暴击率 +2%', icon: '🎯' },
    { id: 'relic_crit_m_1', name: '锋利刀刃', type: 'crit_mult', val: 0.20, desc: '暴击伤害 +20%', icon: '🔪' },
    { id: 'relic_dmg_mid', name: '勇士之证', type: 'damage', val: 0.30, desc: '伤害 +30%', icon: '🏅' },
    { id: 'relic_gold_mid', name: '商人的契约', type: 'gold', val: 0.30, desc: '金币收益 +30%', icon: '📜' }
];

export function getRandomRelicChoices() {
    const shuffled = [...RELIC_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}
