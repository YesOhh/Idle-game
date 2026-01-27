// data/mercenaries.js - 佣兵数据定义

/**
 * 佣兵列表 - 参考《打BOSS》设计
 * 
 * 设计规律（来自原版数据分析）：
 * 1. 雇佣价格 = 基础攻击力 × 30~50（初期30倍，后期递增到更高）
 * 2. 首次升级价格 = 雇佣价格 / 2
 * 3. 升级价格增长率 = 1.15 (每级是上一级的1.15倍)
 * 4. 攻击间隔范围 = 2.7~6.7秒（平均约4秒）
 * 5. 升级效果 = 每5级增加约50%
 */
const MERCENARIES_DATA = [
    // ==================== 基础系 (Basic) ====================
    // 价格倍率 ~30x
    {
        id: 'player',
        name: '玩家',
        baseCost: 0,             // 默认雇佣，无需购买
        damage: 1,
        attackInterval: 4.0,
        description: '其实他就是你的缩影',
        icon: '🧑',
        category: 'basic',
        hired: true              // 默认已雇佣
    },
    {
        id: 'warrior',
        name: '战士',
        baseCost: 40,            // 5 x 8
        damage: 5,
        attackInterval: 4.3,
        description: '基础近战单位，攻击稳定',
        icon: '⚔️',
        category: 'basic'
    },
    {
        id: 'archer',
        name: '弓箭手',
        baseCost: 100,           // 10 x 10
        damage: 10,
        attackInterval: 3.5,
        description: '远程攻击，伤害较高',
        icon: '🏹',
        category: 'basic'
    },
    {
        id: 'royal_guard',
        name: '皇家侍卫',
        baseCost: 1200,          // 100 x 12
        damage: 100,
        attackInterval: 3.6,
        description: '忠诚的皇家护卫，攻击稳定',
        icon: '💂',
        category: 'basic'
    },

    // ==================== 钢铁系 (Iron) ====================
    // 价格倍率 ~50-90x
    {
        id: 'iron_soldier',
        name: '钢铁士兵',
        baseCost: 57000,         // 1900 x 30
        damage: 1900,
        attackInterval: 3.5,
        description: '铁甲战士，攻击有概率触发钢铁拳',
        icon: '🤖',
        category: 'iron'
    },
    {
        id: 'knight',
        name: '骑士',
        baseCost: 1160000,       // 29000 x 40
        damage: 29000,
        attackInterval: 3.5,
        description: '重装骑兵，攻守兼备',
        icon: '🛡️',
        category: 'iron'
    },
    {
        id: 'berserker',
        name: '狂战士',
        baseCost: 14500000,      // 290000 x 50
        damage: 290000,
        attackInterval: 2.7,
        description: 'Boss血量越低攻击越高，疯狂的战争机器',
        icon: '🪓',
        category: 'iron'
    },

    // ==================== 魔法系 (Magic) ====================
    // 价格倍率 ~40-160x
    {
        id: 'mage',
        name: '法师',
        baseCost: 9600,          // 160 x 60
        damage: 160,
        attackInterval: 3.4,
        description: '魔法攻击，有几率提升全队攻速',
        icon: '🔮',
        category: 'magic'
    },
    {
        id: 'night_swordsman',
        name: '夜剑客',
        baseCost: 184000,        // 2300 x 80
        damage: 2300,
        attackInterval: 3.2,
        description: '暗夜中的刺客，暴击率极高',
        icon: '🗡️',
        category: 'magic'
    },
    {
        id: 'ice_daughter',
        name: '冰女',
        baseCost: 3300000,       // 33000 x 100
        damage: 33000,
        attackInterval: 3.0,
        description: '冰霜女王的后裔，使Boss受到更多伤害',
        icon: '❄️',
        category: 'magic'
    },
    {
        id: 'necromancer',
        name: '亡灵法师',
        baseCost: 72000000,      // 480000 x 150
        damage: 480000,
        attackInterval: 3.1,
        description: '召唤亡灵军团协助攻击',
        icon: '💀',
        category: 'magic'
    },

    // ==================== 圣洁系 (Holy) ====================
    // 价格倍率 ~3000-8000x
    {
        id: 'priest',
        name: '圣职者',
        baseCost: 1500000000,    // 5000000 x 300
        damage: 5000000,
        attackInterval: 4.0,
        description: '神圣之力，为全队提供永久伤害光环',
        icon: '⛪',
        category: 'holy'
    },
    {
        id: 'dragon',
        name: '龙骑士',
        baseCost: 37000000000,   // 74000000 x 500
        damage: 74000000,
        attackInterval: 4.1,
        description: '传说中的龙骑士，积蓄龙魂释放毁灭龙息',
        icon: '🐉',
        category: 'holy'
    },
    {
        id: 'angel',
        name: '天使',
        baseCost: 93800000000,   // 134000000 x 700
        damage: 134000000,
        attackInterval: 3.5,
        description: '光明使者，造成Boss最大血量百分比伤害',
        icon: '👼',
        category: 'holy'
    },

    // ==================== 远古系 (Ancient) ====================
    // 价格倍率 ~8000-14000x
    {
        id: 'time_walker',
        name: '时光',
        baseCost: 123000000000,  // 123000000 x 1000
        damage: 123000000,
        attackInterval: 4.0,
        description: '穿越时空的旅者，使全队下次攻击翻倍',
        icon: '⏳',
        category: 'ancient'
    },
    {
        id: 'void_lord',
        name: '虚空',
        baseCost: 2160000000000, // 1800000000 x 1200
        damage: 1800000000,
        attackInterval: 3.5,
        description: '来自虚空的存在，造成Boss当前血量百分比伤害',
        icon: '🌌',
        category: 'ancient'
    },
    {
        id: 'phoenix',
        name: '凤凰',
        baseCost: 2850000000000, // 1900000000 x 1500
        damage: 1900000000,
        attackInterval: 5.0,
        description: '浴火重生，周期性释放超高倍伤害',
        icon: '🔥',
        category: 'ancient'
    },

    // ==================== 传说系 (Legend) ====================
    // 最终单位，价格极高
    {
        id: 'legend',
        name: '传说',
        baseCost: 10000000000000, // 5000000000 x 2000
        damage: 5000000000,
        attackInterval: 4.5,
        description: '全能的传说，升级攻击力同时提升攻速',
        icon: '👑',
        category: 'legend'
    },
    {
        id: 'chaos_emperor',
        name: '混沌',
        baseCost: 33000000000000, // 15000000000 x 2200
        damage: 15000000000,
        attackInterval: 5.5,
        description: '混沌的化身，攻击间隔越长伤害越高',
        icon: '🌀',
        category: 'legend'
    },
    {
        id: 'sacred_dragon',
        name: '无极',
        baseCost: 125000000000000, // 50000000000 x 2500
        damage: 50000000000,
        attackInterval: 6.0,
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
        recruited: merc.hired || false,  // 如果数据中标记hired=true则默认已雇佣
        damageLevel: 0,          // 攻击力升级等级（初始为0，未升级过）
        intervalLevel: 0,        // 攻击间隔升级等级（初始为0，未升级过）
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
