// pages/battle/battle.js
const app = getApp();
const gameEngine = require('../../utils/gameEngine.js');

Page({
    data: {
        boss: {
            level: 1,
            currentHp: 100,
            maxHp: 100
        },
        bossHpPercent: 100,
        bossHpText: '100 / 100',

        goldText: '0',
        manualDamageText: '1',
        dpsText: '0',
        upgradeClickCostText: '10',

        damageNumbers: [],
        damageNumberId: 0,
        attacking: false,

        // 佣兵列表
        mercenaries: [],

        // 佣兵展开状态
        expandedMercIds: {},

        // 离线收益
        showOfflineModal: false,
        offlineTimeText: '',
        offlineGoldText: '',
        offlineBossesText: '',

        // 自动攻击定时器
        autoAttackTimer: null,

        // 遗物选择
        showRelicModal: false,
        relicChoices: [],
        // 兑换码
        redemptionCode: '',

        // 我的圣物展示
        showMyRelicsModal: false,
        myRelics: [],
        relicBonusSummary: null,

        // 战况统计相关
        showStatsModal: false,
        bossStats: [], // { level, name, timeTaken }
        totalTimeSeconds: 0,

        // 自动化测试相关
        upgradeTypes: [
            { id: 'damage', label: '⚔️ 攻击' },
            { id: 'interval', label: '⚡ 攻速' }
        ],
        autoUpgradeEnabled: false,
        autoUpgradeMercId: '',
        autoUpgradeMercName: '',
        autoUpgradeType: 'damage',
        autoUpgradeTypeLabel: '⚔️ 攻击',

        // Tab切换（通过底部tabBar控制）
        currentTab: 'battle',  // 'battle' | 'manage'

        // 佣兵管理相关
        manageMercenaries: [],
        manageMercRows: [],
        selectedMercId: null,
        selectedMerc: null,
        selectedRowIndex: -1,

        // Boss动画
        bossAnimation: null,

        // 伤害飘字开关
        showDamageNumbers: true
    },

    onLoad() {
        // 加载飘字开关设置
        const savedShowDamageNumbers = wx.getStorageSync('showDamageNumbers');
        if (savedShowDamageNumbers !== '') {
            this.setData({ showDamageNumbers: savedShowDamageNumbers });
        }

        this.initGame();
        // 订阅全局战斗更新
        this.subscribeToBattleUpdates();
        // 记录第一个Boss的开始时间
        this.data.currentBossStartTime = Date.now();
    },

    onUnload() {
        // 取消订阅
        app.unsubscribeBattleUpdate();
        // 清理缓存的各种 Buff 定时器
        if (this._globalSpeedTimer) clearTimeout(this._globalSpeedTimer);
        if (this._globalDamageTimer) clearTimeout(this._globalDamageTimer);
    },

    onHide() {
        // 页面隐藏时不再停止战斗，因为战斗在全局进行
        // 只需要停止UI更新定时器
        this.stopUITimer();
    },

    onShow() {
        // 恢复UI更新
        this.startUITimer();
        // 同步buff状态
        const buffState = app.getBuffState();
        this.setData({
            isSpeedBuffActive: buffState.speedBuffActive,
            isDamageBuffActive: buffState.damageBuffActive
        });
        this.updateDisplay();
    },

    // 订阅全局战斗更新
    subscribeToBattleUpdates() {
        app.subscribeBattleUpdate((data) => {
            this.handleBattleUpdate(data);
        });
        // 启动UI更新定时器
        this.startUITimer();
    },

    // 处理战斗更新事件
    handleBattleUpdate(data) {
        // 佣兵普通攻击伤害飘字
        if (data.mercDamage && this.data.showDamageNumbers) {
            const type = data.mercDamage.isCrit ? 'crit' : 'normal';
            this.showDamageNumber(data.mercDamage.damage, null, type);
        }
        // 技能飘字
        if (data.skill && this.data.showDamageNumbers) {
            this.showDamageNumber(data.skill.text, null, this.getSkillClass(data.skill.type));
        }
        if (data.buffChanged) {
            const buffState = app.getBuffState();
            this.setData({
                isSpeedBuffActive: buffState.speedBuffActive,
                isDamageBuffActive: buffState.damageBuffActive
            });
            this.updateDisplay(true);
        }
        if (data.statsChanged) {
            this.updateBattleStats();
        }
        if (data.bossDefeated) {
            if (data.showRelicModal) {
                // 通关，显示遗物选择
                const choices = gameEngine.getRandomRelicChoices();
                this.setData({
                    showRelicModal: true,
                    relicChoices: choices
                });
                // 记录Boss统计
                this.recordBossStat(data.bossLevel);
            } else {
                // 普通击败Boss
                wx.showToast({
                    title: `Boss击败!`,
                    icon: 'success',
                    duration: 1000
                });
                this.recordBossStat(data.bossLevel);
                this.updateDisplay(true);
            }
        }
    },

    // 记录Boss统计
    recordBossStat(level) {
        const endTime = Date.now();
        const startTime = this.data.currentBossStartTime || endTime;
        const timeTaken = Math.floor((endTime - startTime) / 1000);

        const newStat = {
            level: level,
            name: app.globalData.boss ? app.globalData.boss.name : `Boss ${level}`,
            timeTaken: timeTaken
        };

        const bossStats = [...(this.data.bossStats || []), newStat];
        const totalTimeSeconds = (this.data.totalTimeSeconds || 0) + timeTaken;

        this.setData({
            bossStats,
            totalTimeSeconds,
            currentBossStartTime: Date.now()
        });
    },

    // 获取技能样式类名
    getSkillClass(skillType) {
        const classMap = {
            'stacking_buff': 'skill',
            'crit': 'skill-crit',
            'speed_buff': 'skill-mage',
            'damage_buff': 'skill-dragon',
            'combo': 'skill-combo',
            'burn': 'skill-burn',
            'chaos': 'skill-chaos',
            'time_burst': 'skill-time',
            'gold': 'skill-gold',
            'team_buff': 'skill-royal',
            'teaching': 'skill-royal',
            'iron_fist': 'skill-iron',
            'freeze': 'skill-freeze',
            'summon': 'skill-summon',
            'holy': 'skill-holy',
            'void': 'skill-void',
            'phoenix': 'skill-phoenix',
            'ultimate': 'skill-ultimate'
        };
        return classMap[skillType] || 'skill';
    },

    // 获取系别信息
    getCategoryInfo(category) {
        const categoryMap = {
            'basic': { name: '基础系', icon: '⭐', color: '#95a5a6' },
            'iron': { name: '钢铁系', icon: '⚙️', color: '#7f8c8d' },
            'magic': { name: '魔法系', icon: '✨', color: '#9b59b6' },
            'holy': { name: '圣洁系', icon: '☀️', color: '#f1c40f' },
            'ancient': { name: '远古系', icon: '🌀', color: '#1abc9c' },
            'legend': { name: '传说系', icon: '👑', color: '#e74c3c' }
        };
        return categoryMap[category] || { name: '未知', icon: '❓', color: '#bdc3c7' };
    },

    // 启动UI更新定时器
    startUITimer() {
        this.stopUITimer();
        this.data.uiTimer = setInterval(() => {
            this.updateMercenaryList();
        }, 500);
    },

    // 停止UI更新定时器
    stopUITimer() {
        if (this.data.uiTimer) {
            clearInterval(this.data.uiTimer);
            this.data.uiTimer = null;
        }
    },

    // 初始化游戏
    initGame() {
        const globalData = app.globalData;

        // 处理离线收益
        if (globalData.offlineSeconds && globalData.offlineSeconds > 60) {
            this.processOfflineProgress(globalData.offlineSeconds);
        }

        // 初始化/同步佣兵数据
        const mercData = require('../../data/mercenaries.js');
        const defaultMercs = mercData.initMercenaries();

        if (!globalData.mercenaries || globalData.mercenaries.length === 0) {
            globalData.mercenaries = defaultMercs;
        } else {
            // 数据迁移与同步：合并新英雄与由于数据更新导致的属性变化
            defaultMercs.forEach(defaultMerc => {
                const existingMerc = globalData.mercenaries.find(m => m.id === defaultMerc.id);
                if (!existingMerc) {
                    // 如果存档中没有这个英雄（比如新出的传说），则添加进去
                    globalData.mercenaries.push(defaultMerc);
                    console.log(`同步新英雄: ${defaultMerc.name}`);
                } else {
                    // 强制同步基础配置属性 (成本、基础伤害、基础攻速、图标、描述)
                    // 这样即使存档里存了旧的 25w，也会被强制更新为新的 200w
                    existingMerc.baseCost = defaultMerc.baseCost;
                    existingMerc.damage = defaultMerc.damage;
                    existingMerc.attackInterval = defaultMerc.attackInterval;
                    existingMerc.icon = defaultMerc.icon;
                    existingMerc.description = defaultMerc.description;
                }
            });

            // 统一检查迁移字段
            globalData.mercenaries.forEach(merc => {
                if (merc.recruited === undefined) {
                    merc.recruited = (merc.count > 0);
                }
                // 等级初始为0（未升级过）
                if (merc.damageLevel === undefined) merc.damageLevel = 0;
                if (merc.intervalLevel === undefined) merc.intervalLevel = 0;

                // 实时重算当前显示数值，确保算法更新后数值同步
                const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
                merc._prestigeSpeedBuff = prestigeBonus.speed; // 设置永久攻速加成

                merc.currentDamage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
                merc.currentInterval = gameEngine.calculateUpgradedInterval(merc);

                // 同步玩家单位的点击伤害（长大技能）
                if (merc.id === 'player' && merc.recruited) {
                    globalData.player.manualDamage = merc.currentDamage;
                }
            });
        }

        this.updateDisplay();
    },

    // 处理离线收益
    processOfflineProgress(offlineSeconds) {
        const globalData = app.globalData;
        const dps = gameEngine.calculateTotalDPS(globalData.mercenaries);

        if (dps > 0) {
            const offlineResult = gameEngine.calculateOfflineProgress(
                dps,
                offlineSeconds,
                globalData.boss.level,
                globalData.boss.currentHp  // 传入当前Boss的剩余血量
            );

            // 应用离线收益
            globalData.player.gold += offlineResult.gold;

            // 如果击败了Boss，创建新的Boss
            if (offlineResult.bossesDefeated > 0) {
                const newBoss = gameEngine.nextBoss(offlineResult.newLevel - 1);
                globalData.boss = newBoss;
            }

            // 扣除当前Boss的剩余伤害
            if (offlineResult.remainingDamage > 0) {
                globalData.boss.currentHp = Math.max(0, globalData.boss.currentHp - offlineResult.remainingDamage);
            }

            // 显示离线收益弹窗
            const hours = Math.floor(offlineSeconds / 3600);
            const minutes = Math.floor((offlineSeconds % 3600) / 60);

            this.setData({
                showOfflineModal: true,
                offlineTimeText: `${hours}小时${minutes}分钟`,
                offlineGoldText: gameEngine.formatNumber(offlineResult.gold),
                offlineBossesText: offlineResult.bossesDefeated.toString()
            });
        }
    },

    // 更新战斗统计信息（高频：HP、金币）
    updateBattleStats(force = false) {
        // 性能优化：节流，每 150ms 最多真实更新一次 UI，除非 force 为 true
        const now = Date.now();
        if (!force && this._lastStatsUpdateTime && now - this._lastStatsUpdateTime < 150) {
            return;
        }
        this._lastStatsUpdateTime = now;

        const globalData = app.globalData;
        const boss = globalData.boss;
        const player = globalData.player;

        const hpPercent = (boss.maxHp > 0) ? (boss.currentHp / boss.maxHp) * 100 : 0;

        const prestigeBonus = gameEngine.calculatePrestigeBonus(player);
        const dps = gameEngine.calculateTotalDPS(
            globalData.mercenaries,
            this.data._globalDamageBuff || 0,
            this.data._globalSpeedBuff || 0,
            prestigeBonus.damage
        );

        // 计算下一级点击成本
        const nextClickCost = Math.floor(10 * Math.pow(1.5, player.manualDamage) * prestigeBonus.costReduction);

        this.setData({
            boss: boss,
            bossHpPercent: hpPercent,
            bossHpText: gameEngine.formatNumber(boss.currentHp),
            goldText: gameEngine.formatNumber(player.gold),
            dpsText: gameEngine.formatNumber(dps),
            manualDamageText: gameEngine.formatNumber(player.manualDamage * prestigeBonus.damage),
            upgradeClickCostText: gameEngine.formatNumber(nextClickCost),
            prestigeCount: player.prestigeCount || 0
        });
    },

    // 更新佣兵列表状态（低频：按钮状态、列表渲染）
    updateMercenaryList() {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const expandedMercIds = this.data.expandedMercIds || {};

        // 格式化佣兵数据
        const mercenaries = globalData.mercenaries.map(merc => {
            const recruitCost = gameEngine.calculateRecruitCost(merc);

            // 同步最新的圣物攻速加成
            merc._prestigeSpeedBuff = prestigeBonus.speed;

            // 获取基础值与显示文本 (Base + Bonus)
            const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
            let currentDamage = dmgInfo.final;
            let currentInterval = gameEngine.calculateUpgradedInterval(merc);

            // 应用全局Buff展示
            if (this.data._globalDamageBuff) {
                currentDamage *= (1 + this.data._globalDamageBuff);
            }
            if (this.data._globalSpeedBuff) {
                currentInterval *= (1 - this.data._globalSpeedBuff);
            }

            const mercDPS = merc.recruited ? (currentDamage / currentInterval) : 0;
            const canAfford = !merc.recruited && globalData.player.gold >= recruitCost;

            // 计算升级成本
            const upgradeCost = gameEngine.calculateMercenaryUpgradeCost(merc, prestigeBonus.costReduction);
            const canAffordUpgrade = merc.recruited && globalData.player.gold >= upgradeCost;

            // 获取技能信息
            let skillInfo = gameEngine.getMercenarySkillDisplay(merc);
            // 添加技能简称用于标签显示
            if (skillInfo && skillInfo.name) {
                // 从【xxx】+【xxx】格式提取第一个简称
                const match = skillInfo.name.match(/【(.+?)】/);
                skillInfo.shortName = match ? match[1] : skillInfo.name;
                // 处理第二个技能
                if (skillInfo.skill2 && skillInfo.skill2.name) {
                    const match2 = skillInfo.skill2.name.match(/【(.+?)】/);
                    skillInfo.skill2.shortName = match2 ? match2[1] : skillInfo.skill2.name;
                }
            }

            // 计算升级效果预览 - 模拟升级后的数值
            // 攻击力：创建临时对象模拟升级后的状态
            const tempMercDamage = { ...merc, damageLevel: (merc.damageLevel || 0) + 1 };
            const nextDmgInfo = gameEngine.getDamageDisplayInfo(tempMercDamage, prestigeBonus.damage);
            const damageUpgradeEffect = nextDmgInfo.final - dmgInfo.final;

            // 攻击间隔：每级减少当前攻速的1%
            // 计算方式：下一级攻速 = 当前攻速 * 0.99，所以减少量 = 当前攻速 * 0.01
            const intervalUpgradeEffect = (currentInterval * 0.01).toFixed(4);

            // 总等级 = 攻击等级 + 攻速等级 + 1（雇佣时初始等级为1）
            const totalLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;

            // 获取系别信息
            const categoryInfo = this.getCategoryInfo(merc.category);

            return {
                ...merc,
                costText: merc.recruited ? '已雇佣' : gameEngine.formatNumber(recruitCost),
                dpsText: gameEngine.formatNumber(mercDPS),
                damageText: gameEngine.formatNumber(currentDamage),
                intervalText: currentInterval.toFixed(4),
                baseDamage: merc.damage,
                baseInterval: merc.attackInterval,
                totalLevel,
                canAfford,
                recruited: merc.recruited,
                expanded: expandedMercIds[merc.id] || false,
                upgradeCostText: gameEngine.formatNumber(upgradeCost),
                canAffordUpgrade,
                skillInfo,
                categoryInfo,
                damageUpgradeEffect: gameEngine.formatNumber(damageUpgradeEffect),
                intervalUpgradeEffect
            };
        }).filter(merc => merc.recruited);  // 只显示已雇佣的佣兵

        // 只有当数据真正变化时才调用setData
        const currentJson = JSON.stringify(mercenaries);
        if (currentJson !== this.data._lastMercenariesJson) {
            this.setData({
                mercenaries: mercenaries
            });
            this.data._lastMercenariesJson = currentJson;
        }
    },

    // 综合更新（用于初始化或重要事件）
    updateDisplay(force = false) {
        this.updateBattleStats(force);
        this.updateMercenaryList();
        this.updateManageMercenaryList();
    },

    // 更新佣兵管理列表（全部佣兵，按行分组）
    updateManageMercenaryList() {
        const globalData = app.globalData;
        if (!globalData.mercenaries) return;

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);

        // 格式化所有佣兵数据（包括未招募的）
        let manageMercenaries = globalData.mercenaries.map(merc => {
            const recruitCost = gameEngine.calculateRecruitCost(merc);
            const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
            const currentDamage = dmgInfo.final;
            const currentInterval = gameEngine.calculateUpgradedInterval(merc);

            // 获取技能信息
            let skillInfo = gameEngine.getMercenarySkillDisplay(merc);
            if (skillInfo && skillInfo.name) {
                const match = skillInfo.name.match(/【(.+?)】/);
                skillInfo.shortName = match ? match[1] : skillInfo.name;
                // 处理第二个技能
                if (skillInfo.skill2 && skillInfo.skill2.name) {
                    const match2 = skillInfo.skill2.name.match(/【(.+?)】/);
                    skillInfo.skill2.shortName = match2 ? match2[1] : skillInfo.skill2.name;
                }
            }

            return {
                ...merc,
                recruitCost,
                currentDamageText: gameEngine.formatNumber(currentDamage),
                currentInterval: currentInterval.toFixed(4),
                recruitCostText: gameEngine.formatNumber(recruitCost),
                canAffordRecruit: !merc.recruited && globalData.player.gold >= recruitCost,
                skillInfo
            };
        });

        // 按价格从低到高排序
        manageMercenaries.sort((a, b) => a.recruitCost - b.recruitCost);

        // 每行3个，分组
        const ITEMS_PER_ROW = 3;
        const manageMercRows = [];
        for (let i = 0; i < manageMercenaries.length; i += ITEMS_PER_ROW) {
            manageMercRows.push({
                rowIndex: Math.floor(i / ITEMS_PER_ROW),
                items: manageMercenaries.slice(i, i + ITEMS_PER_ROW)
            });
        }

        // 更新选中的佣兵信息
        let selectedMerc = null;
        if (this.data.selectedMercId) {
            selectedMerc = manageMercenaries.find(m => m.id === this.data.selectedMercId);
        }

        this.setData({
            manageMercenaries,
            manageMercRows,
            selectedMerc
        });
    },

    // 选择佣兵（管理tab）
    onSelectMerc(e) {
        const mercId = e.currentTarget.dataset.id;
        const manageMercenaries = this.data.manageMercenaries;

        // 找到该佣兵所在的行
        const mercIndex = manageMercenaries.findIndex(m => m.id === mercId);
        const ITEMS_PER_ROW = 3;
        const rowIndex = Math.floor(mercIndex / ITEMS_PER_ROW);

        // 如果点击的是同一个，取消选择
        if (this.data.selectedMercId === mercId) {
            this.setData({
                selectedMercId: null,
                selectedMerc: null,
                selectedRowIndex: -1
            });
        } else {
            const selectedMerc = manageMercenaries.find(m => m.id === mercId);
            this.setData({
                selectedMercId: mercId,
                selectedMerc,
                selectedRowIndex: rowIndex
            });
        }
    },

    // 在管理页面招募佣兵
    onManageRecruitMercenary(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || mercenary.recruited) {
            return;
        }

        const cost = gameEngine.calculateRecruitCost(mercenary);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.recruited = true;

            wx.showToast({
                title: '招募成功!',
                icon: 'success'
            });

            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 点击Boss
    onTapBoss(e) {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        let damage = globalData.player.manualDamage * prestigeBonus.damage;
        let isCrit = false;

        // 全局暴击判定 (来自圣物)
        if (prestigeBonus.critChance > 0 && Math.random() < prestigeBonus.critChance) {
            const mult = 2.0 + (prestigeBonus.critMult || 0); // 基础暴击2倍
            damage *= mult;
            isCrit = true;
        }

        this.dealDamage(damage);
        this.showDamageNumber(damage, e, isCrit ? 'crit' : '');

        // 使用微信animation API实现Boss动画
        this.playBossHitAnimation();
    },

    // Boss受击动画
    playBossHitAnimation() {
        const animation = wx.createAnimation({
            duration: 50,
            timingFunction: 'ease-out'
        });

        // 缩小并左移
        animation.scale(0.9).translateX(-8).step();
        // 右移
        animation.scale(0.95).translateX(8).step({ duration: 50 });
        // 回到原位
        animation.scale(1).translateX(0).step({ duration: 50 });

        this.setData({
            bossAnimation: animation.export()
        });
    },

    // 造成伤害
    dealDamage(damage) {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const result = gameEngine.dealDamageToBoss(globalData.boss, damage, prestigeBonus.gold);

        globalData.boss = result.boss;
        globalData.player.totalDamage += damage;

        // 造成伤害即获得金币 (已在 dealDamageToBoss 中应用 goldMult)
        globalData.player.gold += result.goldEarned;

        if (result.defeated) {
            this.onBossDefeated();
        } else {
            // 仅更新HP和金币，不更新整个列表
            this.updateBattleStats();
        }
    },

    // Boss被击败
    onBossDefeated() {
        const globalData = app.globalData;
        const currentLevel = globalData.boss.level;
        globalData.boss.defeated++;

        // 记录时间统计
        const endTime = Date.now();
        const startTime = this.data.currentBossStartTime || endTime;
        const timeTaken = Math.floor((endTime - startTime) / 1000);

        const newStat = {
            level: currentLevel,
            name: globalData.boss.name,
            timeTaken: timeTaken
        };

        const bossStats = [...(this.data.bossStats || []), newStat];
        const totalTimeSeconds = (this.data.totalTimeSeconds || 0) + timeTaken;

        this.setData({
            bossStats,
            totalTimeSeconds,
            currentBossStartTime: endTime // 为下一个Boss重置开始时间
        });

        // 检查是否通关 (击败 12 号 Boss)
        if (currentLevel === 12) {
            app.pauseGlobalBattle();

            // 生成 3 个随机遗物
            const choices = gameEngine.getRandomRelicChoices();
            this.setData({
                showRelicModal: true,
                relicChoices: choices
            });
            return;
        }

        // 进入下一个Boss
        const newBoss = gameEngine.nextBoss(currentLevel);
        globalData.boss = newBoss;

        wx.showToast({
            title: `Boss击败!`,
            icon: 'success',
            duration: 1000
        });

        // Boss击败时可以做一次全量更新 (强制刷新以确保视觉一致)
        this.updateDisplay(true);
    },

    // 触发重生
    onPrestige(selectedRelic) {
        const globalData = app.globalData;
        globalData.player.prestigeCount = (globalData.player.prestigeCount || 0) + 1;

        // 添加选中的遗物
        if (selectedRelic) {
            if (!globalData.player.relics) globalData.player.relics = [];

            // 检查是否已有同名圣物
            const existingRelic = globalData.player.relics.find(r => r.id === selectedRelic.id);
            if (existingRelic) {
                existingRelic.level = (existingRelic.level || 1) + 1;
            } else {
                selectedRelic.level = 1;
                globalData.player.relics.push(selectedRelic);
            }
        }

        // 调用 app.js 的初始化方法重置变量，但保留永久加成
        app.initNewGame(true);

        // 重载基础佣兵数据
        const mercData = require('../../data/mercenaries.js');
        app.globalData.mercenaries = mercData.initMercenaries();

        // 重新初始化并显示
        this.initGame();
        app.resumeGlobalBattle(); // 恢复全局战斗
        this.updateDisplay();

        wx.showToast({
            title: `开启第 ${globalData.player.prestigeCount + 1} 周目!`,
            icon: 'none',
            duration: 2000
        });
    },

    // 选择遗物
    onSelectRelic(e) {
        const index = e.currentTarget.dataset.index;
        if (!this.data.relicChoices || !this.data.relicChoices[index]) {
            console.error('Relic choices not found at index:', index);
            this.setData({ showRelicModal: false });
            return;
        }
        const selectedRelic = this.data.relicChoices[index];

        this.setData({ showRelicModal: false });
        this.onPrestige(selectedRelic);
    },

    // 显示伤害数字
    showDamageNumber(damage, e, type = '') {
        if (!this.data.showDamageNumbers) return;

        const id = (this.data.damageNumberId || 0) + 1;
        // 只保留最新的5个，避免太多飘字
        let damageNumbers = this.data.damageNumbers.slice(-5);
        damageNumbers.push({
            id,
            damage: typeof damage === 'number' ? gameEngine.formatNumber(damage) : damage,
            x: Math.random() * 200 + 150,
            y: Math.random() * 60 + 30,
            type
        });

        this.setData({
            damageNumbers,
            damageNumberId: id
        });
    },

    // 升级点击伤害
    onUpgradeClick() {
        const globalData = app.globalData;
        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = Math.floor(10 * Math.pow(1.5, globalData.player.manualDamage) * prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            globalData.player.manualDamage++;
            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 自动化测试控制器
    onMercChange(e) {
        const index = e.detail.value;
        const merc = this.data.mercenaries[index];
        this.setData({
            autoUpgradeMercId: merc.id,
            autoUpgradeMercName: merc.name
        });
    },

    onTypeChange(e) {
        const index = e.detail.value;
        const typeObj = this.data.upgradeTypes[index];
        this.setData({
            autoUpgradeType: typeObj.id,
            autoUpgradeTypeLabel: typeObj.label
        });
    },

    onToggleAutoUpgrade(e) {
        this.setData({
            autoUpgradeEnabled: e.detail.value
        });
        if (e.detail.value) {
            wx.showToast({
                title: '自动升级已开启',
                icon: 'none'
            });
        }
    },

    // 自动化升级逻辑核心
    handleAutoUpgradeLogic() {
        if (!this.data.autoUpgradeEnabled || !this.data.autoUpgradeMercId) return;

        const globalData = app.globalData;
        const merc = globalData.mercenaries.find(m => m.id === this.data.autoUpgradeMercId);

        if (!merc || !merc.recruited) return;

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = gameEngine.calculateMercenaryUpgradeCost(merc, prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;

            if (this.data.autoUpgradeType === 'damage') {
                merc.damageLevel++;
                merc.currentDamage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
            } else {
                merc.intervalLevel++;
                merc.currentInterval = gameEngine.calculateUpgradedInterval(merc);
            }

            // 提示一下，但不刷屏
            console.log(`[AutoTest] 自动升级了 ${merc.name} 的 ${this.data.autoUpgradeType}`);

            // 只有当有升级发生时，才可能需要刷新统计信息显示
            this.updateDisplay();
        }
    },

    // 切换伤害飘字开关
    onToggleDamageNumbers(e) {
        const showDamageNumbers = e.detail.value;
        this.setData({ showDamageNumbers });
        // 保存设置
        wx.setStorageSync('showDamageNumbers', showDamageNumbers);
    },

    // 重置游戏
    onResetGame() {
        wx.showModal({
            title: '重置游戏',
            content: '确定要清除所有进度重新开始吗？',
            confirmColor: '#e74c3c',
            success: (res) => {
                if (res.confirm) {
                    // 1. 清除存储
                    wx.clearStorageSync();

                    // 2. 调用 app.js 的初始化方法重置全局变量
                    app.initNewGame();

                    // 3. 额外确保 Boss HP 按新算法重新生成
                    const initialBossHp = gameEngine.calculateBossMaxHp(1);
                    app.globalData.boss.currentHp = initialBossHp;
                    app.globalData.boss.maxHp = initialBossHp;

                    // 4. 重载佣兵数据
                    const mercData = require('../../data/mercenaries.js');
                    app.globalData.mercenaries = mercData.initMercenaries();

                    // 5. 重新初始化页面
                    this.setData({
                        bossStats: [],
                        totalTimeSeconds: 0,
                        currentBossStartTime: Date.now()
                    });
                    this.initGame();
                    this.updateDisplay();

                    wx.showToast({
                        title: '游戏已重置',
                        icon: 'success'
                    });
                }
            }
        });
    },

    // 显示伤害数字
    showDamageNumber(damage, e, type = '') {
        // 性能优化：不再为每个数字设置移除定时器，以免 2 小时后闭包过多造成 OOM
        // 依靠数组上限（20个）自动更替旧数字。CSS 动画结束后会自动看不见，不影响逻辑。
        let damageNumbers = [...this.data.damageNumbers];
        if (damageNumbers.length >= 20) {
            damageNumbers.shift();
        }

        const id = this.data.damageNumberId + 1;
        let x, y;

        if (e && e.touches && e.touches.length > 0) {
            x = Math.random() * 200 + 150;
            y = Math.random() * 100 + 100;
        } else {
            x = Math.random() * 300 + 100;
            y = Math.random() * 100 + 150;
        }

        damageNumbers.push({
            id,
            damage: typeof damage === 'string' ? damage : gameEngine.formatNumber(damage),
            x,
            y,
            delay: 0,
            type
        });

        this.setData({
            damageNumbers,
            damageNumberId: id
        });
    },

    // 格式化时间显示
    formatTime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}m ${s}s`;
        }
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    },

    // 战况统计弹窗控制
    onShowStats() {
        // 在显示前可以做一些时间处理
        const stats = this.data.bossStats.map(s => ({
            ...s,
            timeStr: this.formatTime(s.timeTaken)
        }));

        const totalTimeStr = this.formatTime(this.data.totalTimeSeconds);

        this.setData({
            showStatsModal: true,
            displayBossStats: stats,
            displayTotalTime: totalTimeStr
        });
    },

    closeStatsModal() {
        this.setData({
            showStatsModal: false
        });
    },

    // 关闭离线收益弹窗
    closeOfflineModal() {
        this.setData({
            showOfflineModal: false
        });
    },

    // 切换佣兵卡片展开/折叠
    onToggleMercExpand(e) {
        const mercId = e.currentTarget.dataset.id;
        const expandedMercIds = { ...this.data.expandedMercIds };

        // 切换展开状态
        expandedMercIds[mercId] = !expandedMercIds[mercId];

        this.setData({ expandedMercIds });
        this.updateMercenaryList();
    },

    // 升级佣兵攻击力
    onUpgradeDamage(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || !mercenary.recruited) {
            return;
        }

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = gameEngine.calculateMercenaryUpgradeCost(mercenary, prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.damageLevel++;
            mercenary.currentDamage = gameEngine.calculateUpgradedDamage(mercenary, prestigeBonus.damage);

            // 玩家单位的【长大】技能：升级攻击力时同步提升点击伤害
            if (mercenary.id === 'player') {
                const skill = gameEngine.getMercenarySkill(mercenary);
                if (skill && skill.type === 'sync_click_damage') {
                    // 点击伤害 = 玩家单位的当前攻击力
                    globalData.player.manualDamage = mercenary.currentDamage;
                }
            }

            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 升级佣兵攻击间隔
    onUpgradeInterval(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || !mercenary.recruited) {
            return;
        }

        const prestigeBonus = gameEngine.calculatePrestigeBonus(globalData.player);
        const cost = gameEngine.calculateMercenaryUpgradeCost(mercenary, prestigeBonus.costReduction);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.intervalLevel++;
            mercenary.currentInterval = gameEngine.calculateUpgradedInterval(mercenary);
            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 招募佣兵
    onRecruitMercenary(e) {
        const mercId = e.currentTarget.dataset.id;
        const globalData = app.globalData;

        const mercenary = globalData.mercenaries.find(m => m.id === mercId);
        if (!mercenary || mercenary.recruited) {
            return;
        }

        const cost = gameEngine.calculateRecruitCost(mercenary);

        if (globalData.player.gold >= cost) {
            globalData.player.gold -= cost;
            mercenary.recruited = true;

            wx.showToast({
                title: '招募成功!',
                icon: 'success'
            });

            this.updateDisplay();
        } else {
            wx.showToast({
                title: '金币不足!',
                icon: 'none'
            });
        }
    },

    // 兑换码输入绑定
    onInputCode(e) {
        this.setData({
            redemptionCode: e.detail.value
        });
    },

    // 兑换逻辑
    onRedeem() {
        // ... (保持不变)
        const code = this.data.redemptionCode.trim();
        const globalData = app.globalData;

        if (code === '1') {
            // 一键到达最后一个Boss并设定血量为100
            const lastBossLevel = 12;
            const testHp = 100;

            const bossInfo = require('../../data/bosses.js').BOSS_DATA[lastBossLevel - 1];

            globalData.boss = {
                level: lastBossLevel,
                currentHp: testHp,
                maxHp: testHp,
                name: bossInfo.name,
                icon: bossInfo.icon,
                desc: bossInfo.desc,
                isMaxLevel: true
            };

            this.updateDisplay();
            this.setData({ redemptionCode: '' });

            wx.showToast({
                title: '测试模式激活！',
                icon: 'success'
            });
        } else if (code === '2') {
            // 一键雇佣所有佣兵（测试用）
            const mercenaries = globalData.mercenaries || [];
            let hiredCount = 0;

            mercenaries.forEach(merc => {
                if (!merc.recruited) {
                    merc.recruited = true;
                    hiredCount++;
                }
            });

            this.updateDisplay();
            this.setData({ redemptionCode: '' });

            wx.showToast({
                title: `已雇佣 ${hiredCount} 名佣兵！`,
                icon: 'success'
            });
        } else if (code === '3') {
            // 获得1000亿金币（测试用）
            globalData.player.gold = (globalData.player.gold || 0) + 100000000000;

            this.updateDisplay();
            this.setData({ redemptionCode: '' });

            wx.showToast({
                title: '获得 1000亿 金币！',
                icon: 'success'
            });
        } else if (code !== '') {
            wx.showToast({
                title: '无效兑换码',
                icon: 'none'
            });
        }
    },

    // 切换圣物弹窗 (改为跳转页面)
    onToggleMyRelicsModal() {
        wx.navigateTo({
            url: '/pages/relics/relics'
        });
    },

    // 阻止事件冒泡
    preventClose() { }
});
