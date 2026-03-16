// data/skills.js - 技能库定义
// 技能与单位解耦，便于后续进化系统复用

/**
 * 技能库 - 所有可用技能的定义
 *
 * 技能结构：
 * - id: 技能唯一标识
 * - name: 技能名称
 * - type: 技能类型（用于战斗逻辑判断）
 * - icon: 技能图标
 * - baseUnlockLevel: 基础解锁等级（0表示雇佣即解锁）
 * - getParams: 根据等级计算技能参数的函数
 * - getDescription: 根据等级生成技能描述的函数
 * - baseDescription: 技能基础描述（未解锁时显示）
 */
const SKILL_LIBRARY = {
    // ==================== 基础技能 ====================

    // 【长大】- 玩家专属
    sync_click_damage: {
        id: 'sync_click_damage',
        name: '长大',
        type: 'sync_click_damage',
        icon: '📈',
        baseUnlockLevel: 0,
        baseDescription: '升级攻击力时，点击伤害也同步提升',
        getParams: (level) => ({}),
        getDescription: (level) => '升级攻击力时，点击伤害也同步提升'
    },

    // 【熟练】- 战士默认
    stacking_buff: {
        id: 'stacking_buff',
        name: '熟练',
        type: 'stacking_buff',
        icon: '💪',
        baseUnlockLevel: 10,
        baseDescription: '每次攻击有几率永久提升攻击力',
        getParams: (level) => {
            const extraChance = Math.floor((level - 10) / 10) * 0.01;
            const chance = 0.03 + Math.max(0, extraChance);
            return {
                chance: chance,
                val: 0.01 // 每次提升1%
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.stacking_buff.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率永久提升1%攻击力`;
        }
    },

    // 【爆裂】- 弓箭手默认
    crit_burst: {
        id: 'crit_burst',
        name: '爆裂',
        type: 'crit',
        icon: '💥',
        baseUnlockLevel: 10,
        baseDescription: '攻击有几率造成多倍暴击伤害',
        getParams: (level) => {
            const extraMult = Math.floor((level - 20) / 10) * 0.5;
            return {
                chance: 0.20,
                multiplier: 3.0 + Math.max(0, extraMult)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.crit_burst.getParams(level);
            return `20%几率造成${params.multiplier.toFixed(1)}倍伤害`;
        }
    },

    // 【暗影突袭】- 夜剑客默认（高暴击率版本）
    shadow_crit: {
        id: 'shadow_crit',
        name: '暗影突袭',
        type: 'crit',
        icon: '🌑',
        baseUnlockLevel: 20,
        baseDescription: '极高暴击率的暗影攻击',
        getParams: (level) => {
            const critChance = Math.min(0.60, 0.35 + Math.floor((level - 20) / 10) * 0.05);
            const critMult = 2.0 + Math.floor((level - 20) / 15) * 0.3;
            return {
                chance: Math.max(0.35, critChance),
                multiplier: Math.max(2.0, critMult)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.shadow_crit.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率造成${params.multiplier.toFixed(1)}倍伤害`;
        }
    },

    // 【传授】- 士兵默认
    team_damage_buff: {
        id: 'team_damage_buff',
        name: '传授',
        type: 'team_damage_buff',
        icon: '📚',
        baseUnlockLevel: 15,
        baseDescription: '每隆60秒，使其他所有单位永久增加本单位攻击力的1%',
        getParams: (level) => {
            return {
                interval: 60000,
                bonusRatio: 0.01
            };
        },
        getDescription: (level) => {
            return `每60秒，使其他所有单位永久增加本单位攻击力的1%`;
        }
    },

    // 【经验】- 士兵副技能
    experience_growth: {
        id: 'experience_growth',
        name: '经验',
        type: 'experience_growth',
        icon: '🌟',
        baseUnlockLevel: 0,
        baseDescription: '每隆10秒，攻击力永久增加',
        getParams: (level) => ({ interval: 10000 }),
        getDescription: (level) => {
            return `每10秒，攻击力 +（1 + 等级×攻击力等级/30）`;
        }
    },

    // 【钢铁神拳】- 钢铁士兵默认
    iron_fist: {
        id: 'iron_fist',
        name: '钢铁神拳',
        type: 'iron_fist',
        icon: '🤜',
        baseUnlockLevel: 20,
        baseDescription: '攻击时有概率触发钢铁系总攻击力伤害',
        getParams: (level) => {
            const multiplier = 0.4 + Math.floor((level - 20) / 10) * 0.15;
            return {
                chance: 0.10,
                multiplier: Math.max(0.4, multiplier)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.iron_fist.getParams(level);
            return `10%几率造成钢铁系总攻击力${(params.multiplier * 100).toFixed(0)}%伤害`;
        }
    },

    // 【狂暴】- 狂战士默认
    berserker_rage: {
        id: 'berserker_rage',
        name: '狂暴',
        type: 'berserker_rage',
        icon: '🔥',
        baseUnlockLevel: 35,
        baseDescription: 'Boss血量越低，伤害越高',
        getParams: (level) => {
            const baseBonus = 1.0 + Math.floor((level - 35) / 10) * 0.3;
            return {
                maxBonus: Math.max(1.0, baseBonus),
                thresholds: [
                    { hpPercent: 0.85, bonusPercent: 0.25 },
                    { hpPercent: 0.60, bonusPercent: 0.50 },
                    { hpPercent: 0.35, bonusPercent: 0.75 },
                    { hpPercent: 0.10, bonusPercent: 1.00 }
                ]
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.berserker_rage.getParams(level);
            return `Boss血量越低伤害越高，最高+${(params.maxBonus * 100).toFixed(0)}%`;
        }
    },

    // 【连击】- 狂战士副技能
    combo_strike: {
        id: 'combo_strike',
        name: '连击',
        type: 'combo_strike',
        icon: '⚔️',
        baseUnlockLevel: 50,
        baseDescription: 'Boss血量越低，越有几率再次攻击',
        getParams: (level) => {
            return {
                thresholds: [
                    { hpPercent: 0.85, comboChance: 0.15 },
                    { hpPercent: 0.60, comboChance: 0.30 },
                    { hpPercent: 0.35, comboChance: 0.45 },
                    { hpPercent: 0.10, comboChance: 0.60 }
                ]
            };
        },
        getDescription: (level) => {
            return `Boss血量越低连击概率越高，最高60%`;
        }
    },

    // 【奥术激涌】- 法师默认
    global_speed_buff: {
        id: 'global_speed_buff',
        name: '奥术激涌',
        type: 'global_speed_buff',
        icon: '⚡',
        baseUnlockLevel: 20,
        baseDescription: '攻击时有几率使全体攻速提升',
        getParams: (level) => {
            const bonusSpeed = 0.05 + Math.floor((level - 20) / 10) * 0.05;
            return {
                chance: 0.05,
                val: Math.max(0.05, bonusSpeed),
                duration: 3000
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.global_speed_buff.getParams(level);
            return `5%几率使全体攻速提升${(params.val * 100).toFixed(0)}% (持续3秒)`;
        }
    },

    // 【冰霜冻结】- 冰女默认
    boss_debuff: {
        id: 'boss_debuff',
        name: '冰霜冻结',
        type: 'boss_debuff',
        icon: '❄️',
        baseUnlockLevel: 25,
        baseDescription: '攻击时有概率冻结Boss增加其受到伤害',
        getParams: (level) => {
            const debuffVal = 0.15 + Math.floor((level - 25) / 10) * 0.05;
            return {
                chance: 0.12,
                val: Math.max(0.15, debuffVal),
                duration: 4000
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.boss_debuff.getParams(level);
            return `12%几率使Boss受伤+${(params.val * 100).toFixed(0)}% (4秒)`;
        }
    },

    // 【亡灵召唤】- 亡灵法师默认
    summon: {
        id: 'summon',
        name: '亡灵召唤',
        type: 'summon',
        icon: '💀',
        baseUnlockLevel: 30,
        baseDescription: '召唤骷髅军团协助攻击',
        getParams: (level) => {
            const skeletonCount = Math.min(5, 1 + Math.floor((level - 30) / 20));
            const skeletonDmg = 0.10 + Math.floor((level - 30) / 10) * 0.03;
            return {
                count: Math.max(1, skeletonCount),
                damageRatio: Math.max(0.10, skeletonDmg)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.summon.getParams(level);
            return `召唤${params.count}个骷髅，各造成${(params.damageRatio * 100).toFixed(0)}%伤害`;
        }
    },

    // 【神圣祝福】- 圣职者默认
    damage_aura: {
        id: 'damage_aura',
        name: '神圣祝福',
        type: 'damage_aura',
        icon: '✨',
        baseUnlockLevel: 25,
        baseDescription: '为全队提供永久伤害加成光环',
        getParams: (level) => {
            const auraVal = 0.08 + Math.floor((level - 25) / 10) * 0.03;
            return {
                val: Math.max(0.08, auraVal)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.damage_aura.getParams(level);
            return `全队永久伤害+${(params.val * 100).toFixed(0)}%`;
        }
    },

    // 【龙魂觉醒】- 龙骑士默认
    dragon_soul: {
        id: 'dragon_soul',
        name: '龙魂觉醒',
        type: 'dragon_soul',
        icon: '🐲',
        baseUnlockLevel: 40,
        baseDescription: '积累龙魂能量释放毁灭龙息',
        getParams: (level) => {
            const burstMultiplier = 50 + Math.floor((level - 40) / 10) * 15;
            const burnDamage = 0.05 + Math.floor((level - 40) / 15) * 0.02;
            return {
                maxStacks: 10,
                burstMultiplier: Math.max(50, burstMultiplier),
                burnDamage: Math.max(0.05, burnDamage),
                burnDuration: 5000
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.dragon_soul.getParams(level);
            return `每10次攻击释放${params.burstMultiplier}倍龙息+灼烧${(params.burnDamage * 100).toFixed(0)}%/秒`;
        }
    },

    // 【圣洁之力】- 天使默认
    pure_percent_damage: {
        id: 'pure_percent_damage',
        name: '圣洁之力',
        type: 'pure_percent_damage',
        icon: '👼',
        baseUnlockLevel: 30,
        baseDescription: '概率造成Boss当前血量百分比伤害',
        getParams: (level) => {
            const chance = 0.08 + Math.floor((level - 30) / 20) * 0.02;
            return {
                chance: Math.max(0.08, chance),
                percentVal: 0.0001, // 0.01%
                ignoreBonus: true
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.pure_percent_damage.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率造成Boss当前血量0.01%伤害(不受加成)`;
        }
    },

    // 【时空涟漪】- 时光默认（新设计：每60秒6连击）
    time_burst: {
        id: 'time_burst',
        name: '时空涟漪',
        type: 'time_burst',
        icon: '⏳',
        baseUnlockLevel: 35,
        baseDescription: '周期性释放时空连击',
        getParams: (level) => {
            const attackCount = 6 + Math.floor((level - 35) / 20); // 6次起，每20级+1次
            const damageMultiplier = 1.0 + Math.floor((level - 35) / 10) * 0.2; // 每次攻击的伤害倍率
            return {
                interval: 60000, // 60秒
                attackCount: Math.min(12, attackCount), // 最多12次
                damageMultiplier: Math.max(1.0, damageMultiplier)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.time_burst.getParams(level);
            return `每60秒释放${params.attackCount}次时空攻击(${params.damageMultiplier.toFixed(1)}倍伤害)`;
        }
    },

    // 【虚空侵蚀】- 虚空默认
    total_team_damage: {
        id: 'total_team_damage',
        name: '虚空侵蚀',
        type: 'total_team_damage',
        icon: '🌌',
        baseUnlockLevel: 40,
        baseDescription: '概率造成全队攻击力总和的伤害',
        getParams: (level) => {
            const chance = 0.10 + Math.floor((level - 40) / 15) * 0.03;
            return {
                chance: Math.max(0.10, chance)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.total_team_damage.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率造成全队攻击力总和的伤害`;
        }
    },

    // 【浴火重生】- 凤凰默认
    periodic_burst: {
        id: 'periodic_burst',
        name: '浴火重生',
        type: 'periodic_burst',
        icon: '🔥',
        baseUnlockLevel: 35,
        baseDescription: '周期性自动触发大量伤害',
        getParams: (level) => {
            const burstMult = 50 + Math.floor((level - 35) / 10) * 20;
            return {
                interval: 60000,
                multiplier: Math.max(50, burstMult)
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.periodic_burst.getParams(level);
            return `每60秒自动造成${params.multiplier}倍伤害`;
        }
    },

    // 【混沌法则】- 混沌默认
    chaos_stack: {
        id: 'chaos_stack',
        name: '混沌法则',
        type: 'chaos_stack',
        icon: '🌀',
        baseUnlockLevel: 45,
        baseDescription: '每次攻击概率增加攻击力，但也增加攻击间隔',
        getParams: (level) => {
            const chance = 0.15 + Math.floor((level - 45) / 10) * 0.03;
            const atkBonus = 0.05 + Math.floor((level - 45) / 15) * 0.02;
            return {
                chance: Math.max(0.15, chance),
                atkBonus: Math.max(0.05, atkBonus),
                intervalIncrease: 0.1
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.chaos_stack.getParams(level);
            return `${(params.chance * 100).toFixed(0)}%几率攻击力+${(params.atkBonus * 100).toFixed(0)}%，攻击间隔+0.1秒`;
        }
    },

    // 【万物终结】- 无极默认
    ultimate: {
        id: 'ultimate',
        name: '万物终结',
        type: 'ultimate',
        icon: '✨',
        baseUnlockLevel: 50,
        baseDescription: '终极技能，集合所有效果',
        getParams: (level) => {
            const allBonus = 0.15 + Math.floor((level - 50) / 10) * 0.05;
            return {
                teamDamageBonus: Math.max(0.15, allBonus),
                teamSpeedBonus: Math.max(0.15, allBonus) * 0.5,
                critChance: 0.25,
                critMult: 5.0
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.ultimate.getParams(level);
            return `全队伤害+${(params.teamDamageBonus * 100).toFixed(0)}%，攻速+${(params.teamSpeedBonus * 100).toFixed(0)}%，25%暴击5倍`;
        }
    },

    // 【全能】- 传说专属（被动技能，在升级时生效）
    legend_dual_growth: {
        id: 'legend_dual_growth',
        name: '全能',
        type: 'legend_dual_growth',
        icon: '👑',
        baseUnlockLevel: 0,
        baseDescription: '升级攻击力时攻击速度也会提升，反之亦然',
        getParams: (level) => ({}),
        getDescription: (level) => '升级攻击力时攻击速度也会提升，反之亦然'
    },

    // 【传说之剑】- 传说副技能
    legend_sword: {
        id: 'legend_sword',
        name: '传说之剑',
        type: 'legend_sword',
        icon: '⚔️',
        baseUnlockLevel: 35,
        baseDescription: '攻击时有1%概率挥出传说之剑，造成巨额伤害',
        getParams: (level) => ({ chance: 0.01, baseDamagePerLevel: 9999999999 }),
        getDescription: (level) => `攻击时1%概率造成（9999999999×(攻击力等级+1)）点伤害`
    },

    // 【元传说之剑】- 传说之剑Lv.75强化
    meta_legend_sword: {
        id: 'meta_legend_sword',
        name: '元传说之剑',
        type: 'meta_legend_sword',
        icon: '🗡️',
        baseUnlockLevel: 75,
        baseDescription: '传说之剑额外增加（全军攻击力×(攻击力等级+1)/10）点伤害',
        getParams: (level) => ({}),
        getDescription: (level) => '传说之剑额外+（全军攻击力×(攻击力等级+1)/10）点伤害'
    },

    // 【妙手】- 空空默认
    knight_heavy_armor: {
        id: 'knight_heavy_armor',
        name: '重装',
        type: 'knight_heavy_armor',
        icon: '🛡️',
        baseUnlockLevel: 0,
        baseDescription: '升级攻击力时额外增加攻击力',
        getParams: (level) => ({}),
        getDescription: (level) => '升级攻击力时额外增加（攻击力等级²×等级）点攻击力'
    },

    // 【稳固】- 骑士副技能
    knight_fortify: {
        id: 'knight_fortify',
        name: '稳固',
        type: 'knight_fortify',
        icon: '🏰',
        baseUnlockLevel: 0,
        baseDescription: '每隔8秒，造成等同攻击力的伤害',
        getParams: (level) => ({ interval: 8000 }),
        getDescription: (level) => '每隔8秒，造成等同攻击力的额外伤害'
    },

    // 【妙手】- 空空默认
    gold_on_attack: {
        id: 'gold_on_attack',
        name: '妙手',
        type: 'gold_on_attack',
        icon: '💰',
        baseUnlockLevel: 5,
        baseDescription: '每次攻击额外获得攻击力数值的金币',
        getParams: (level) => {
            // 基础倍率1.0，每10级增加0.1
            const multiplier = 1.0 + Math.floor(level / 10) * 0.1;
            return {
                multiplier: multiplier
            };
        },
        getDescription: (level) => {
            const params = SKILL_LIBRARY.gold_on_attack.getParams(level);
            if (params.multiplier > 1.0) {
                return `每次攻击额外获得攻击力${(params.multiplier * 100).toFixed(0)}%的金币`;
            }
            return '每次攻击额外获得攻击力数值的金币';
        }
    }
};

/**
 * 单位默认技能映射表
 * key: 单位ID
 * value: 技能ID
 */
const DEFAULT_UNIT_SKILLS = {
    'player': 'sync_click_damage',
    'kongkong': 'gold_on_attack',
    'warrior': 'stacking_buff',
    'archer': 'crit_burst',
    'royal_guard': 'experience_growth',
    'iron_soldier': 'iron_fist',
    'knight': 'knight_heavy_armor',
    'berserker': 'berserker_rage',
    'mage': 'global_speed_buff',
    'night_swordsman': 'shadow_crit',
    'ice_daughter': 'boss_debuff',
    'necromancer': 'summon',
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

const SECONDARY_UNIT_SKILLS = {
    'berserker': 'combo_strike',
    'legend': 'legend_sword'
};

/**
 * 获取技能定义
 * @param {string} skillId - 技能ID
 * @returns {Object|null} - 技能定义
 */
function getSkillDefinition(skillId) {
    return SKILL_LIBRARY[skillId] || null;
}

/**
 * 获取单位的技能（支持进化技能）
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - 技能实例（包含计算后的参数）
 */
function getUnitSkill(mercenary) {
    // 总等级 = 攻击等级 + 攻速等级 + 1
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;

    // 优先使用进化技能，否则使用默认技能
    const skillId = mercenary.evolvedSkillId || DEFAULT_UNIT_SKILLS[mercenary.id];

    if (!skillId) return null;

    const skillDef = SKILL_LIBRARY[skillId];
    if (!skillDef) return null;

    // 检查是否解锁
    if (totalLevel < skillDef.baseUnlockLevel) return null;

    // 特殊处理：玩家的长大技能需要已招募
    if (skillDef.type === 'sync_click_damage' && !mercenary.recruited) return null;

    // 构建技能实例
    const params = skillDef.getParams(totalLevel);

    return {
        ...params,
        id: skillDef.id,
        type: skillDef.type,
        name: skillDef.name,
        icon: skillDef.icon,
        desc: skillDef.getDescription(totalLevel)
    };
}

/**
 * 获取单位的副技能（独立于默认技能和进化技能）
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - 技能实例
 */
function getSecondaryUnitSkill(mercenary) {
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;
    const skillId = SECONDARY_UNIT_SKILLS[mercenary.id];
    if (!skillId) return null;
    const skillDef = SKILL_LIBRARY[skillId];
    if (!skillDef) return null;
    if (totalLevel < skillDef.baseUnlockLevel) return null;
    const params = skillDef.getParams(totalLevel);
    return { ...params, id: skillDef.id, type: skillDef.type, name: skillDef.name, icon: skillDef.icon, desc: skillDef.getDescription(totalLevel) };
}

/**
 * 获取单位技能的UI显示信息
 * @param {Object} mercenary - 佣兵对象
 * @returns {Object|null} - UI显示用的技能信息
 */
function getUnitSkillDisplay(mercenary) {
    const totalLevel = (mercenary.damageLevel || 0) + (mercenary.intervalLevel || 0) + 1;

    // 优先使用进化技能，否则使用默认技能
    const skillId = mercenary.evolvedSkillId || DEFAULT_UNIT_SKILLS[mercenary.id];

    if (!skillId) return null;

    const skillDef = SKILL_LIBRARY[skillId];
    if (!skillDef) return null;

    const isUnlocked = totalLevel >= skillDef.baseUnlockLevel;

    // 特殊处理：传说的全能技能需要已招募
    if (skillDef.type === 'legend_dual_growth') {
        const swordDef = SKILL_LIBRARY['legend_sword'];
        const metaDef = SKILL_LIBRARY['meta_legend_sword'];
        const swordUnlocked = totalLevel >= swordDef.baseUnlockLevel;
        const metaUnlocked = totalLevel >= metaDef.baseUnlockLevel;
        let swordDesc = swordDef.baseDescription;
        if (swordUnlocked) swordDesc = swordDef.getDescription(totalLevel);
        let metaDesc = metaDef.baseDescription;
        if (metaUnlocked) metaDesc = metaDef.getDescription(totalLevel);
        return {
            name: `【${skillDef.name}】`,
            isUnlocked: mercenary.recruited,
            desc: mercenary.recruited ? skillDef.getDescription(totalLevel) : '（招募后解锁）',
            baseDesc: skillDef.baseDescription,
            unlockCondition: '招募后解锁',
            icon: skillDef.icon,
            skill2: { name: '【传说之剑】', isUnlocked: swordUnlocked, desc: swordDesc, baseDesc: swordDef.baseDescription, unlockCondition: `Lv.${swordDef.baseUnlockLevel}解锁` },
            skill3: { name: '【元传说之剑】', isUnlocked: metaUnlocked, desc: metaDesc, baseDesc: metaDef.baseDescription, unlockCondition: `Lv.${metaDef.baseUnlockLevel}解锁` }
        };
    }

    // 特殊处理：玩家的长大技能
    if (skillDef.type === 'sync_click_damage') {
        return {
            name: `【${skillDef.name}】`,
            isUnlocked: mercenary.recruited,
            desc: skillDef.baseDescription,
            baseDesc: skillDef.baseDescription,
            unlockCondition: '雇佣即解锁',
            icon: skillDef.icon
        };
    }

    // 特殊处理：士兵的双技能
    if (skillDef.id === 'experience_growth') {
        const teachSkillDef = SKILL_LIBRARY['team_damage_buff'];
        const teachUnlocked = totalLevel >= teachSkillDef.baseUnlockLevel;
        return {
            name: '【经验】',
            isUnlocked: true,
            desc: '每10秒，攻击力 +（1 + 等级×攻击力等级/30）',
            baseDesc: skillDef.baseDescription,
            unlockCondition: '雇佣即解锁',
            icon: skillDef.icon,
            skill2: {
                name: '【传授】',
                isUnlocked: teachUnlocked,
                desc: teachUnlocked ? teachSkillDef.getDescription(totalLevel) : teachSkillDef.baseDescription,
                baseDesc: teachSkillDef.baseDescription,
                unlockCondition: `Lv.${teachSkillDef.baseUnlockLevel}解锁`
            }
        };
    }

    // 特殊处理：骑士的双技能
    if (skillDef.id === 'knight_heavy_armor') {
        return {
            name: '【重装】',
            isUnlocked: true,
            desc: '升级攻击力时额外增加（攻击力等级²×等级）点攻击力',
            baseDesc: skillDef.baseDescription,
            unlockCondition: '雇佣即解锁',
            icon: skillDef.icon,
            skill2: {
                name: '【稳固】',
                isUnlocked: true,
                desc: '每隔8秒，造成等同攻击力的额外伤害',
                baseDesc: '每隔8秒，造成等同攻击力的伤害',
                unlockCondition: '雇佣即解锁'
            }
        };
    }

    // 特殊处理：狂战士的双技能
    if (skillDef.id === 'berserker_rage') {
        const params = skillDef.getParams(totalLevel);
        const comboDef = SKILL_LIBRARY['combo_strike'];
        const isComboUnlocked = totalLevel >= comboDef.baseUnlockLevel;

        let skill1Desc = skillDef.baseDescription;
        if (isUnlocked) {
            const b1 = (params.maxBonus * 0.25 * 100).toFixed(0);
            const b2 = (params.maxBonus * 0.50 * 100).toFixed(0);
            const b3 = (params.maxBonus * 0.75 * 100).toFixed(0);
            const b4 = (params.maxBonus * 1.00 * 100).toFixed(0);
            skill1Desc = `血量<85%/60%/35%/10%时，伤害+${b1}%/${b2}%/${b3}%/${b4}%`;
        }

        let skill2Desc = comboDef.baseDescription;
        if (isComboUnlocked) {
            skill2Desc = comboDef.getDescription(totalLevel);
        }

        return {
            name: '【狂暴】',
            isUnlocked,
            desc: skill1Desc,
            baseDesc: skillDef.baseDescription,
            unlockCondition: `Lv.${skillDef.baseUnlockLevel}解锁`,
            icon: skillDef.icon,
            skill2: {
                name: '【连击】',
                isUnlocked: isComboUnlocked,
                desc: skill2Desc,
                baseDesc: comboDef.baseDescription,
                unlockCondition: `Lv.${comboDef.baseUnlockLevel}解锁`
            }
        };
    }

    return {
        name: `【${skillDef.name}】`,
        isUnlocked,
        desc: isUnlocked ? skillDef.getDescription(totalLevel) : skillDef.baseDescription,  // 未解锁时显示基础描述
        baseDesc: skillDef.baseDescription,
        unlockCondition: skillDef.baseUnlockLevel === 0 ? '雇佣即解锁' : `Lv.${skillDef.baseUnlockLevel}解锁`,
        icon: skillDef.icon
    };
}

/**
 * 获取所有可进化的技能列表（用于进化选择界面）
 * @returns {Array} - 技能列表
 */
function getEvolvableSkills() {
    // 排除一些特殊技能（玩家专属、传说专属等）
    const excludeIds = ['sync_click_damage', 'meta_legend_sword', 'knight_heavy_armor', 'knight_fortify', 'experience_growth', 'damage_aura', 'ultimate', 'global_speed_buff', 'boss_debuff'];

    return Object.values(SKILL_LIBRARY)
        .filter(skill => !excludeIds.includes(skill.id))
        .map(skill => ({
            id: skill.id,
            name: skill.name,
            icon: skill.icon,
            baseDescription: skill.baseDescription,
            baseUnlockLevel: skill.baseUnlockLevel
        }));
}

module.exports = {
    SKILL_LIBRARY,
    DEFAULT_UNIT_SKILLS,
    SECONDARY_UNIT_SKILLS,
    getSkillDefinition,
    getUnitSkill,
    getSecondaryUnitSkill,
    getUnitSkillDisplay,
    getEvolvableSkills
};
