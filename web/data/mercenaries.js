// data/mercenaries.js - 佣兵数据定义

/**
 * 佣兵列表 - 参考《打BOSS》设计
 */
export const MERCENARIES_DATA = [
    // ==================== 基础系 (Basic) ====================
    {
        id: 'player', name: '玩家', baseCost: 0, damage: 1, attackInterval: 4.0,
        description: '其实他就是你的缩影', icon: '🧑', category: 'basic', hired: true
    },
    {
        id: 'kongkong', name: '泼猴', baseCost: 18, damage: 3, attackInterval: 3.2,
        description: '身手敏捷的小猴，攻击时顺手牵羊', icon: '🐵', category: 'basic'
    },
    {
        id: 'warrior', name: '战士', baseCost: 40, damage: 5, attackInterval: 4.3,
        description: '基础近战单位，攻击稳定', icon: '⚔️', category: 'basic'
    },
    {
        id: 'archer', name: '弓箭手', baseCost: 100, damage: 10, attackInterval: 3.5,
        description: '远程攻击，伤害较高', icon: '🏹', category: 'basic'
    },
    {
        id: 'royal_guard', name: '士兵', baseCost: 1200, damage: 100, attackInterval: 3.6,
        description: '经验丰富的老兵，会将战斗经验传授给其他基础系单位', icon: '🎖️', category: 'basic'
    },
    // ==================== 钢铁系 (Iron) ====================
    {
        id: 'iron_soldier', name: '钢铁士兵', baseCost: 57000, damage: 1900, attackInterval: 3.5,
        description: '铁甲战士，攻击有概率触发钢铁拳', icon: '🤖', category: 'iron'
    },
    {
        id: 'knight', name: '骑士', baseCost: 1160000, damage: 29000, attackInterval: 3.5,
        description: '重装骑兵，攻守兼备', icon: '🛡️', category: 'iron'
    },
    {
        id: 'berserker', name: '狂战士', baseCost: 14500000, damage: 290000, attackInterval: 2.7,
        description: 'Boss血量越低攻击越高，疯狂的战争机器', icon: '🪓', category: 'iron'
    },
    // ==================== 魔法系 (Magic) ====================
    {
        id: 'mage', name: '法师', baseCost: 9600, damage: 160, attackInterval: 3.4,
        description: '魔法攻击，有几率提升全队攻速', icon: '🔮', category: 'magic'
    },
    {
        id: 'night_swordsman', name: '夜剑客', baseCost: 184000, damage: 2300, attackInterval: 3.2,
        description: '暗夜中的刺客，暴击率极高', icon: '🗡️', category: 'magic'
    },
    {
        id: 'ice_daughter', name: '冰女', baseCost: 3300000, damage: 33000, attackInterval: 3.0,
        description: '冰霜女王的后裔，使Boss受到更多伤害', icon: '❄️', category: 'magic'
    },
    {
        id: 'necromancer', name: '亡灵法师', baseCost: 72000000, damage: 480000, attackInterval: 3.1,
        description: '召唤亡灵军团协助攻击', icon: '💀', category: 'magic'
    },
    // ==================== 圣洁系 (Holy) ====================
    {
        id: 'priest', name: '圣职者', baseCost: 1500000000, damage: 5000000, attackInterval: 4.0,
        description: '神圣之力，为全队提供永久伤害光环', icon: '⛪', category: 'holy'
    },
    {
        id: 'dragon', name: '龙骑士', baseCost: 37000000000, damage: 74000000, attackInterval: 4.1,
        description: '传说中的龙骑士，积蓄龙魂释放毁灭龙息', icon: '🐉', category: 'holy'
    },
    {
        id: 'angel', name: '天使', baseCost: 93800000000, damage: 134000000, attackInterval: 3.5,
        description: '光明使者，造成Boss最大血量百分比伤害', icon: '👼', category: 'holy'
    },
    // ==================== 远古系 (Ancient) ====================
    {
        id: 'time_walker', name: '时光', baseCost: 123000000000, damage: 123000000, attackInterval: 4.0,
        description: '穿越时空的旅者，每60秒释放时空连击', icon: '⏳', category: 'ancient'
    },
    {
        id: 'void_lord', name: '虚空', baseCost: 2160000000000, damage: 1800000000, attackInterval: 3.5,
        description: '来自虚空的存在，攻击时概率造成全队攻击力总和的伤害', icon: '🌌', category: 'ancient'
    },
    {
        id: 'phoenix', name: '凤凰', baseCost: 2850000000000, damage: 1900000000, attackInterval: 5.0,
        description: '浴火重生，周期性释放超高倍伤害', icon: '🔥', category: 'ancient'
    },
    // ==================== 传说系 (Legend) ====================
    {
        id: 'legend', name: '传说', baseCost: 10000000000000, damage: 5000000000, attackInterval: 4.5,
        description: '全能的传说，升级攻击力同时提升攻速', icon: '👑', category: 'legend'
    },
    {
        id: 'chaos_emperor', name: '混沌', baseCost: 33000000000000, damage: 15000000000, attackInterval: 5.5,
        description: '混沌的化身，攻击间隔越长伤害越高', icon: '🌀', category: 'legend'
    },
    {
        id: 'sacred_dragon', name: '无极', baseCost: 125000000000000, damage: 50000000000, attackInterval: 6.0,
        description: '最终的守护者，拥有全队增伤+暴击的终极技能', icon: '✨', category: 'legend'
    }
];

/**
 * 初始化佣兵数据
 */
export function initMercenaries() {
    return MERCENARIES_DATA.map(merc => ({
        ...merc,
        recruited: merc.hired || false,
        damageLevel: 0,
        intervalLevel: 0,
        currentDamage: merc.damage,
        currentInterval: merc.attackInterval,
        totalDamage: 0
    }));
}

/**
 * 根据ID获取佣兵数据
 */
export function getMercenaryById(id) {
    return MERCENARIES_DATA.find(merc => merc.id === id) || null;
}
