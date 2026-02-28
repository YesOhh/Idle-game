// app.js - Web版主入口
import * as saveManager from './utils/saveManager.js';
import * as gameEngine from './utils/gameEngine.js';
import { initMercenaries, MERCENARIES_DATA } from './data/mercenaries.js';
import { BOSS_DATA } from './data/bosses.js';
import { SKILL_LIBRARY } from './data/skills.js';

// ========== 全局游戏状态 ==========
const G = {
    player: null,
    boss: null,
    mercenaries: [],
    stats: { playTime: 0, lastSaveTime: Date.now() },
    offlineSeconds: 0
};

// 运行时状态（不保存）
let _battleTimer = null;
let _teachingTimer = null;
let _experienceTimer = null;
let _lastFrameTime = Date.now();
let _battlePaused = false;
let _globalSpeedBuff = 0;
let _speedBuffActive = false;
let _globalSpeedTimer = null;
let _bossDebuff = 0;
let _bossDebuffActive = false;
let _bossDebuffTimer = null;
let _damageAura = 0;
let _ultimateAura = null;
let _dragonBurnTimer = null;
let _uiTimer = null;
let _damageNumberId = 0;
let _showDamageNumbers = true;
let _showSkillNumbers = true;
let _expandedMercIds = {};
let _bossStats = [];
let _totalTimeSeconds = 0;
let _currentBossStartTime = Date.now();
let _selectedMercId = null;
let _selectedRelicId = null;

// ========== 初始化 ==========
function initNewGame(keepPermanent = false) {
    let prestigeData = { prestigeCount: 0, relics: [] };
    if (keepPermanent && G.player) {
        prestigeData.prestigeCount = G.player.prestigeCount || 0;
        prestigeData.relics = G.player.relics || [];
    }
    G.player = { gold: 0, totalDamage: 0, manualDamage: 1, clickCount: 0, prestigeCount: prestigeData.prestigeCount, relics: prestigeData.relics };
    G.boss = { level: 1, currentHp: 30000, maxHp: 30000, defeated: 0 };
    G.mercenaries = [];
    G.stats = { playTime: 0, lastSaveTime: Date.now() };
    // Reset runtime buff state
    _globalSpeedBuff = 0; _speedBuffActive = false;
    _bossDebuff = 0; _bossDebuffActive = false;
    _damageAura = 0; _ultimateAura = null;
}

function boot() {
    const savedData = saveManager.loadGame();
    if (savedData) {
        G.player = savedData.player;
        G.boss = savedData.boss;
        G.mercenaries = savedData.mercenaries || [];
        G.stats = savedData.stats;
        G.offlineSeconds = savedData.offlineSeconds || 0;
        // 里程碑迁移：补算旧存档的一次性翻倍奖励
        gameEngine.migrateMilestoneDamageBonus(G.mercenaries);
    } else {
        initNewGame();
    }
    initGameData();
    startAutoSave();
    startGlobalBattle();
    setupUI();
    startUITimer();
    // Save immediately when page is closed/refreshed
    window.addEventListener('beforeunload', () => { saveManager.saveGame(G); });
}

function initGameData() {
    const defaultMercs = initMercenaries();
    if (!G.mercenaries || G.mercenaries.length === 0) {
        G.mercenaries = defaultMercs;
    } else {
        // Sync new mercs & update base stats
        defaultMercs.forEach(dm => {
            const existing = G.mercenaries.find(m => m.id === dm.id);
            if (!existing) { G.mercenaries.push(dm); }
            else { existing.baseCost = dm.baseCost; existing.damage = dm.damage; existing.attackInterval = dm.attackInterval; existing.icon = dm.icon; existing.description = dm.description; }
        });
        G.mercenaries.forEach(merc => {
            if (merc.recruited === undefined) merc.recruited = false;
            if (merc.damageLevel === undefined) merc.damageLevel = 0;
            if (merc.intervalLevel === undefined) merc.intervalLevel = 0;
            const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
            merc._prestigeSpeedBuff = prestigeBonus.speed;
            merc.currentDamage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
            merc.currentInterval = gameEngine.calculateUpgradedInterval(merc);
            if (merc.id === 'player' && merc.recruited) G.player.manualDamage = merc.currentDamage;
        });
    }

    // Handle offline progress
    if (G.offlineSeconds && G.offlineSeconds > 60) {
        processOfflineProgress(G.offlineSeconds);
    }
}

function processOfflineProgress(offlineSeconds) {
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
    const recruited = G.mercenaries.filter(m => m.recruited);
    if (recruited.length === 0) return;
    const result = gameEngine.calculateOfflineProgress(G.mercenaries, offlineSeconds, G.boss.level, G.boss.currentHp, prestigeBonus);
    if (result.totalDamage <= 0) return;
    G.player.gold += result.gold;
    G.player.totalDamage += result.totalDamage;
    if (result.bossesDefeated > 0) G.boss = gameEngine.nextBoss(result.newLevel - 1);
    if (result.remainingDamage > 0) G.boss.currentHp = Math.max(0, G.boss.currentHp - result.remainingDamage);
    const hours = Math.floor(offlineSeconds / 3600);
    const minutes = Math.floor((offlineSeconds % 3600) / 60);
    const seconds = offlineSeconds % 60;
    showOfflineModal(hours, minutes, seconds, result.totalDamage, result.gold, result.bossesDefeated);
}

// ========== 自动保存 ==========
function startAutoSave() {
    setInterval(() => { saveManager.saveGame(G); }, 30000);
}

// ========== 全局战斗 ==========
function startGlobalBattle() {
    stopGlobalBattle();
    _lastFrameTime = Date.now();
    _battleTimer = setInterval(() => processBattleTick(), 100);
    _startTeachingSkillTimer();
    _startExperienceSkillTimer();
}

function stopGlobalBattle() {
    if (_battleTimer) { clearInterval(_battleTimer); _battleTimer = null; }
    if (_teachingTimer) { clearInterval(_teachingTimer); _teachingTimer = null; }
    if (_experienceTimer) { clearInterval(_experienceTimer); _experienceTimer = null; }
}

function _startTeachingSkillTimer() {
    if (_teachingTimer) clearInterval(_teachingTimer);
    _teachingTimer = setInterval(() => _processTeachingSkill(), 60000);
}

function _processTeachingSkill() {
    if (!G.mercenaries) return;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
    const soldier = G.mercenaries.find(m => m.id === 'royal_guard' && m.recruited);
    if (!soldier) return;
    const skill = SKILL_LIBRARY['team_damage_buff'];
    if (!skill) return;
    const totalLevel = (soldier.damageLevel || 0) + (soldier.intervalLevel || 0) + 1;
    if (totalLevel < skill.baseUnlockLevel) return;
    const soldierDamage = gameEngine.calculateUpgradedDamage(soldier, prestigeBonus.damage);
    const params = skill.getParams(totalLevel);
    const bonusDamage = Math.floor(soldierDamage * params.bonusRatio);
    if (bonusDamage <= 0) return;
    let buffedCount = 0;
    G.mercenaries.forEach(merc => {
        if (merc.recruited && merc.id !== 'royal_guard') {
            merc._teachingBonus = (merc._teachingBonus || 0) + bonusDamage;
            buffedCount++;
        }
    });
    if (buffedCount > 0) {
        if (_showSkillNumbers) showMercSkillText('royal_guard', `📚传授 +${gameEngine.formatNumber(bonusDamage)}`, 'skill-royal');
        updateBattleMercList();
    }
}

function _startExperienceSkillTimer() {
    if (_experienceTimer) clearInterval(_experienceTimer);
    _experienceTimer = setInterval(() => _processExperienceSkill(), 10000);
}

function _processExperienceSkill() {
    if (!G.mercenaries) return;
    const soldier = G.mercenaries.find(m => m.id === 'royal_guard' && m.recruited);
    if (!soldier) return;
    const totalLevel = (soldier.damageLevel || 0) + (soldier.intervalLevel || 0) + 1;
    const dmgLv = soldier.damageLevel || 0;
    const bonus = 1 + Math.floor(totalLevel * dmgLv / 30);
    soldier._experienceBonus = (soldier._experienceBonus || 0) + bonus;
    if (_showSkillNumbers) showMercSkillText('royal_guard', `🌟经验 +${bonus}`, 'skill-royal');
}

function processBattleTick() {
    if (_battlePaused) return;
    const now = Date.now();
    const deltaTime = (now - _lastFrameTime) / 1000;
    _lastFrameTime = now;
    if (!G.mercenaries) return;

    let totalFrameDamage = 0;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);

    G.mercenaries.forEach(merc => {
        if (!merc.recruited) return;
        if (typeof merc._attackTimer === 'undefined') merc._attackTimer = 0;
        merc._attackTimer += deltaTime;

        let interval = gameEngine.calculateUpgradedInterval(merc);
        if (_globalSpeedBuff) interval *= (1 - _globalSpeedBuff);
        if (_ultimateAura && _ultimateAura.speed) interval *= (1 - _ultimateAura.speed);

        if (merc._attackTimer >= interval) {
            let damage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
            const skill = gameEngine.getMercenarySkill(merc);
            let isCrit = false;
            let thisHitDamage = damage;
            let skillTriggered = null;
            let bonusGold = 0;

            if (skill) {
                // Skill processing — same logic as wx version
                if (skill.type === 'gold_on_attack') {
                    bonusGold = Math.floor(damage * skill.multiplier);
                    skillTriggered = { type: 'gold', text: `+${gameEngine.formatNumber(bonusGold)}💰` };
                } else if (skill.type === 'stacking_buff') {
                    if (Math.random() < skill.chance) { merc._stackingBuff = (merc._stackingBuff || 0) + skill.val; skillTriggered = { type: 'stacking_buff', text: '熟练+1%' }; }
                } else if (skill.type === 'crit') {
                    if (Math.random() < skill.chance) { thisHitDamage *= skill.multiplier; isCrit = true; skillTriggered = { type: 'crit', text: '爆裂!' }; }
                } else if (skill.type === 'global_speed_buff') {
                    if (Math.random() < skill.chance) {
                        _globalSpeedBuff = skill.val; _speedBuffActive = true;
                        if (_globalSpeedTimer) clearTimeout(_globalSpeedTimer);
                        _globalSpeedTimer = setTimeout(() => { _globalSpeedBuff = 0; _speedBuffActive = false; removeSpeedBuffEffect(); }, skill.duration);
                        skillTriggered = { type: 'speed_buff', text: '奥术激涌!' };
                        showSpeedBuffEffect(skill.duration);
                    }
                } else if (skill.type === 'dragon_soul') {
                    merc._dragonSoulStacks = (merc._dragonSoulStacks || 0) + 1;
                    if (merc._dragonSoulStacks >= skill.maxStacks) {
                        merc._dragonSoulStacks = 0; thisHitDamage *= skill.burstMultiplier; isCrit = true;
                        const burnDamagePerTick = Math.floor(damage * skill.burnDamage);
                        const burnTicks = skill.burnDuration / 1000;
                        if (_dragonBurnTimer) clearInterval(_dragonBurnTimer);
                        let burnCount = 0;
                        _dragonBurnTimer = setInterval(() => {
                            burnCount++;
                            if (burnCount > burnTicks || G.boss.currentHp <= 0) { clearInterval(_dragonBurnTimer); _dragonBurnTimer = null; return; }
                            dealGlobalDamage(burnDamagePerTick);
                        }, 1000);
                        skillTriggered = { type: 'damage_buff', text: `龙息 x${skill.burstMultiplier}!` };
                    }
                } else if (skill.type === 'chaos_stack') {
                    if (Math.random() < skill.chance) {
                        merc._chaosAtkBuff = (merc._chaosAtkBuff || 0) + skill.atkBonus;
                        merc._chaosIntervalPenalty = (merc._chaosIntervalPenalty || 0) + skill.intervalIncrease;
                        skillTriggered = { type: 'chaos', text: `混沌x${Math.round((merc._chaosAtkBuff || 0) / skill.atkBonus)}` };
                    }
                    if (merc._chaosAtkBuff) thisHitDamage *= (1 + merc._chaosAtkBuff);
                } else if (skill.type === 'berserker_combo') {
                    const hpPercent = G.boss.currentHp / G.boss.maxHp;
                    let bonusPercent = 0, comboChance = 0;
                    for (const t of skill.thresholds) { if (hpPercent < t.hpPercent) { bonusPercent = t.bonusPercent; comboChance = t.comboChance; } }
                    if (bonusPercent > 0) thisHitDamage *= (1 + skill.maxBonus * bonusPercent);
                    if (skill.comboUnlocked && comboChance > 0) {
                        let comboCount = 0, comboDamage = 0;
                        while (Math.random() < comboChance) { comboCount++; let ed = damage; if (bonusPercent > 0) ed *= (1 + skill.maxBonus * bonusPercent); comboDamage += ed; }
                        if (comboCount > 0) { thisHitDamage += comboDamage; skillTriggered = { type: 'combo', text: `连击x${comboCount}!` }; }
                    }
                } else if (skill.type === 'time_burst') {
                    if (typeof merc._timeBurstTimer === 'undefined') merc._timeBurstTimer = 0;
                    merc._timeBurstTimer += interval * 1000;
                    if (merc._timeBurstTimer >= skill.interval) {
                        merc._timeBurstTimer = 0;
                        thisHitDamage = Math.floor(thisHitDamage * skill.damageMultiplier) * skill.attackCount;
                        isCrit = true;
                        skillTriggered = { type: 'time_burst', text: `时空涟漪 x${skill.attackCount}!` };
                    }
                } else if (skill.type === 'iron_fist') {
                    if (Math.random() < skill.chance) {
                        let ironTotal = 0;
                        G.mercenaries.forEach(m => { if (m.recruited && m.category === 'iron') ironTotal += gameEngine.calculateUpgradedDamage(m, prestigeBonus.damage); });
                        const extra = Math.floor(ironTotal * skill.multiplier);
                        thisHitDamage += extra; isCrit = true;
                        skillTriggered = { type: 'iron_fist', text: `钢铁神拳 +${gameEngine.formatNumber(extra)}!` };
                    }
                } else if (skill.type === 'boss_debuff') {
                    if (Math.random() < skill.chance) {
                        _bossDebuff = skill.val; _bossDebuffActive = true;
                        if (_bossDebuffTimer) clearTimeout(_bossDebuffTimer);
                        _bossDebuffTimer = setTimeout(() => { _bossDebuff = 0; _bossDebuffActive = false; }, skill.duration);
                        skillTriggered = { type: 'freeze', text: `冰霜冻结 +${(skill.val * 100).toFixed(0)}%!` };
                    }
                } else if (skill.type === 'summon') {
                    const total = Math.floor(damage * skill.damageRatio) * skill.count;
                    thisHitDamage += total;
                    skillTriggered = { type: 'summon', text: `召唤x${skill.count} +${gameEngine.formatNumber(total)}` };
                } else if (skill.type === 'damage_aura') {
                    if (!_damageAura) _damageAura = skill.val;
                } else if (skill.type === 'pure_percent_damage') {
                    if (Math.random() < skill.chance) {
                        const pd = Math.floor(G.boss.currentHp * skill.percentVal);
                        thisHitDamage += pd;
                        skillTriggered = { type: 'holy', text: `圣洁之力 ${gameEngine.formatNumber(pd)}` };
                    }
                } else if (skill.type === 'total_team_damage') {
                    if (Math.random() < skill.chance) {
                        let tt = 0; G.mercenaries.forEach(m => { if (m.recruited) tt += gameEngine.calculateUpgradedDamage(m, prestigeBonus.damage); });
                        thisHitDamage += tt; isCrit = true;
                        skillTriggered = { type: 'void', text: `虚空侵蚀 +${gameEngine.formatNumber(tt)}!` };
                    }
                } else if (skill.type === 'periodic_burst') {
                    if (typeof merc._periodicBurstTimer === 'undefined') merc._periodicBurstTimer = 0;
                    merc._periodicBurstTimer += interval * 1000;
                    if (merc._periodicBurstTimer >= skill.interval) {
                        merc._periodicBurstTimer = 0; thisHitDamage *= skill.multiplier; isCrit = true;
                        skillTriggered = { type: 'phoenix', text: `浴火重生 x${skill.multiplier}!` };
                    }
                } else if (skill.type === 'ultimate') {
                    if (!_ultimateAura) _ultimateAura = { damage: skill.teamDamageBonus, speed: skill.teamSpeedBonus };
                    if (Math.random() < skill.critChance) { thisHitDamage *= skill.critMult; isCrit = true; skillTriggered = { type: 'ultimate', text: `万物终结 x${skill.critMult}!` }; }
                } else if (skill.type === 'knight_heavy_armor') {
                    // 「稳固」技能：每隔8秒造成等同攻击力的额外伤害
                    if (typeof merc._fortifyTimer === 'undefined') merc._fortifyTimer = 0;
                    merc._fortifyTimer += interval * 1000;
                    if (merc._fortifyTimer >= 8000) {
                        merc._fortifyTimer = 0;
                        const fortifyDmg = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
                        thisHitDamage += fortifyDmg;
                        skillTriggered = { type: 'knight_fortify', text: `稳固 +${gameEngine.formatNumber(fortifyDmg)}!` };
                    }
                }
            }

            // Global crit from relics
            if (!isCrit && prestigeBonus.critChance > 0 && Math.random() < prestigeBonus.critChance) {
                thisHitDamage *= (2.0 + prestigeBonus.critMult); isCrit = true;
            }
            if (_damageAura) thisHitDamage *= (1 + _damageAura);
            if (_ultimateAura) thisHitDamage *= (1 + _ultimateAura.damage);
            if (_bossDebuff) thisHitDamage *= (1 + _bossDebuff);
            thisHitDamage = Math.floor(thisHitDamage);

            let hitCount = 0;
            while (merc._attackTimer >= interval) { totalFrameDamage += thisHitDamage; hitCount++; merc._attackTimer -= interval; }
            merc._totalDamageDealt = (merc._totalDamageDealt || 0) + thisHitDamage * hitCount;

            if (_showDamageNumbers) {
                showDamageNumber(thisHitDamage, isCrit ? 'crit' : 'normal');
            }
            if (_showSkillNumbers && skillTriggered) {
                showMercSkillText(merc.id, skillTriggered.text, getSkillClass(skillTriggered.type));
            }
            if (bonusGold > 0) G.player.gold += bonusGold;
        }
    });

    if (totalFrameDamage > 0) dealGlobalDamage(totalFrameDamage);
}

function dealGlobalDamage(damage) {
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
    const result = gameEngine.dealDamageToBoss(G.boss, damage, prestigeBonus.gold);
    G.boss = result.boss;
    G.player.totalDamage += damage;
    G.player.gold += result.goldEarned;
    if (result.defeated) onGlobalBossDefeated();
}

function onGlobalBossDefeated() {
    const currentLevel = G.boss.level;
    G.boss.defeated++;
    recordBossStat(currentLevel);

    if (currentLevel === 12) {
        _battlePaused = true;
        showRelicModal();
        return;
    }
    G.boss = gameEngine.nextBoss(currentLevel);
    showToast('Boss击败!');
}

function recordBossStat(level) {
    const now = Date.now();
    const timeTaken = Math.floor((now - _currentBossStartTime) / 1000);
    _bossStats.push({ level, name: G.boss.name || `Boss ${level}`, timeTaken });
    _totalTimeSeconds += timeTaken;
    _currentBossStartTime = now;
}

// ========== UI ==========
function getSkillLevelLabel(sk, merc, boss) {
    // Just show a minimal current-effect summary on the tag
    switch (sk.type) {
        case 'stacking_buff': return '';
        case 'crit': return '';
        case 'gold_on_attack': return '';
        case 'iron_fist': return '';
        case 'berserker_combo': return '';
        case 'global_speed_buff': return '';
        case 'boss_debuff': return '';
        case 'summon': return '';
        case 'damage_aura': return '';
        case 'dragon_soul': return '';
        case 'pure_percent_damage': return '';
        case 'time_burst': return '';
        case 'total_team_damage': return '';
        case 'periodic_burst': return '';
        case 'chaos_stack': return '';
        case 'ultimate': return '';
        case 'knight_heavy_armor': return '';
        case 'knight_fortify': return '';
        default: return '';
    }
}

function getSkillScalingInfo(sk, merc) {
    const totalLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
    const lines = [];
    switch (sk.type) {
        case 'sync_click_damage':
            lines.push({ label: '效果', value: '升级攻击力时点击伤害同步提升', growth: '被动效果，无需升级' });
            break;
        case 'legend_dual_growth':
            lines.push({ label: '效果', value: '升级攻击力/攻速时另一项也提升', growth: '被动效果，无需升级' });
            break;
        case 'stacking_buff':
            lines.push({ label: '触发概率', value: `${(sk.chance * 100).toFixed(0)}%`, growth: '每+10级 → 概率+1%' });
            lines.push({ label: '效果', value: '每次触发永久+1%攻击力', growth: '固定值' });
            break;
        case 'crit':
            if (sk.id === 'shadow_crit') {
                lines.push({ label: '暴击率', value: `${(sk.chance * 100).toFixed(0)}%`, growth: '每+10级 → +5% (上限60%)' });
                lines.push({ label: '暴击倍率', value: `${sk.multiplier.toFixed(1)}x`, growth: '每+15级 → +0.3x' });
            } else {
                lines.push({ label: '暴击率', value: `${(sk.chance * 100).toFixed(0)}%`, growth: '固定20%' });
                lines.push({ label: '暴击倍率', value: `${sk.multiplier.toFixed(1)}x`, growth: '每+10级 → +0.5x' });
            }
            break;
        case 'gold_on_attack':
            lines.push({ label: '金币倍率', value: `${(sk.multiplier * 100).toFixed(0)}%`, growth: '每+10级 → +10%' });
            break;
        case 'iron_fist':
            lines.push({ label: '触发概率', value: '10%', growth: '固定10%' });
            lines.push({ label: '伤害倍率', value: `钢铁系总攻${(sk.multiplier * 100).toFixed(0)}%`, growth: '每+10级 → +15%' });
            break;
        case 'berserker_combo': {
            lines.push({ label: '最高加成', value: `+${(sk.maxBonus * 100).toFixed(0)}%`, growth: '每+10级 → +30%' });
            lines.push({ label: '阶段触发', value: 'Boss血量<85%/60%/35%/10%', growth: '按阶段递增' });
            break;
        }
        case 'global_speed_buff':
            lines.push({ label: '触发概率', value: '10%', growth: '固定10%' });
            lines.push({ label: '攻速提升', value: `+${(sk.val * 100).toFixed(0)}%`, growth: '每+10级 → +5%' });
            lines.push({ label: '持续时间', value: '5秒', growth: '固定' });
            break;
        case 'boss_debuff':
            lines.push({ label: '触发概率', value: '12%', growth: '固定12%' });
            lines.push({ label: '增伤效果', value: `+${(sk.val * 100).toFixed(0)}%受伤`, growth: '每+10级 → +5%' });
            lines.push({ label: '持续时间', value: '4秒', growth: '固定' });
            break;
        case 'summon':
            lines.push({ label: '召唤数量', value: `${sk.count}个`, growth: '每+20级 → +1个 (上限5)' });
            lines.push({ label: '单体伤害', value: `${(sk.damageRatio * 100).toFixed(0)}%攻击力`, growth: '每+10级 → +3%' });
            break;
        case 'damage_aura':
            lines.push({ label: '全队增伤', value: `+${(sk.val * 100).toFixed(0)}%`, growth: '每+10级 → +3%' });
            break;
        case 'dragon_soul':
            lines.push({ label: '龙息倍率', value: `${sk.burstMultiplier}x`, growth: '每+10级 → +15x' });
            lines.push({ label: '灼烧伤害', value: `${(sk.burnDamage * 100).toFixed(0)}%/秒`, growth: '每+15级 → +2%' });
            lines.push({ label: '触发条件', value: '每10次攻击', growth: '固定' });
            break;
        case 'pure_percent_damage':
            lines.push({ label: '触发概率', value: `${(sk.chance * 100).toFixed(0)}%`, growth: '每+20级 → +2%' });
            lines.push({ label: '效果', value: 'Boss当前血量0.01%', growth: '固定 (不受加成)' });
            break;
        case 'time_burst':
            lines.push({ label: '攻击次数', value: `${sk.attackCount}次`, growth: '每+20级 → +1次 (上限12)' });
            lines.push({ label: '伤害倍率', value: `${sk.damageMultiplier.toFixed(1)}x`, growth: '每+10级 → +0.2x' });
            lines.push({ label: '冷却', value: '60秒', growth: '固定' });
            break;
        case 'total_team_damage':
            lines.push({ label: '触发概率', value: `${(sk.chance * 100).toFixed(0)}%`, growth: '每+15级 → +3%' });
            lines.push({ label: '效果', value: '全队攻击力总和伤害', growth: '固定' });
            break;
        case 'periodic_burst':
            lines.push({ label: '伤害倍率', value: `${sk.multiplier}x`, growth: '每+10级 → +20x' });
            lines.push({ label: '冷却', value: '60秒', growth: '固定' });
            break;
        case 'chaos_stack':
            lines.push({ label: '触发概率', value: `${(sk.chance * 100).toFixed(0)}%`, growth: '每+10级 → +3%' });
            lines.push({ label: '攻击力加成', value: `+${(sk.atkBonus * 100).toFixed(0)}%`, growth: '每+15级 → +2%' });
            lines.push({ label: '副作用', value: '攻击间隔+0.1秒', growth: '固定' });
            break;
        case 'ultimate':
            lines.push({ label: '全队增伤', value: `+${(sk.teamDamageBonus * 100).toFixed(0)}%`, growth: '每+10级 → +5%' });
            lines.push({ label: '全队攻速', value: `+${(sk.teamSpeedBonus * 100).toFixed(0)}%`, growth: '随增伤同步' });
            lines.push({ label: '暴击', value: '25%几率5.0x', growth: '固定' });
            break;
        case 'knight_heavy_armor':
            lines.push({ label: '效果', value: '升级攻击力时额外+攻击力等级²×等级', growth: '随等级增长' });
            break;
        case 'experience_growth':
            lines.push({ label: '效果', value: '每10秒攻击力+(1+等级×攻击力等级/30)', growth: '随等级增长' });
            break;
        case 'team_damage_buff':
            lines.push({ label: '效果', value: '每60秒全体+本单位攻击力1%', growth: '固定' });
            break;
    }
    return lines;
}

function getSkillClass(skillType) {
    const map = { stacking_buff: 'skill', crit: 'skill-crit', speed_buff: 'skill-mage', damage_buff: 'skill-dragon', combo: 'skill-combo', burn: 'skill-burn', chaos: 'skill-chaos', time_burst: 'skill-time', gold: 'skill-gold', team_buff: 'skill-royal', teaching: 'skill-royal', iron_fist: 'skill-iron', freeze: 'skill-freeze', summon: 'skill-summon', holy: 'skill-holy', void: 'skill-void', phoenix: 'skill-phoenix', ultimate: 'skill-ultimate', knight_fortify: 'skill-iron' };
    return map[skillType] || 'skill';
}

function getCategoryInfo(category) {
    const map = { basic: { name: '基础系', icon: '⭐', color: '#95a5a6' }, iron: { name: '钢铁系', icon: '⚙️', color: '#7f8c8d' }, magic: { name: '魔法系', icon: '✨', color: '#9b59b6' }, holy: { name: '圣洁系', icon: '☀️', color: '#f1c40f' }, ancient: { name: '远古系', icon: '🌀', color: '#1abc9c' }, legend: { name: '传说系', icon: '👑', color: '#e74c3c' } };
    return map[category] || { name: '未知', icon: '❓', color: '#bdc3c7' };
}

function showMercSkillText(mercId, text, type = '') {
    const card = document.querySelector(`.merc-item-card[data-merc-id="${mercId}"]`);
    const overlay = document.getElementById('merc-skill-overlay');
    if (!card || !overlay) return;
    const wrapper = overlay.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `merc-skill-float ${type}`;
    el.textContent = text;
    el.style.top = (cardRect.top - wrapperRect.top + cardRect.height * 0.6) + 'px';
    el.style.left = (Math.random() * 60 + 20) + '%';
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

function showDamageNumber(damage, type = '') {
    const container = document.getElementById('damage-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `damage-number ${type}`;
    el.textContent = typeof damage === 'number' ? gameEngine.formatNumber(damage) : damage;
    el.style.left = (Math.random() * 200 + 50) + 'px';
    el.style.top = (Math.random() * 50 + 20) + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2000);
}

function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) { const m = Math.floor(seconds / 60); return `${m}m ${seconds % 60}s`; }
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m ${seconds % 60}s`;
}

// ------- Battle tab UI update -------
function updateBattleUI() {
    const boss = G.boss;
    const player = G.player;
    const hpPercent = boss.maxHp > 0 ? (boss.currentHp / boss.maxHp) * 100 : 0;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(player);
    const bossInfo = BOSS_DATA[(boss.level || 1) - 1];

    document.getElementById('boss-level').textContent = boss.level;
    document.getElementById('boss-icon').textContent = bossInfo ? bossInfo.icon : '👹';
    document.getElementById('boss-hp-text').textContent = gameEngine.formatNumber(boss.currentHp);
    document.getElementById('boss-hp-bar').style.width = hpPercent + '%';
    document.getElementById('gold-text').textContent = gameEngine.formatNumber(player.gold);

    const badge = document.getElementById('prestige-badge');
    if (player.prestigeCount > 0) {
        badge.style.display = 'inline';
        document.getElementById('prestige-count').textContent = player.prestigeCount + 1;
    } else {
        badge.style.display = 'none';
    }
}

function updateBattleMercList() {
    const container = document.getElementById('battle-merc-list');
    if (!container) return;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);

    const recruited = G.mercenaries.filter(m => m.recruited);
    let html = '';
    recruited.forEach(merc => {
        const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
        let currentInterval = gameEngine.calculateUpgradedInterval(merc);
        // Apply active speed buffs to display
        if (_globalSpeedBuff) currentInterval *= (1 - _globalSpeedBuff);
        if (_ultimateAura && _ultimateAura.speed) currentInterval *= (1 - _ultimateAura.speed);
        currentInterval = Math.max(0.05, currentInterval);
        const upgradeCost = gameEngine.calculateMercenaryUpgradeCost(merc, prestigeBonus.costReduction);
        const canAffordUpgrade = G.player.gold >= upgradeCost;
        const totalLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
        const catInfo = getCategoryInfo(merc.category);
        const expanded = _expandedMercIds[merc.id] || false;

        // Skill info
        let skillInfo = gameEngine.getMercenarySkillDisplay(merc);
        let shortName = '';
        let skill2ShortName = '';
        let skillLevelLabel = '';
        if (skillInfo && skillInfo.name) {
            const m = skillInfo.name.match(/【(.+?)】/);
            shortName = m ? m[1] : skillInfo.name;
            if (skillInfo.skill2 && skillInfo.skill2.name) {
                const m2 = skillInfo.skill2.name.match(/【(.+?)】/);
                skill2ShortName = m2 ? m2[1] : skillInfo.skill2.name;
            }
        }
        // Compute level-dependent skill label
        if (skillInfo && skillInfo.isUnlocked) {
            const sk = gameEngine.getMercenarySkill(merc);
            if (sk) skillLevelLabel = getSkillLevelLabel(sk, merc, G.boss);
        }

        // Upgrade effects
        const tempMercDmg = { ...merc, damageLevel: (merc.damageLevel || 0) + 1 };
        const nextDmgInfo = gameEngine.getDamageDisplayInfo(tempMercDmg, prestigeBonus.damage);
        const damageUpgradeEffect = gameEngine.formatNumber(nextDmgInfo.final - dmgInfo.final);
        const tempMercInt = { ...merc, intervalLevel: (merc.intervalLevel || 0) + 1 };
        let nextInterval = gameEngine.calculateUpgradedInterval(tempMercInt);
        if (_globalSpeedBuff) nextInterval *= (1 - _globalSpeedBuff);
        if (_ultimateAura && _ultimateAura.speed) nextInterval *= (1 - _ultimateAura.speed);
        nextInterval = Math.max(0.05, nextInterval);
        const intervalUpgradeEffect = (currentInterval - nextInterval).toFixed(4);

        html += `<div class="merc-item-card ${expanded ? 'expanded' : ''}" data-merc-id="${merc.id}">
            <div class="merc-card-header" data-toggle="${merc.id}">
                <div class="merc-icon-box"><span class="merc-icon-large">${merc.icon}</span></div>
                <div class="merc-info-main">
                    <div class="merc-title-row">
                        <span class="merc-name">${merc.name}</span>
                        <span class="merc-category" style="color:${catInfo.color}">${catInfo.icon}${catInfo.name}</span>
                        <span class="merc-level">Lv.${totalLevel}</span>
                    </div>
                    <div class="merc-stats-row"><span class="merc-stat">攻击力　${gameEngine.formatNumber(dmgInfo.final)}</span></div>
                    <div class="merc-stats-row"><span class="merc-stat">攻击间隔　${currentInterval.toFixed(4)}秒</span></div>
                    ${skillInfo ? `<div class="merc-skill-tag">
                        <span class="skill-tag ${skillInfo.isUnlocked ? 'unlocked' : 'locked'}">[${shortName}]${skillLevelLabel ? `<span class="skill-level-label"> ${skillLevelLabel}</span>` : ''}</span>
                        ${skillInfo.skill2 ? `<span class="skill-tag ${skillInfo.skill2.isUnlocked ? 'unlocked' : 'locked'}">[${skill2ShortName}]</span>` : ''}
                    </div>` : ''}
                </div>
            </div>
            <div class="merc-expand-content">
                <div class="upgrade-box" data-upgrade-dmg="${merc.id}">
                    <div class="upgrade-info"><span class="upgrade-title">升级攻击力 等级 ${(merc.damageLevel||0)+1}</span><span class="upgrade-effect">攻击力 +${damageUpgradeEffect}</span></div>
                    <div class="upgrade-cost ${canAffordUpgrade ? '' : 'disabled'}">花费　💰 ${gameEngine.formatNumber(upgradeCost)}</div>
                </div>
                <div class="upgrade-box" data-upgrade-int="${merc.id}">
                    <div class="upgrade-info"><span class="upgrade-title">升级攻击速度 等级 ${(merc.intervalLevel||0)+1}</span><span class="upgrade-effect">攻击间隔 -${intervalUpgradeEffect}秒</span></div>
                    <div class="upgrade-cost ${canAffordUpgrade ? '' : 'disabled'}">花费　💰 ${gameEngine.formatNumber(upgradeCost)}</div>
                </div>
                <div class="merc-description">${merc.description}</div>
                ${totalLevel >= 50 ? `<div class="milestone-status">
                    ${totalLevel >= 50 ? '<span class="milestone-active">🌟 Lv.50 攻击力x2</span>' : ''}
                    ${totalLevel >= 75 ? '<span class="milestone-active">⚡ Lv.75 攻速+20%</span>' : ''}
                    ${totalLevel >= 100 ? '<span class="milestone-active">🔥 Lv.100 攻击力x2 攻速+20%</span>' : ''}
                </div>` : ''}
                ${skillInfo ? `<div class="skill-detail">
                    <div class="skill-detail-header">
                        <span class="skill-detail-name ${skillInfo.isUnlocked ? 'unlocked' : 'locked'}">${shortName}</span>
                        ${!skillInfo.isUnlocked ? `<span class="skill-unlock-condition">${skillInfo.unlockCondition}</span>` : ''}
                    </div>
                    <div class="skill-detail-desc">${skillInfo.desc}</div>
                    ${skillInfo.isUnlocked ? (() => {
                        const sk = gameEngine.getMercenarySkill(merc);
                        if (!sk) return '';
                        const scalingLines = getSkillScalingInfo(sk, merc);
                        if (scalingLines.length === 0) return '';
                        return `<div class="skill-scaling-table">
                            ${scalingLines.map(l => `<div class="skill-scaling-row">
                                <span class="scaling-label">${l.label}</span>
                                <span class="scaling-value">${l.value}</span>
                                <span class="scaling-growth">${l.growth}</span>
                            </div>`).join('')}
                        </div>`;
                    })() : ''}
                </div>` : ''}
                ${skillInfo && skillInfo.skill2 ? `<div class="skill-detail">
                    <div class="skill-detail-header">
                        <span class="skill-detail-name ${skillInfo.skill2.isUnlocked ? 'unlocked' : 'locked'}">${skill2ShortName}</span>
                        ${!skillInfo.skill2.isUnlocked ? `<span class="skill-unlock-condition">${skillInfo.skill2.unlockCondition}</span>` : ''}
                    </div>
                    <div class="skill-detail-desc">${skillInfo.skill2.desc}</div>
                </div>` : ''}
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

// ------- Mercenary manage tab -------
function updateManageMercList() {
    const container = document.getElementById('manage-merc-list');
    if (!container) return;
    document.getElementById('merc-gold-text').textContent = gameEngine.formatNumber(G.player.gold);
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);

    let mercs = G.mercenaries.map(merc => {
        const recruitCost = gameEngine.calculateRecruitCost(merc);
        const dmgInfo = gameEngine.getDamageDisplayInfo(merc, prestigeBonus.damage);
        const currentInterval = gameEngine.calculateUpgradedInterval(merc);
        let skillInfo = gameEngine.getMercenarySkillDisplay(merc);
        if (skillInfo && skillInfo.name) {
            const m = skillInfo.name.match(/【(.+?)】/);
            skillInfo.shortName = m ? m[1] : skillInfo.name;
            if (skillInfo.skill2) { const m2 = skillInfo.skill2.name.match(/【(.+?)】/); skillInfo.skill2.shortName = m2 ? m2[1] : skillInfo.skill2.name; }
        }
        return { ...merc, recruitCost, currentDamageText: gameEngine.formatNumber(dmgInfo.final), currentIntervalText: currentInterval.toFixed(4), recruitCostText: gameEngine.formatNumber(recruitCost), canAffordRecruit: !merc.recruited && G.player.gold >= recruitCost, skillInfo, categoryInfo: getCategoryInfo(merc.category) };
    });
    mercs.sort((a, b) => a.recruitCost - b.recruitCost);

    let html = '';
    for (let i = 0; i < mercs.length; i += 3) {
        const row = mercs.slice(i, i + 3);
        const rowIndex = Math.floor(i / 3);
        html += '<div class="merc-grid-row">';
        row.forEach(merc => {
            html += `<div class="merc-grid-item ${merc.recruited ? 'recruited' : 'not-recruited'} ${_selectedMercId === merc.id ? 'selected' : ''}" data-manage-select="${merc.id}">
                <div class="merc-grid-icon-wrapper">
                    <div class="merc-grid-icon">${merc.icon}</div>
                    ${(!merc.recruited && merc.canAffordRecruit) ? '<div class="recruit-dot"></div>' : ''}
                </div>
                <div class="merc-grid-name">${merc.name}</div>
            </div>`;
        });
        // Fill empty cells
        for (let j = row.length; j < 3; j++) html += '<div class="merc-grid-item" style="visibility:hidden"></div>';
        html += '</div>';

        // Detail panel
        const selInRow = row.find(m => m.id === _selectedMercId);
        if (selInRow) {
            const m = selInRow;
            html += `<div class="merc-detail-panel">
                <div class="detail-header">
                    <span class="detail-name">${m.icon} ${m.name}</span>
                    <span class="detail-category" style="color:${m.categoryInfo.color}">${m.categoryInfo.icon}${m.categoryInfo.name}</span>
                </div>
                <div class="detail-desc">${m.description}</div>
                <div class="detail-stats">
                    <div class="detail-stat"><span class="detail-label">攻击力：</span><span class="detail-value">${m.currentDamageText}</span></div>
                    <div class="detail-stat"><span class="detail-label">攻击间隔：</span><span class="detail-value">${m.currentIntervalText}</span></div>
                </div>
                ${m.skillInfo ? `<div class="detail-skill">
                    <div class="skill-detail-header">
                        <span class="skill-detail-name ${m.skillInfo.isUnlocked ? 'unlocked' : 'locked'}">${m.skillInfo.shortName || ''}</span>
                        ${m.recruited && !m.skillInfo.isUnlocked ? `<span class="skill-unlock-condition">${m.skillInfo.unlockCondition}</span>` : ''}
                    </div>
                    ${m.recruited ? `<div class="skill-detail-desc">${m.skillInfo.desc}</div>` : ''}
                    ${m.recruited && m.skillInfo.isUnlocked ? (() => {
                        const sk = gameEngine.getMercenarySkill(merc);
                        if (!sk) return '';
                        const scalingLines = getSkillScalingInfo(sk, merc);
                        if (scalingLines.length === 0) return '';
                        return `<div class="skill-scaling-table">
                            ${scalingLines.map(l => `<div class="skill-scaling-row">
                                <span class="scaling-label">${l.label}</span>
                                <span class="scaling-value">${l.value}</span>
                                <span class="scaling-growth">${l.growth}</span>
                            </div>`).join('')}
                        </div>`;
                    })() : ''}
                </div>` : ''}
                ${m.skillInfo && m.skillInfo.skill2 ? `<div class="detail-skill">
                    <div class="skill-detail-header">
                        <span class="skill-detail-name ${m.skillInfo.skill2.isUnlocked ? 'unlocked' : 'locked'}">${m.skillInfo.skill2.shortName || ''}</span>
                        ${m.recruited && !m.skillInfo.skill2.isUnlocked ? `<span class="skill-unlock-condition">${m.skillInfo.skill2.unlockCondition}</span>` : ''}
                    </div>
                    ${m.recruited ? `<div class="skill-detail-desc">${m.skillInfo.skill2.desc}</div>` : ''}
                </div>` : ''}
                ${!m.recruited ? `<div class="detail-cost">雇佣花费：<div class="cost-row">💰 ${m.recruitCostText}</div></div>` : ''}
                <div class="detail-actions">
                    ${!m.recruited ? `<button class="action-btn recruit-btn ${m.canAffordRecruit ? '' : 'disabled'}" data-recruit="${m.id}" ${!m.canAffordRecruit ? 'disabled' : ''}>雇佣</button>` : '<div class="action-btn hired-btn">已雇佣</div>'}
                </div>
            </div>`;
        }
    }
    if (mercs.length === 0) html = '<div class="empty-state">暂无佣兵数据</div>';
    container.innerHTML = html;
}

// ------- Relics tab -------
function updateRelicsUI() {
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
    document.getElementById('relic-damage').textContent = `+${((prestigeBonus.damage - 1) * 100).toFixed(0)}%`;
    document.getElementById('relic-gold').textContent = `+${((prestigeBonus.gold - 1) * 100).toFixed(0)}%`;
    document.getElementById('relic-speed').textContent = `+${(prestigeBonus.speed * 100).toFixed(0)}%`;
    document.getElementById('relic-cost').textContent = `-${((1 - prestigeBonus.costReduction) * 100).toFixed(0)}%`;
    document.getElementById('relic-crit-chance').textContent = `+${(prestigeBonus.critChance * 100).toFixed(0)}%`;
    document.getElementById('relic-crit-mult').textContent = `+${(prestigeBonus.critMult * 100).toFixed(0)}%`;

    const list = document.getElementById('relic-list');
    const relics = G.player.relics || [];
    if (relics.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><span>尚未获得任何圣物</span></div>';
        return;
    }
    let html = '';
    relics.forEach(relic => {
        const level = relic.level || 1;
        let effectText = '', baseText = '';
        if (relic.type === 'cost') { effectText = `-${(relic.val * level * 100).toFixed(0)}% (约)`; baseText = `-${(relic.val * 100).toFixed(0)}%`; }
        else { effectText = `+${(relic.val * level * 100).toFixed(0)}%`; baseText = `+${(relic.val * 100).toFixed(0)}%`; }

        html += `<div class="relic-card ${_selectedRelicId === relic.id ? 'selected' : ''}" data-relic-id="${relic.id}">
            <div class="relic-main">
                <div class="relic-icon">${relic.icon}</div>
                <div class="relic-info">
                    <div class="relic-name-row"><span class="relic-name">${relic.name}</span><span class="relic-level">Lv.${level}</span></div>
                    <div class="relic-desc">${relic.desc}</div>
                </div>
            </div>
            ${_selectedRelicId === relic.id ? `<div class="relic-detail">
                <div class="divider"></div>
                <div class="detail-row"><span>当前效果:</span><span class="detail-val">${effectText}</span></div>
                <div class="detail-row"><span>堆叠规则:</span><span class="detail-val">每级 ${baseText}</span></div>
            </div>` : ''}
        </div>`;
    });
    list.innerHTML = html;
}

// ------- Modals -------
function showOfflineModal(hours, minutes, seconds, totalDamage, gold, bosses) {
    let timeText = '';
    if (hours > 0) timeText += `${hours}小时`;
    if (minutes > 0) timeText += `${minutes}分钟`;
    if (hours === 0 && minutes === 0) timeText = `${seconds}秒`;
    document.getElementById('offline-time').textContent = timeText;
    document.getElementById('offline-damage').textContent = gameEngine.formatNumber(totalDamage);
    document.getElementById('offline-gold').textContent = gameEngine.formatNumber(gold);
    document.getElementById('offline-bosses').textContent = bosses;
    document.getElementById('modal-offline').style.display = 'flex';
}

function showRelicModal() {
    const choices = gameEngine.getRandomRelicChoices();
    const container = document.getElementById('relic-choices');
    container.innerHTML = choices.map((r, i) =>
        `<div class="relic-choice-card" data-relic-choice="${i}">
            <div class="relic-choice-icon">${r.icon}</div>
            <div><div class="relic-choice-name">${r.name}</div><div class="relic-choice-desc">${r.desc}</div></div>
        </div>`
    ).join('');
    container._choices = choices;
    document.getElementById('modal-relic').style.display = 'flex';
}

function onPrestige(selectedRelic) {
    G.player.prestigeCount = (G.player.prestigeCount || 0) + 1;
    if (selectedRelic) {
        if (!G.player.relics) G.player.relics = [];
        const existing = G.player.relics.find(r => r.id === selectedRelic.id);
        if (existing) existing.level = (existing.level || 1) + 1;
        else { selectedRelic.level = 1; G.player.relics.push(selectedRelic); }
    }
    initNewGame(true);
    G.mercenaries = initMercenaries();
    initGameData();
    _battlePaused = false;
    _bossStats = []; _totalTimeSeconds = 0; _currentBossStartTime = Date.now();
    refreshAll();
    showToast(`开启第 ${G.player.prestigeCount + 1} 周目!`);
}

function refreshAll() {
    updateBattleUI();
    updateBattleMercList();
    updateManageMercList();
    updateRelicsUI();
}

// ------- UI Timer -------
function startUITimer() {
    if (_uiTimer) clearInterval(_uiTimer);
    _uiTimer = setInterval(() => {
        updateBattleUI();
        // Only update merc lists at a slower rate to avoid thrashing
    }, 200);
    // Slower merc list update
    setInterval(() => {
        const activeTab = document.querySelector('.tab-page.active');
        if (activeTab && activeTab.id === 'tab-battle') updateBattleMercList();
        else if (activeTab && activeTab.id === 'tab-mercenaries') updateManageMercList();
        else if (activeTab && activeTab.id === 'tab-relics') updateRelicsUI();
    }, 500);
}

// ========== Event Setup ==========
function setupUI() {
    // Tab switching
    document.querySelectorAll('.tab-bar-item').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.tab-bar-item').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-page').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            document.getElementById('tab-' + el.dataset.tab).classList.add('active');
            refreshAll();
        });
    });

    // Boss click
    document.getElementById('boss-sprite').addEventListener('click', () => {
        const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
        let damage = G.player.manualDamage * prestigeBonus.damage;
        let isCrit = false;
        if (prestigeBonus.critChance > 0 && Math.random() < prestigeBonus.critChance) {
            damage *= (2.0 + (prestigeBonus.critMult || 0)); isCrit = true;
        }
        // Deal damage
        const result = gameEngine.dealDamageToBoss(G.boss, damage, prestigeBonus.gold);
        G.boss = result.boss;
        G.player.totalDamage += damage;
        G.player.gold += result.goldEarned;
        // Track manual click damage to player merc
        const playerMerc = G.mercenaries.find(m => m.id === 'player');
        if (playerMerc) playerMerc._totalDamageDealt = (playerMerc._totalDamageDealt || 0) + damage;
        if (result.defeated) onGlobalBossDefeated();
        showDamageNumber(damage, isCrit ? 'crit' : '');
        // Boss hit animation
        const icon = document.getElementById('boss-icon');
        icon.classList.remove('hit');
        void icon.offsetWidth; // force reflow
        icon.classList.add('hit');
    });

    // Battle merc list delegation (use pointerdown to avoid lost clicks from DOM rebuild)
    document.getElementById('battle-merc-list').addEventListener('pointerdown', (e) => {
        // Toggle expand
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const id = toggle.dataset.toggle;
            _expandedMercIds[id] = !_expandedMercIds[id];
            updateBattleMercList();
            return;
        }
        // Upgrade damage
        const upgDmg = e.target.closest('[data-upgrade-dmg]');
        if (upgDmg) {
            upgradeMerc(upgDmg.dataset.upgradeDmg, 'damage');
            return;
        }
        // Upgrade interval
        const upgInt = e.target.closest('[data-upgrade-int]');
        if (upgInt) {
            upgradeMerc(upgInt.dataset.upgradeInt, 'interval');
            return;
        }
    });

    // Manage merc list delegation (use pointerdown to avoid lost clicks from DOM rebuild)
    document.getElementById('manage-merc-list').addEventListener('pointerdown', (e) => {
        const selectEl = e.target.closest('[data-manage-select]');
        if (selectEl) {
            const id = selectEl.dataset.manageSelect;
            _selectedMercId = _selectedMercId === id ? null : id;
            updateManageMercList();
            return;
        }
        const recruitEl = e.target.closest('[data-recruit]');
        if (recruitEl) {
            recruitMerc(recruitEl.dataset.recruit);
            return;
        }
    });

    // Relics list delegation (use pointerdown to avoid lost clicks from DOM rebuild)
    document.getElementById('relic-list').addEventListener('pointerdown', (e) => {
        const card = e.target.closest('[data-relic-id]');
        if (card) {
            const id = card.dataset.relicId;
            _selectedRelicId = _selectedRelicId === id ? null : id;
            updateRelicsUI();
        }
    });

    // Toggle damage numbers
    document.getElementById('toggle-damage-numbers').addEventListener('change', (e) => {
        _showDamageNumbers = e.target.checked;
    });
    document.getElementById('toggle-skill-numbers').addEventListener('change', (e) => {
        _showSkillNumbers = e.target.checked;
    });

    // Stats modal
    document.getElementById('btn-stats').addEventListener('click', () => {
        const table = document.getElementById('stats-table-body');
        let html = '<div class="stats-header"><span class="col-lvl">Boss</span><span class="col-time">击杀时长</span></div>';
        if (_bossStats.length === 0) html += '<div class="empty-stats">暂无击杀记录</div>';
        else _bossStats.forEach(s => { html += `<div class="stats-row"><span class="col-lvl">Lv.${s.level} ${s.name}</span><span class="col-time">${formatTime(s.timeTaken)}</span></div>`; });
        table.innerHTML = html;
        document.getElementById('total-time').textContent = formatTime(_totalTimeSeconds);
        // Damage ranking
        updateDamageRanking();
        document.getElementById('modal-stats').style.display = 'flex';
    });
    document.getElementById('btn-close-stats').addEventListener('click', () => { document.getElementById('modal-stats').style.display = 'none'; });

    // Simulator modal
    setupSimulator();

    // Offline modal
    document.getElementById('btn-close-offline').addEventListener('click', () => { document.getElementById('modal-offline').style.display = 'none'; });

    // Reset game
    document.getElementById('btn-reset').addEventListener('click', () => {
        if (confirm('确定要清除所有进度重新开始吗？')) {
            saveManager.deleteSave();
            initNewGame();
            G.mercenaries = initMercenaries();
            const initialBossHp = gameEngine.calculateBossMaxHp(1);
            G.boss.currentHp = initialBossHp; G.boss.maxHp = initialBossHp;
            _bossStats = []; _totalTimeSeconds = 0; _currentBossStartTime = Date.now();
            _expandedMercIds = {}; _selectedMercId = null; _selectedRelicId = null;
            refreshAll();
            showToast('游戏已重置');
        }
    });

    // Redeem
    document.getElementById('btn-redeem').addEventListener('click', () => {
        const code = document.getElementById('redeem-input').value.trim();
        if (code === '1') {
            const bossInfo = BOSS_DATA[11];
            G.boss = { level: 12, currentHp: 100, maxHp: 100, name: bossInfo.name, icon: bossInfo.icon, desc: bossInfo.desc, isMaxLevel: true, defeated: G.boss.defeated || 0 };
            refreshAll(); document.getElementById('redeem-input').value = ''; showToast('测试模式激活！');
        } else if (code === '2') {
            let c = 0; G.mercenaries.forEach(m => { if (!m.recruited) { m.recruited = true; c++; } });
            refreshAll(); document.getElementById('redeem-input').value = ''; showToast(`已雇佣 ${c} 名佣兵！`);
        } else if (code === '3') {
            G.player.gold += 100000000000;
            refreshAll(); document.getElementById('redeem-input').value = ''; showToast('获得 1000亿 金币！');
        } else if (code) { showToast('无效兑换码'); }
    });

    // Relic choice modal
    document.getElementById('relic-choices').addEventListener('click', (e) => {
        const card = e.target.closest('[data-relic-choice]');
        if (card) {
            const idx = parseInt(card.dataset.relicChoice);
            const choices = document.getElementById('relic-choices')._choices;
            if (choices && choices[idx]) {
                document.getElementById('modal-relic').style.display = 'none';
                onPrestige(choices[idx]);
            }
        }
    });

    // Initial render
    refreshAll();
}

function showSpeedBuffEffect(duration) {
    const boss = document.querySelector('.boss-section');
    boss.classList.remove('speed-buff-active');
    void boss.offsetWidth;
    boss.classList.add('speed-buff-active');
}

function removeSpeedBuffEffect() {
    const boss = document.querySelector('.boss-section');
    boss.classList.remove('speed-buff-active');
}

function updateDamageRanking() {
    const container = document.getElementById('damage-ranking-body');
    if (!container) return;
    const recruited = G.mercenaries.filter(m => m.recruited && (m._totalDamageDealt || 0) > 0);
    recruited.sort((a, b) => (b._totalDamageDealt || 0) - (a._totalDamageDealt || 0));
    const totalDamage = recruited.reduce((sum, m) => sum + (m._totalDamageDealt || 0), 0);
    if (recruited.length === 0) {
        container.innerHTML = '<div class="empty-stats">暂无伤害记录</div>';
        return;
    }
    let html = '<div class="stats-header"><span class="col-rank">#</span><span class="col-name">单位</span><span class="col-dmg">累计伤害</span><span class="col-pct">占比</span></div>';
    recruited.forEach((merc, i) => {
        const dmg = merc._totalDamageDealt || 0;
        const pct = totalDamage > 0 ? ((dmg / totalDamage) * 100).toFixed(1) : '0.0';
        const catInfo = getCategoryInfo(merc.category);
        const barWidth = totalDamage > 0 ? (dmg / recruited[0]._totalDamageDealt * 100) : 0;
        html += `<div class="rank-row">
            <span class="col-rank rank-${i < 3 ? i + 1 : 'other'}">${i + 1}</span>
            <span class="col-name"><span class="rank-icon">${merc.icon}</span>${merc.name}</span>
            <span class="col-dmg">${gameEngine.formatNumber(dmg)}</span>
            <span class="col-pct">${pct}%</span>
            <div class="rank-bar" style="width:${barWidth}%"></div>
        </div>`;
    });
    html += `<div class="rank-total">总伤害：${gameEngine.formatNumber(totalDamage)}</div>`;
    container.innerHTML = html;
}

function upgradeMerc(mercId, type) {
    const merc = G.mercenaries.find(m => m.id === mercId);
    if (!merc || !merc.recruited) return;
    const prestigeBonus = gameEngine.calculatePrestigeBonus(G.player);
    const cost = gameEngine.calculateMercenaryUpgradeCost(merc, prestigeBonus.costReduction);
    if (G.player.gold < cost) { showToast('金币不足!'); return; }
    G.player.gold -= cost;
    const oldDisplayLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
    if (type === 'damage') {
        merc.damageLevel++;
        // 里程碑攻击力检查（跨越50/100级时一次性翻倍）
        const newLv = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
        gameEngine.applyMilestoneDamageCheck(merc, oldDisplayLevel, newLv);
        // 骑士「重装」技能：升级攻击力时额外增加（攻击力等级²×等级）点攻击力
        const knightSkill = gameEngine.getMercenarySkill(merc);
        if (knightSkill && knightSkill.type === 'knight_heavy_armor') {
            const dmgLv = merc.damageLevel || 0;
            const totalLv = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
            const heavyBonus = dmgLv * dmgLv * totalLv;
            merc._knightHeavyBonus = (merc._knightHeavyBonus || 0) + heavyBonus;
            if (_showSkillNumbers) showMercSkillText(merc.id, `🛡️重装 +${gameEngine.formatNumber(heavyBonus)}`, 'skill-iron');
        }
        merc.currentDamage = gameEngine.calculateUpgradedDamage(merc, prestigeBonus.damage);
        if (merc.id === 'player') {
            const skill = gameEngine.getMercenarySkill(merc);
            if (skill && skill.type === 'sync_click_damage') G.player.manualDamage = merc.currentDamage;
        }
    } else {
        merc.intervalLevel++;
        // 里程碑攻击力检查（升级攻速也可能跨越里程碑等级）
        const newLv = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
        gameEngine.applyMilestoneDamageCheck(merc, oldDisplayLevel, newLv);
        merc.currentInterval = gameEngine.calculateUpgradedInterval(merc);
    }
    const newDisplayLevel = (merc.damageLevel || 0) + (merc.intervalLevel || 0) + 1;
    // 里程碑提示
    checkMilestone(merc, oldDisplayLevel, newDisplayLevel);
    updateBattleMercList();
}

function checkMilestone(merc, oldLv, newLv) {
    const milestones = [
        { lv: 50, msg: '🌟 Lv.50 里程碑！攻击力翻倍！' },
        { lv: 75, msg: '⚡ Lv.75 里程碑！攻击速度 +20%！' },
        { lv: 100, msg: '🔥 Lv.100 里程碑！攻击力再翻倍 + 攻速再 +20%！' },
    ];
    milestones.forEach(m => {
        if (oldLv < m.lv && newLv >= m.lv) {
            showToast(`${merc.name} ${m.msg}`);
            showDamageNumber(`${merc.icon} ${m.msg}`, 'skill-ultimate');
        }
    });
}

function recruitMerc(mercId) {
    const merc = G.mercenaries.find(m => m.id === mercId);
    if (!merc || merc.recruited) return;
    const cost = gameEngine.calculateRecruitCost(merc);
    if (G.player.gold < cost) { showToast('金币不足!'); return; }
    G.player.gold -= cost;
    merc.recruited = true;
    showToast('招募成功!');
    refreshAll();
}

// ========== Simulator Modal ==========
function setupSimulator() {
    const modal = document.getElementById('modal-simulator');
    const select = document.getElementById('sim-merc-select');
    const categoryNames = { basic: '基础系', iron: '钢铁系', magic: '魔法系', holy: '圣洁系', ancient: '远古系', legend: '传说系' };
    let lastCat = '';
    MERCENARIES_DATA.forEach(m => {
        if (m.category !== lastCat) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = categoryNames[m.category] || m.category;
            select.appendChild(optgroup);
            lastCat = m.category;
        }
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.icon} ${m.name} (攻击:${gameEngine.formatNumber(m.damage)}, 间隔:${m.attackInterval}s)`;
        select.lastElementChild.appendChild(opt);
    });

    let simUpgradeMode = 'damage';
    document.querySelectorAll('.sim-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sim-mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            simUpgradeMode = tab.dataset.mode;
        });
    });

    // Open / Close
    document.getElementById('btn-simulator').addEventListener('click', () => { modal.style.display = 'flex'; });
    document.getElementById('btn-close-sim').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Run simulation
    document.getElementById('btn-run-sim').addEventListener('click', () => {
        const mercId = select.value;
        const mercData = MERCENARIES_DATA.find(m => m.id === mercId);
        if (!mercData) return;
        const targetLevel = Math.max(2, Math.min(500, parseInt(document.getElementById('sim-target-level').value) || 100));

        const merc = {
            id: mercData.id, damage: mercData.damage, attackInterval: mercData.attackInterval,
            baseCost: mercData.baseCost, damageLevel: 0, intervalLevel: 0,
            _milestoneDamageBonus: 0, _knightHeavyBonus: 0
        };

        const rows = [];
        let totalGold = mercData.baseCost;
        rows.push({
            displayLevel: 1, type: '雇佣', cost: mercData.baseCost, totalCost: totalGold,
            damage: gameEngine.calculateUpgradedDamage(merc), interval: gameEngine.calculateUpgradedInterval(merc), note: ''
        });

        const isKnight = mercData.id === 'knight';
        for (let lvl = 2; lvl <= targetLevel; lvl++) {
            const cost = gameEngine.calculateMercenaryUpgradeCost(merc);
            totalGold += cost;
            const oldDisplayLevel = merc.damageLevel + merc.intervalLevel + 1;
            let upgradeType;
            if (simUpgradeMode === 'damage') upgradeType = 'damage';
            else if (simUpgradeMode === 'interval') upgradeType = 'interval';
            else upgradeType = (lvl % 2 === 0) ? 'damage' : 'interval';

            if (upgradeType === 'damage') merc.damageLevel++;
            else merc.intervalLevel++;

            const newDisplayLevel = merc.damageLevel + merc.intervalLevel + 1;
            if (isKnight && upgradeType === 'damage') {
                merc._knightHeavyBonus = (merc._knightHeavyBonus || 0) + merc.damageLevel * merc.damageLevel * newDisplayLevel;
            }

            let note = '';
            gameEngine.applyMilestoneDamageCheck(merc, oldDisplayLevel, newDisplayLevel);
            if (newDisplayLevel === 50) note = '🎯 攻击力×2';
            if (newDisplayLevel === 75) note = '⚡ 攻速+20%';
            if (newDisplayLevel === 100) note = '🎯⚡ 攻击力×2+攻速+20%';

            rows.push({
                displayLevel: newDisplayLevel,
                type: upgradeType === 'damage' ? '⚔️攻击' : '⚡攻速',
                cost, totalCost: totalGold,
                damage: gameEngine.calculateUpgradedDamage(merc),
                interval: gameEngine.calculateUpgradedInterval(merc),
                note
            });
        }

        // Summary cards
        const last = rows[rows.length - 1];
        document.getElementById('sim-stats-cards').style.display = 'grid';
        document.getElementById('sim-s-level').textContent = `Lv.${last.displayLevel}`;
        document.getElementById('sim-s-level-detail').textContent = `攻${merc.damageLevel} + 速${merc.intervalLevel}`;
        document.getElementById('sim-s-damage').textContent = gameEngine.formatNumber(last.damage);
        document.getElementById('sim-s-damage-detail').textContent = `基础: ${gameEngine.formatNumber(mercData.damage)}`;
        document.getElementById('sim-s-interval').textContent = `${last.interval.toFixed(4)}s`;
        document.getElementById('sim-s-interval-detail').textContent = `基础: ${mercData.attackInterval}s`;
        document.getElementById('sim-s-gold').textContent = gameEngine.formatNumber(last.totalCost);
        document.getElementById('sim-s-gold-detail').textContent = `雇佣${gameEngine.formatNumber(mercData.baseCost)} + 升级${gameEngine.formatNumber(last.totalCost - mercData.baseCost)}`;

        // Table
        const tbody = document.getElementById('sim-tbody');
        tbody.innerHTML = '';
        rows.forEach(r => {
            const tr = document.createElement('tr');
            if (r.displayLevel === 50 || r.displayLevel === 75 || r.displayLevel === 100) tr.classList.add('milestone');
            tr.innerHTML = `<td>${r.displayLevel}</td><td>${r.type}</td><td class="cost-col">${gameEngine.formatNumber(r.cost)}</td><td class="cost-col">${gameEngine.formatNumber(r.totalCost)}</td><td class="dmg-col">${gameEngine.formatNumber(r.damage)}</td><td class="spd-col">${r.interval.toFixed(4)}s</td><td class="note-col">${r.note}</td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('sim-table-wrap').style.display = 'block';
    });

    // Export CSV
    document.getElementById('btn-sim-export').addEventListener('click', () => {
        const rows = document.querySelectorAll('#sim-tbody tr');
        if (rows.length === 0) return;
        let csv = '显示等级,升级类型,本次花费,累计花费,攻击力,攻击间隔,备注\n';
        rows.forEach(tr => {
            const cells = tr.querySelectorAll('td');
            csv += Array.from(cells).map(c => c.textContent.replace(/,/g, '')).join(',') + '\n';
        });
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `upgrade_sim_${select.value}.csv`;
        a.click();
    });
}

// ========== Start ==========
boot();
