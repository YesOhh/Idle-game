// utils/saveManager.js - 游戏保存/加载管理器

const SAVE_KEY = 'idle_boss_game_save';

/**
 * 保存游戏数据到本地存储
 * @param {Object} gameData - 游戏数据
 */
function saveGame(gameData) {
    try {
        const saveData = {
            ...gameData,
            stats: {
                ...gameData.stats,
                lastSaveTime: Date.now()
            }
        };

        wx.setStorageSync(SAVE_KEY, saveData);
        return true;
    } catch (error) {
        console.error('保存游戏失败:', error);
        return false;
    }
}

/**
 * 从本地存储加载游戏数据
 * @returns {Object|null} - 游戏数据或null
 */
function loadGame() {
    try {
        const saveData = wx.getStorageSync(SAVE_KEY);

        if (saveData) {
            // 计算离线时间
            const now = Date.now();
            const lastSaveTime = saveData.stats.lastSaveTime || now;
            const offlineSeconds = Math.floor((now - lastSaveTime) / 1000);

            // 迁移：修复传授技能双重转生加成bug，清零旧的膨胀数据
            if (!saveData._teachingBugFixed && saveData.mercenaries) {
                saveData.mercenaries.forEach(m => { m._teachingBonus = 0; });
                saveData._teachingBugFixed = true;
            }

            return {
                ...saveData,
                offlineSeconds
            };
        }

        return null;
    } catch (error) {
        console.error('加载游戏失败:', error);
        return null;
    }
}

/**
 * 删除保存的游戏数据
 */
function deleteSave() {
    try {
        wx.removeStorageSync(SAVE_KEY);
        return true;
    } catch (error) {
        console.error('删除存档失败:', error);
        return false;
    }
}

/**
 * 检查是否有存档
 * @returns {boolean}
 */
function hasSave() {
    try {
        const saveData = wx.getStorageSync(SAVE_KEY);
        return !!saveData;
    } catch (error) {
        return false;
    }
}

module.exports = {
    saveGame,
    loadGame,
    deleteSave,
    hasSave
};
