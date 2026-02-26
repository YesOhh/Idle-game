// utils/saveManager.js - 游戏保存/加载管理器 (Web localStorage version)

const SAVE_KEY = 'idle_boss_game_save';

export function saveGame(gameData) {
    try {
        const saveData = {
            ...gameData,
            // Strip runtime-only fields from mercenaries
            mercenaries: gameData.mercenaries ? gameData.mercenaries.map(m => {
                const clone = { ...m };
                // Remove timer/runtime fields
                delete clone._attackTimer;
                delete clone._timeBurstTimer;
                delete clone._periodicBurstTimer;
                delete clone._dragonSoulStacks;
                return clone;
            }) : [],
            stats: { ...gameData.stats, lastSaveTime: Date.now() }
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        return true;
    } catch (error) {
        console.error('保存游戏失败:', error);
        return false;
    }
}

export function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const saveData = JSON.parse(raw);
            const now = Date.now();
            const lastSaveTime = saveData.stats.lastSaveTime || now;
            const offlineSeconds = Math.floor((now - lastSaveTime) / 1000);
            return { ...saveData, offlineSeconds };
        }
        return null;
    } catch (error) {
        console.error('加载游戏失败:', error);
        return null;
    }
}

export function deleteSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
        return true;
    } catch (error) {
        console.error('删除存档失败:', error);
        return false;
    }
}

export function hasSave() {
    try {
        return !!localStorage.getItem(SAVE_KEY);
    } catch (error) {
        return false;
    }
}
