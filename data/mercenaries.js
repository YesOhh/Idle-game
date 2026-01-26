// data/mercenaries.js - 佣兵数据定义

/**
 * 佣兵列表 - 参考《打BOSS》设计
 * 每个佣兵包含：
 * - id: 唯一标识
 * - name: 名称
 * - baseCost: 基础招募成本（同时也是首次升级成本）
 * - damage: 基础伤害
 * - attackInterval: 攻击间隔（秒）
 * - description: 描述
 * - icon: 图标（像素风格emoji）
 * - category: 分类 (basic/iron/magic/holy/ancient/legend)
 * 
 * 价格设计原则：baseCost ≈ damage × 1.5~3 (越稀有倍率越高)
 */
const MERCENARIES_DATA = [
    // ==================== 基础系 (Basic) ====================
    // 最容易获得的单位，价格倍率约1.5~2倍
    {
        id: 'warrior',
        name: '战士',
        baseCost: 15,
        damage: 10,
        attackInterval: 1.0,
        description: '基础近战单位，攻击稳定',
        icon: '⚔️',
        category: 'basic'
    },
    {
        id: 'archer',
        name: '弓箭手',
        baseCost: 600,
        damage: 400,
        attackInterval: 1.5,
        description: '远程攻击，伤害较高',
        icon: '🏹',
        category: 'basic'
    },
    {
        id: 'royal_guard',
        name: '皇家侍卫',
        baseCost: 1800,
        damage: 1000,
        attackInterval: 0.8,
        description: '忠诚的皇家护卫，攻速极快',
        icon: '💂',
        category: 'basic'
    },

    // ==================== 钢铁系 (Iron) ====================
    // 重甲战士，价格倍率约1.8~2倍
    {
        id: 'iron_soldier',
        name: '钢铁士兵',
        baseCost: 5000,
        damage: 2800,
        attackInterval: 1.3,
        description: '铁甲战士，攻击有概率触发钢铁拳',
        icon: '🤖',
        category: 'iron'
    },
    {
        id: 'knight',
        name: '骑士',
        baseCost: 18000,
        damage: 10000,
        attackInterval: 1.2,
        description: '重装骑兵，攻守兼备',
        icon: '🛡️',
        category: 'iron'
    },
    {
        id: 'berserker',
        name: '狂战士',
        baseCost: 65000,
        damage: 35000,
        attackInterval: 0.6,
        description: 'Boss血量越低攻击越高，疯狂的战争机器',
        icon: '🪓',
        category: 'iron'
    },

    // ==================== 魔法系 (Magic) ====================
    // 法术单位，价格倍率约2倍
    {
        id: 'mage',
        name: '法师',
        baseCost: 4000,
        damage: 2200,
        attackInterval: 2.0,
        description: '魔法攻击，有几率提升全队攻速',
        icon: '🔮',
        category: 'magic'
    },
    {
        id: 'night_swordsman',
        name: '夜剑客',
        baseCost: 16000,
        damage: 8000,
        attackInterval: 0.9,
        description: '暗夜中的刺客，暴击率极高',
        icon: '🗡️',
        category: 'magic'
    },
    {
        id: 'ice_daughter',
        name: '冰之女儿',
        baseCost: 40000,
        damage: 20000,
        attackInterval: 2.2,
        description: '冰霜女王的后裔，使Boss受到更多伤害',
        icon: '❄️',
        category: 'magic'
    },
    {
        id: 'necromancer',
        name: '亡灵法师',
        baseCost: 120000,
        damage: 55000,
        attackInterval: 2.8,
        description: '召唤亡灵军团协助攻击',
        icon: '💀',
        category: 'magic'
    },

    // ==================== 圣洁系 (Holy) ====================
    // 神圣单位，价格倍率约2~2.5倍
    {
        id: 'priest',
        name: '圣职者',
        baseCost: 80000,
        damage: 35000,
        attackInterval: 2.5,
        description: '神圣之力，为全队提供永久伤害光环',
        icon: '⛪',
        category: 'holy'
    },
    {
        id: 'dragon',
        name: '龙骑士',
        baseCost: 200000,
        damage: 85000,
        attackInterval: 2.5,
        description: '传说中的龙骑士，积蓄龙魂释放毁灭龙息',
        icon: '🐉',
        category: 'holy'
    },
    {
        id: 'angel',
        name: '天使',
        baseCost: 500000,
        damage: 200000,
        attackInterval: 1.8,
        description: '光明使者，造成Boss最大血量百分比伤害',
        icon: '👼',
        category: 'holy'
    },

    // ==================== 远古系 (Ancient) ====================
    // 上古存在，价格倍率约2.5倍
    {
        id: 'time_walker',
        name: '时光行者',
        baseCost: 800000,
        damage: 320000,
        attackInterval: 1.5,
        description: '穿越时空的旅者，使全队下次攻击翻倍',
        icon: '⏳',
        category: 'ancient'
    },
    {
        id: 'void_lord',
        name: '虚空领主',
        baseCost: 1200000,
        damage: 450000,
        attackInterval: 2.0,
        description: '来自虚空的存在，造成Boss当前血量百分比伤害',
        icon: '🌌',
        category: 'ancient'
    },
    {
        id: 'phoenix',
        name: '不死鸟',
        baseCost: 1800000,
        damage: 680000,
        attackInterval: 2.2,
        description: '浴火重生，周期性释放超高倍伤害',
        icon: '🔥',
        category: 'ancient'
    },

    // ==================== 传说系 (Legend) ====================
    // 终极单位，价格倍率约2.5~3倍
    {
        id: 'legend',
        name: '传说',
        baseCost: 3000000,
        damage: 1000000,
        attackInterval: 3.0,
        description: '全能的传说，升级攻击力同时提升攻速',
        icon: '👑',
        category: 'legend'
    },
    {
        id: 'chaos_emperor',
        name: '混沌帝王',
        baseCost: 8000000,
        damage: 2800000,
        attackInterval: 3.5,
        description: '混沌的化身，攻击间隔越长伤害越高',
        icon: '🌀',
        category: 'legend'
    },
    {
        id: 'sacred_dragon',
        name: '神圣巨龙',
        baseCost: 25000000,
        damage: 8000000,
        attackInterval: 4.0,
        description: '最终的守护者，拥有全队增伤+暴击的终极技能',
        icon: '✨',
        category: 'legend'
    }
];

/**
 * 初始化佣兵数据
 * @returns {Array} - 佣兵数组
 */
function initMercenaries() {
    return MERCENARIES_DATA.map(merc => ({
        ...merc,
        recruited: false,        // 是否已雇佣
        damageLevel: 0,          // 攻击力升级等级
        intervalLevel: 0,        // 攻击间隔升级等级
        currentDamage: merc.damage,           // 当前伤害
        currentInterval: merc.attackInterval, // 当前攻击间隔
        totalDamage: 0          // 总伤害贡献
    }));
}

/**
 * 根据ID获取佣兵数据
 * @param {string} id - 佣兵ID
 * @returns {Object|null} - 佣兵数据
 */
function getMercenaryById(id) {
    return MERCENARIES_DATA.find(merc => merc.id === id) || null;
}

module.exports = {
    MERCENARIES_DATA,
    initMercenaries,
    getMercenaryById
};
