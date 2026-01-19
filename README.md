# 打BOSS - 微信小程序放置点击游戏

一个基于微信小程序的放置点击RPG游戏，灵感来自"打BOSS"。采用像素风格设计。

## 🎮 游戏特色

- **点击战斗**: 点击Boss造成伤害，击败Boss获得金币奖励
- **佣兵系统**: 招募5种不同的佣兵，自动攻击Boss
- **放置玩法**: 佣兵自动攻击，即使离线也能获得收益
- **无限进度**: Boss难度和奖励随等级递增
- **像素风格**: 复古像素艺术风格UI设计

## 📁 项目结构

```
Idle game/
├── pages/              # 页面
│   ├── battle/        # 战斗页面
│   └── mercenaries/   # 佣兵管理页面
├── utils/             # 工具函数
│   ├── gameEngine.js  # 游戏引擎
│   └── saveManager.js # 保存管理
├── data/              # 游戏数据
│   └── mercenaries.js # 佣兵定义
├── assets/            # 资源文件
│   └── icons/         # 图标
├── app.js             # 应用入口
├── app.json           # 应用配置
├── app.wxss           # 全局样式
└── project.config.json # 项目配置
```

## 🚀 快速开始

### 前置要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序开发者账号（可选，可使用测试号）

### 安装步骤

1. **下载项目**
   ```bash
   # 项目已在本地目录
   cd "c:\workspace\FHL\Personal\Idle game"
   ```

2. **打开微信开发者工具**
   - 启动微信开发者工具
   - 选择"导入项目"
   - 选择项目目录: `c:\workspace\FHL\Personal\Idle game`
   - AppID: 使用测试号或填入你的AppID

3. **运行项目**
   - 点击"编译"按钮
   - 在模拟器中查看效果

## 🎯 核心玩法

### 战斗系统
- 点击Boss造成伤害
- 击败Boss获得金币并进入下一关
- Boss血量随等级指数增长
- 升级点击伤害提升手动攻击力

### 佣兵系统
佣兵会自动攻击Boss，提供持续DPS：

| 佣兵 | 基础成本 | 伤害 | 攻击间隔 |
|------|---------|------|----------|
| ⚔️ 战士 | 10 | 1 | 1.0秒 |
| 🏹 弓箭手 | 50 | 3 | 1.5秒 |
| 🔮 法师 | 200 | 10 | 2.0秒 |
| 🛡️ 骑士 | 800 | 40 | 1.2秒 |
| 🐉 龙骑士 | 5000 | 200 | 2.5秒 |

### 离线收益
- 离线时佣兵继续战斗（效率70%）
- 最多计算8小时离线收益
- 重新进入游戏时显示离线收益弹窗

## 🎨 技术特点

- **像素风格UI**: 使用CSS实现复古像素艺术风格
- **自动保存**: 每30秒自动保存游戏进度
- **大数字处理**: 支持显示亿、兆等大数字单位
- **性能优化**: 高效的游戏循环和状态管理

## 📝 游戏公式

### Boss血量
```
HP = 100 × (1.5 ^ 等级)
```

### Boss奖励
```
金币 = 10 × 等级 × (1.2 ^ 等级)
```

### 佣兵成本
```
成本 = 基础成本 × (1.15 ^ 当前数量)
```

### 点击伤害升级成本
```
成本 = 10 × (1.5 ^ 当前伤害值)
```

## 🔧 自定义开发

### 添加新佣兵
编辑 `data/mercenaries.js`，在 `MERCENARIES_DATA` 数组中添加新佣兵：

```javascript
{
  id: 'new_merc',
  name: '新佣兵',
  baseCost: 1000,
  damage: 50,
  attackInterval: 1.5,
  description: '描述',
  icon: '🎯'
}
```

### 调整游戏平衡
在 `utils/gameEngine.js` 中修改相关公式：
- `calculateBossMaxHp()` - Boss血量
- `calculateBossReward()` - Boss奖励
- `calculateUpgradeCost()` - 升级成本

## 📱 兼容性

- 微信小程序基础库版本: 2.19.4+
- 支持iOS和Android平台

## 🐛 已知问题

- 暂无

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**享受游戏！打败所有Boss！** 🎮
