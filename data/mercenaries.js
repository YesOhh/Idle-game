// data/mercenaries.js - 佣兵数据定义

/**
 * MVP版本佣兵列表
 * 每个佣兵包含：
 * - id: 唯一标识
 * - name: 名称
 * - baseCost: 基础招募成本
 * - damage: 基础伤害
 * - attackInterval: 攻击间隔（秒）
 * - description: 描述
 * - icon: 图标（像素风格emoji）
 */
const MERCENARIES_DATA = [
    {
        id: 'warrior',
        name: '战士',
        baseCost: 10,
        damage: 10,
        attackInterval: 1.0,
        description: '基础近战单位，攻击稳定',
        icon: '⚔️'
    },
    {
        id: 'archer',
        name: '弓箭手',
        baseCost: 500,
        damage: 400,
        attackInterval: 1.5,
        description: '远程攻击，伤害较高',
        icon: '🏹'
    },
    {
        id: 'mage',
        name: '法师',
        baseCost: 2000,
        damage: 2000,
        attackInterval: 2.0,
        description: '魔法攻击，伤害巨大',
        icon: '🔮'
    },
    {
        id: 'knight',
        name: '骑士',
        baseCost: 8000,
        damage: 10000,
        attackInterval: 1.2,
        description: '重装骑兵，攻守兼备',
        icon: '🛡️'
    },
    {
        id: 'dragon',
        name: '龙骑士',
        baseCost: 50000,
        damage: 80000,
        attackInterval: 2.5,
        description: '传说中的龙骑士，毁天灭地',
        icon: '🐉'
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
