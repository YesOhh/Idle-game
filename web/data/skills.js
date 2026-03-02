// data/skills.js - 技能库定义 (ES Module version)

export const SKILL_LIBRARY = {
    sync_click_damage: {
        id: 'sync_click_damage', name: '长大', type: 'sync_click_damage', icon: '📈',
        baseUnlockLevel: 0, baseDescription: '升级攻击力时，点击伤害也同步提升',
        getParams: (level) => ({}),
        getDescription: (level) => '升级攻击力时，点击伤害也同步提升'
    },
    stacking_buff: {
        id: 'stacking_buff', name: '熟练', type: 'stacking_buff', icon: '💪',
        baseUnlockLevel: 10, baseDescription: '每次攻击有几率永久提升攻击力',
        getParams: (level) => {
            const extraChance = Math.floor((level - 10) / 10) * 0.01;
            return { chance: 0.03 + Math.max(0, extraChance), val: 0.01 };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.stacking_buff.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率永久提升1%攻击力`;
        }
    },
    crit_burst: {
        id: 'crit_burst', name: '爆裂', type: 'crit', icon: '💥',
        baseUnlockLevel: 10, baseDescription: '攻击有几率造成多倍暴击伤害',
        getParams: (level) => {
            const extraMult = Math.floor((level - 20) / 10) * 0.5;
            return { chance: 0.20, multiplier: 3.0 + Math.max(0, extraMult) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.crit_burst.getParams(level);
            return `20%几率造成${params.multiplier.toFixed(1)}倍伤害`;
        }
    },
    shadow_crit: {
        id: 'shadow_crit', name: '暗影突袭', type: 'crit', icon: '🌑',
        baseUnlockLevel: 20, baseDescription: '极高暴击率的暗影攻击',
        getParams: (level) => {
            const critChance = Math.min(0.60, 0.35 + Math.floor((level - 20) / 10) * 0.05);
            const critMult = 2.0 + Math.floor((level - 20) / 15) * 0.3;
            return { chance: Math.max(0.35, critChance), multiplier: Math.max(2.0, critMult) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.shadow_crit.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率造成${params.multiplier.toFixed(1)}倍伤害`;
        }
    },
    team_damage_buff: {
        id: 'team_damage_buff', name: '传授', type: 'team_damage_buff', icon: '📚',
        baseUnlockLevel: 15, baseDescription: '每隆60秒，使其他所有单位永久增加本单位攻击力的1%',
        getParams: (level) => ({ interval: 60000, bonusRatio: 0.01 }),
        getDescription: (level) => '每60秒，使其他所有单位永久增加本单位攻击力的1%'
    },
    experience_growth: {
        id: 'experience_growth', name: '经验', type: 'experience_growth', icon: '🌟',
        baseUnlockLevel: 0, baseDescription: '每隆10秒，攻击力永久增加',
        getParams: (level) => ({ interval: 10000 }),
        getDescription: (level) => {
            const damageLevel = 0;
            const bonus = 1 + Math.floor(level * damageLevel / 30);
            return `每10秒，攻击力 +（1 + 等级×攻击力等级/30）`;
        }
    },
    iron_fist: {
        id: 'iron_fist', name: '钢铁神拳', type: 'iron_fist', icon: '🤜',
        baseUnlockLevel: 20, baseDescription: '攻击时有概率触发钢铁系总攻击力伤害',
        getParams: (level) => {
            const multiplier = 0.4 + Math.floor((level - 20) / 10) * 0.15;
            return { chance: 0.10, multiplier: Math.max(0.4, multiplier) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.iron_fist.getParams(level);
            return `10%几率造成钢铁系总攻击力${(params.multiplier * 100).toFixed(0)}%伤害`;
        }
    },
    berserker_combo: {
        id: 'berserker_combo', name: '狂暴', type: 'berserker_combo', icon: '🔥',
        baseUnlockLevel: 35, comboUnlockLevel: 50, baseDescription: 'Boss血量越低，伤害越高',
        getParams: (level) => {
            const baseBonus = 1.0 + Math.floor((level - 35) / 10) * 0.3;
            return {
                maxBonus: Math.max(1.0, baseBonus),
                thresholds: [
                    { hpPercent: 0.85, bonusPercent: 0.25, comboChance: 0.15 },
                    { hpPercent: 0.60, bonusPercent: 0.50, comboChance: 0.30 },
                    { hpPercent: 0.35, bonusPercent: 0.75, comboChance: 0.45 },
                    { hpPercent: 0.10, bonusPercent: 1.00, comboChance: 0.60 }
                ],
                comboUnlocked: level >= 50
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.berserker_combo.getParams(level);
            return `Boss血量越低伤害越高，最高+${(params.maxBonus * 100).toFixed(0)}%`;
        }
    },
    global_speed_buff: {
        id: 'global_speed_buff', name: '奥术激涌', type: 'global_speed_buff', icon: '⚡',
        baseUnlockLevel: 20, baseDescription: '攻击时有几率使全体攻速提升',
        getParams: (level) => {
            const bonusSpeed = 0.05 + Math.floor((level - 20) / 10) * 0.05;
            return { chance: 0.10, val: Math.max(0.05, bonusSpeed), duration: 5000 };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.global_speed_buff.getParams(level);
            return `10%几率使全体攻速提升${(params.val * 100).toFixed(0)}% (持续5秒)`;
        }
    },
    boss_debuff: {
        id: 'boss_debuff', name: '冰霜冻结', type: 'boss_debuff', icon: '❄️',
        baseUnlockLevel: 25, baseDescription: '攻击时有概率冻结Boss增加其受到伤害',
        getParams: (level) => {
            const debuffVal = 0.15 + Math.floor((level - 25) / 10) * 0.05;
            return { chance: 0.12, val: Math.max(0.15, debuffVal), duration: 4000 };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.boss_debuff.getParams(level);
            return `12%几率使Boss受伤+${(params.val * 100).toFixed(0)}% (4秒)`;
        }
    },
    soul_devour: {
        id: 'soul_devour', name: '噬魂', type: 'soul_devour', icon: '💀',
        baseUnlockLevel: 30, baseDescription: '通过战斗汲取灵魂，亡灵军团逐渐壮大',
        getParams: (level) => {
            const damageRatio = 0.08 + Math.floor((level - 30) / 10) * 0.015;
            const maxSouls = 15 + Math.floor((level - 30) / 20);
            return { chance: 0.15, damageRatio: Math.max(0.08, damageRatio), maxSouls: Math.max(15, maxSouls) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.soul_devour.getParams(level);
            return `每次攻击15%几率召唤亡灵(上限${params.maxSouls})，每个造成${(params.damageRatio * 100).toFixed(1)}%伤害`;
        }
    },
    damage_aura: {
        id: 'damage_aura', name: '神圣祝福', type: 'damage_aura', icon: '✨',
        baseUnlockLevel: 25, baseDescription: '为全队提供永久伤害加成光环',
        getParams: (level) => {
            const auraVal = 0.08 + Math.floor((level - 25) / 10) * 0.03;
            return { val: Math.max(0.08, auraVal) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.damage_aura.getParams(level);
            return `全队永久伤害+${(params.val * 100).toFixed(0)}%`;
        }
    },
    dragon_soul: {
        id: 'dragon_soul', name: '龙魂觉醒', type: 'dragon_soul', icon: '🐲',
        baseUnlockLevel: 40, baseDescription: '积累龙魂能量释放毁灭龙息',
        getParams: (level) => {
            const burstMultiplier = 5 + Math.floor((level - 40) / 10) * 1;
            const burnDamage = 0.05 + Math.floor((level - 40) / 15) * 0.02;
            return { maxStacks: 10, burstMultiplier: Math.max(5, burstMultiplier), burnDamage: Math.max(0.05, burnDamage), burnDuration: 5000 };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.dragon_soul.getParams(level);
            return `每10次攻击释放${params.burstMultiplier}倍龙息+灼烧${(params.burnDamage * 100).toFixed(0)}%/秒`;
        }
    },
    pure_percent_damage: {
        id: 'pure_percent_damage', name: '圣洁之力', type: 'pure_percent_damage', icon: '👼',
        baseUnlockLevel: 30, baseDescription: '概率造成Boss当前血量百分比伤害',
        getParams: (level) => {
            const chance = 0.08 + Math.floor((level - 30) / 20) * 0.02;
            return { chance: Math.max(0.08, chance), percentVal: 0.0001, ignoreBonus: true };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.pure_percent_damage.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率造成Boss血量0.01%伤害(上限:全队攻击力×等级/10)`;
        }
    },
    time_burst: {
        id: 'time_burst', name: '时空涟漪', type: 'time_burst', icon: '⏳',
        baseUnlockLevel: 35, baseDescription: '周期性释放时空连击',
        getParams: (level) => {
            const attackCount = 9 + Math.floor((level - 35) / 20);
            const damageMultiplier = 1.0 + Math.floor((level - 35) / 10) * 0.2;
            return { interval: 60000, attackCount: Math.min(12, attackCount), damageMultiplier: Math.max(1.0, damageMultiplier) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.time_burst.getParams(level);
            return `每60秒释放${params.attackCount}次时空攻击(${params.damageMultiplier.toFixed(1)}倍伤害)`;
        }
    },
    total_team_damage: {
        id: 'total_team_damage', name: '虚空侵蚀', type: 'total_team_damage', icon: '🌌',
        baseUnlockLevel: 40, baseDescription: '概率造成全队攻击力总和的伤害',
        getParams: (level) => {
            const chance = 0.10 + Math.floor((level - 40) / 15) * 0.03;
            return { chance: Math.max(0.10, chance) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.total_team_damage.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率造成全队攻击力总和的伤害`;
        }
    },
    periodic_burst: {
        id: 'periodic_burst', name: '浴火重生', type: 'periodic_burst', icon: '🔥',
        baseUnlockLevel: 35, baseDescription: '周期性自动触发大量伤害',
        getParams: (level) => {
            const burstMult = 8 + Math.floor((level - 35) / 10) * 2;
            return { interval: 60000, multiplier: Math.max(8, burstMult) };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.periodic_burst.getParams(level);
            return `每60秒自动造成${params.multiplier}倍伤害`;
        }
    },
    chaos_stack: {
        id: 'chaos_stack', name: '混沌法则', type: 'chaos_stack', icon: '🌀',
        baseUnlockLevel: 45, baseDescription: '每次攻击概率增加攻击力，但也增加攻击间隔',
        getParams: (level) => {
            const chance = 0.15 + Math.floor((level - 45) / 10) * 0.03;
            const atkBonus = 0.05 + Math.floor((level - 45) / 15) * 0.02;
            return { chance: Math.max(0.15, chance), atkBonus: Math.max(0.05, atkBonus), intervalIncrease: 0.1 };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.chaos_stack.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率攻击力+${(params.atkBonus * 100).toFixed(0)}%，攻击间隔+0.1秒`;
        }
    },
    ultimate: {
        id: 'ultimate', name: '万物终结', type: 'ultimate', icon: '✨',
        baseUnlockLevel: 50, baseDescription: '终极技能，集合所有效果',
        getParams: (level) => {
            const allBonus = 0.15 + Math.floor((level - 50) / 10) * 0.05;
            return { teamDamageBonus: Math.max(0.15, allBonus), teamSpeedBonus: Math.max(0.15, allBonus) * 0.5, critChance: 0.15, critMult: 5.0 };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.ultimate.getParams(level);
            return `全队伤害+${(params.teamDamageBonus * 100).toFixed(0)}%，攻速+${(params.teamSpeedBonus * 100).toFixed(0)}%，15%暴击5倍`;
        }
    },
    legend_dual_growth: {
        id: 'legend_dual_growth', name: '全能', type: 'legend_dual_growth', icon: '👑',
        baseUnlockLevel: 0, baseDescription: '升级攻击力时攻击速度也会提升，反之亦然',
        getParams: (level) => ({}),
        getDescription: (level) => '升级攻击力时攻击速度也会提升，反之亦然'
    },
    knight_heavy_armor: {
        id: 'knight_heavy_armor', name: '重装', type: 'knight_heavy_armor', icon: '🛡️',
        baseUnlockLevel: 0, baseDescription: '升级攻击力时额外增加攻击力',
        getParams: (level) => ({}),
        getDescription: (level) => '升级攻击力时额外增加（攻击力等级²×等级）点攻击力'
    },
    knight_fortify: {
        id: 'knight_fortify', name: '稳固', type: 'knight_fortify', icon: '🏰',
        baseUnlockLevel: 0, baseDescription: '每隔8秒，造成等同攻击力的伤害',
        getParams: (level) => ({ interval: 8000 }),
        getDescription: (level) => '每隔8秒，造成等同攻击力的额外伤害'
    },
    extreme_focus: {
        id: 'extreme_focus', name: '极', type: 'extreme_focus', icon: '⚡',
        baseUnlockLevel: 0, baseDescription: '升级攻击力时，提升的攻击力额外增加120%，但攻速降低0.5%',
        getParams: (level) => ({ damageBonus: 1.20, speedPenalty: 0.005 }),
        getDescription: (level) => '升级攻击力时，提升的攻击力额外+120%，攻速每级-0.5%'
    },
    gold_on_attack: {
        id: 'gold_on_attack', name: '妙手', type: 'gold_on_attack', icon: '💰',
        baseUnlockLevel: 5, baseDescription: '每次攻击额外获得攻击力数值的金币',
        getParams: (level) => {
            const multiplier = 1.0 + Math.floor(level / 10) * 0.1;
            return { multiplier };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.gold_on_attack.getParams(level);
            if (params.multiplier > 1.0) return `每次攻击额外获得攻击力${(params.multiplier * 100).toFixed(0)}%的金币`;
            return '每次攻击额外获得攻击力数值的金币';
        }
    }
};

export const DEFAULT_UNIT_SKILLS = {
    'player': 'sync_click_damage',
    'kongkong': 'gold_on_attack',
    'warrior': 'stacking_buff',
    'archer': 'crit_burst',
    'royal_guard': 'experience_growth',
    'iron_soldier': 'iron_fist',
    'knight': 'knight_heavy_armor',
    'berserker': 'berserker_combo',
    'mage': 'global_speed_buff',
    'night_swordsman': 'shadow_crit',
    'ice_daughter': 'boss_debuff',
    'necromancer': 'soul_devour',
    'priest': 'damage_aura',
    'dragon': 'dragon_soul',
    'angel': 'pure_percent_damage',
    'time_walker': 'time_burst',
    'void_lord': 'total_team_damage',
    'phoenix': 'periodic_burst',
    'legend': 'legend_dual_growth',
    'chaos_emperor': 'chaos_stack',
    'sacred_dragon': 'ultimate'
};

export function getSkillDefinition(skillId) {
    return SKILL_LIBRARY[skillId] || null;
}

export function getUnitSkill(mercenary) {
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;
    const skillId = mercenary.evolvedSkillId || DEFAULT_UNIT_SKILLS[mercenary.id];
    if (!skillId) return null;
    const skillDef = SKILL_LIBRARY[skillId];
    if (!skillDef) return null;
    if (totalLevel < skillDef.baseUnlockLevel) return null;
    if (skillDef.type === 'sync_click_damage' && !mercenary.recruited) return null;
    const params = skillDef.getParams(totalLevel);
    return { ...params, id: skillDef.id, type: skillDef.type, name: skillDef.name, icon: skillDef.icon, desc: skillDef.getDescription(totalLevel) };
}

export function getUnitSkillDisplay(mercenary) {
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;
    const skillId = mercenary.evolvedSkillId || DEFAULT_UNIT_SKILLS[mercenary.id];
    if (!skillId) return null;
    const skillDef = SKILL_LIBRARY[skillId];
    if (!skillDef) return null;
    const isUnlocked = totalLevel >= skillDef.baseUnlockLevel;

    if (skillDef.type === 'legend_dual_growth') {
        return { name: `【${skillDef.name}】`, isUnlocked: mercenary.recruited, desc: mercenary.recruited ? skillDef.getDescription(totalLevel) : '（招募后解锁）', baseDesc: skillDef.baseDescription, unlockCondition: '招募后解锁', icon: skillDef.icon };
    }
    if (skillDef.type === 'sync_click_damage') {
        return { name: `【${skillDef.name}】`, isUnlocked: mercenary.recruited, desc: skillDef.baseDescription, baseDesc: skillDef.baseDescription, unlockCondition: '雇佣即解锁', icon: skillDef.icon };
    }
    if (skillDef.id === 'experience_growth') {
        const teachSkillDef = SKILL_LIBRARY['team_damage_buff'];
        const teachUnlocked = totalLevel >= teachSkillDef.baseUnlockLevel;
        return {
            name: '【经验】', isUnlocked: true, desc: '每10秒，攻击力 +（1 + 等级×攻击力等级/30）',
            baseDesc: skillDef.baseDescription, unlockCondition: '雇佣即解锁', icon: skillDef.icon,
            skill2: { name: '【传授】', isUnlocked: teachUnlocked, desc: teachUnlocked ? teachSkillDef.getDescription(totalLevel) : teachSkillDef.baseDescription, baseDesc: teachSkillDef.baseDescription, unlockCondition: `Lv.${teachSkillDef.baseUnlockLevel}解锁` }
        };
    }
    if (skillDef.id === 'knight_heavy_armor') {
        return {
            name: '【重装】', isUnlocked: true, desc: '升级攻击力时额外增加（攻击力等级²×等级）点攻击力',
            baseDesc: skillDef.baseDescription, unlockCondition: '雇佣即解锁', icon: skillDef.icon,
            skill2: { name: '【稳固】', isUnlocked: true, desc: '每隔8秒，造成等同攻击力的额外伤害', baseDesc: '每隔8秒，造成等同攻击力的伤害', unlockCondition: '雇佣即解锁' }
        };
    }
    if (skillDef.id === 'berserker_combo') {
        const params = skillDef.getParams(totalLevel);
        const isComboUnlocked = totalLevel >= 50;
        let skill1Desc = skillDef.baseDescription;
        if (isUnlocked) {
            const b1 = (params.maxBonus * 0.25 * 100).toFixed(0);
            const b2 = (params.maxBonus * 0.50 * 100).toFixed(0);
            const b3 = (params.maxBonus * 0.75 * 100).toFixed(0);
            const b4 = (params.maxBonus * 1.00 * 100).toFixed(0);
            skill1Desc = `血量<85%/60%/35%/10%时，伤害+${b1}%/${b2}%/${b3}%/${b4}%`;
        }
        let skill2Desc = '血量越低，越有几率再次攻击';
        if (isComboUnlocked) {
            skill2Desc = `血量<85%/60%/35%/10%时，15%/30%/45%/60%几率连击`;
        }
        return {
            name: '【狂暴】', isUnlocked, desc: skill1Desc, baseDesc: skillDef.baseDescription, unlockCondition: `Lv.${skillDef.baseUnlockLevel}解锁`, icon: skillDef.icon,
            skill2: { name: '【连击】', isUnlocked: isComboUnlocked, desc: skill2Desc, baseDesc: '血量越低，越有几率再次攻击', unlockCondition: 'Lv.50解锁' }
        };
    }
    return { name: `【${skillDef.name}】`, isUnlocked, desc: isUnlocked ? skillDef.getDescription(totalLevel) : skillDef.baseDescription, baseDesc: skillDef.baseDescription, unlockCondition: skillDef.baseUnlockLevel === 0 ? '雇佣即解锁' : `Lv.${skillDef.baseUnlockLevel}解锁`, icon: skillDef.icon };
}

export function getEvolvableSkills() {
    const excludeIds = ['sync_click_damage', 'legend_dual_growth', 'knight_heavy_armor', 'knight_fortify', 'experience_growth'];
    return Object.values(SKILL_LIBRARY)
        .filter(skill => !excludeIds.includes(skill.id))
        .map(skill => ({ id: skill.id, name: skill.name, icon: skill.icon, baseDescription: skill.baseDescription, baseUnlockLevel: skill.baseUnlockLevel }));
}
