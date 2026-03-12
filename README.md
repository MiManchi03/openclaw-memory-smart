# @openclaw/memory-smart

智能记忆系统插件，为 OpenClaw 提供强大的记忆管理能力。

[![npm version](https://img.shields.io/npm/v/@openclaw/memory-smart.svg)](https://www.npmjs.com/package/@openclaw/memory-smart)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能特性

### 1. 时间任务提醒 ⏰
- 支持中文时间表达：`每天七点半`、`下周三18点`、`下个月早上7:30`
- 一次性提醒和循环提醒（每天/每周/每月）
- 重启后自动恢复任务

### 2. 上下文记忆 💬
- 自动保存对话历史
- 重启后自动恢复对话上下文
- 搜索相关对话

### 3. 智能实体记忆 🧠
- **6档记忆系统**：根据信息类型自动分配优先级
- **自动衰减**：24小时无访问衰减1天
- **强化机制**：使用后自动强化记忆
- **负反馈降权**：用户不想被提及时自动降权
- **永久记忆**：重要信息可设为永久不忘

## 快速开始

### 安装

```bash
# 从 npm 安装（推荐）
openclaw plugin install memory-smart

# 或从 GitHub 安装开发版
openclaw plugin install https://github.com/your-username/openclaw-memory-smart
```

### 使用方式

安装后重启 OpenClaw，插件会自动加载 **13 个工具**：

| 工具名称 | 功能 |
|---------|------|
| `smart_memory_create_reminder` | 创建时间提醒任务 |
| `smart_memory_create_scheduled_content` | 创建定时发送任务 |
| `smart_memory_list_tasks` | 列出所有任务 |
| `smart_memory_delete_task` | 删除任务 |
| `smart_memory_search_context` | 搜索记忆 |
| `smart_memory_get_recent_context` | 获取最近对话 |
| `smart_memory_add_message` | 添加消息到上下文 |
| `smart_memory_analyze_message` | 分析消息提取记忆 |
| `smart_memory_set_permanent` | 设为永久记忆 |
| `smart_memory_remove_permanent` | 取消永久记忆 |
| `smart_memory_update` | 更新记忆内容 |
| `smart_memory_delete` | 删除记忆 |
| `smart_memory_status` | 查看系统状态 |

## 示例对话

### 创建提醒

```
用户：每天七点半提醒我开会
Agent：调用 smart_memory_create_reminder
结果：已创建提醒任务: 开会
      触发时间: 每天 07:30
      类型: daily
```

### 搜索记忆

```
用户：你记得我多高吗？
Agent：调用 smart_memory_search_context(user_id="xxx", query="身高")
结果：返回记忆中的身高信息及档位
```

### 设置永久记忆

```
用户：我的血型很重要，帮我记住
Agent：调用 smart_memory_set_permanent(user_id="xxx", key="血型")
结果：已将"血型"设为永久记忆
```

## 记忆档位系统

### 档位划分

| 档位 | 名称 | 剩余天数 | 说明 |
|------|------|---------|------|
| 0 | 永久记忆 | ∞ | 仅用户指令可设置/解除 |
| 1 | 最高优先级 | 60天 | 封顶 |
| 2 | 高优先级 | 40-60天 | |
| 3 | 中优先级 | 25-40天 | |
| 4 | 一般优先级 | 15-25天 | |
| 5 | 低优先级 | 7-15天 | |
| 6 | 弱记忆 | 0-7天 | 不主动调用 |

### 信息类型与初始天数

| 信息类型 | 示例 | 初始天数 |
|---------|------|---------|
| 核心信息 | 身高、体重、MBTI、血型 | 60天 |
| 偏好信息 | 喜欢游戏、饮食偏好 | 25天 |
| 临时信息 | 当前心情、临时约定 | 7天 |

### 衰减规则

- **触发条件**：距上次访问 24 小时
- **衰减方式**：剩余天数 -1
- **最低限制**：0天时彻底删除
- **永久记忆**：不参与任何衰减

### 强化规则

- **触发条件**：AI 生成回复时调用了该记忆
- **强化方式**：`新剩余天数 = 当前剩余天数 + 上一档位差值`
- **封顶限制**：最高 60 天

### 负反馈机制

- **触发**：用户表达"不想"、"不要"等负面情绪
- **降权**：剩余天数减半，落入更低2个档位
- **2次负反馈**：打入弱记忆，不再主动调用

## 项目架构

```
memory-smart/
├── plugin.ts                 # 插件入口，注册13个工具
├── index.ts                 # 主模块，导出智能记忆系统
├── types.ts                 # TypeScript 类型定义
├── config.ts                # 配置管理
├── shared/
│   └── db.ts               # SQLite 数据库初始化
├── tasks/
│   ├── parser.ts           # 中文时间解析
│   ├── storage.ts          # 任务存储
│   └── scheduler.ts        # 任务调度器
├── context/
│   └── storage.ts          # 对话上下文存储
└── entities/
    ├── memory-tier.ts      # 档位系统核心
    ├── storage.ts          # 实体存储（CRUD）
    ├── analyzer.ts        # 消息分析提取
    └── decay.ts           # 衰减与强化逻辑
```

### 核心模块说明

#### 1. memory-tier.ts（档位系统）
- 定义7个档位常量
- 计算当前档位、档位差值
- 判断是否弱记忆

#### 2. storage.ts（实体存储）
- 基础 CRUD 操作
- `strengthenEntity()` - 强化记忆
- `decayEntity()` - 衰减记忆
- `applyNegativeFeedback()` - 负反馈降权
- `setPermanent()` / `removePermanent()` - 永久记忆

#### 3. analyzer.ts（消息分析）
- 正则匹配提取实体（身高、体重、偏好等）
- `detectNegativeFeedback()` - 检测用户负反馈

#### 4. decay.ts（衰减调度）
- 每24小时检查并衰减
- 使用时自动强化

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-username/openclaw-memory-smart.git
cd openclaw-memory-smart

# 安装依赖
npm install

# 类型检查
npm run typecheck

# 构建
npm run build
```

### 添加新功能

1. 在 `entities/storage.ts` 添加存储逻辑
2. 在 `plugin.ts` 注册新工具
3. 更新 README.md 文档

### 代码规范

- 使用 TypeScript strict 模式
- 使用 ESLint 检查代码
- 提交前运行 `npm run typecheck`

## 技术栈

- **语言**: TypeScript
- **数据库**: SQLite (node:sqlite)
- **类型定义**: @sinclair/typebox
- **依赖**: OpenClaw Plugin SDK

## 常见问题

### Q: 如何查看当前记忆状态？
A: 调用 `smart_memory_status` 工具

### Q: 永久记忆可以删除吗？
A: 可以，通过 `smart_memory_delete` 工具删除

### Q: 负反馈后可以恢复吗？
A: 可以，用户再次主动提及该信息时会重新强化

### Q: 数据存储在哪里？
A: 默认存储在 `./.openclaw-memory/smart-memory.db`

## 相关文档

- [OpenClaw 插件开发文档](https://docs.openclaw.ai)
- [OpenClaw 官方插件列表](https://github.com/openclaw/openclaw)

## 许可证

MIT License - 请随意使用和修改

## 贡献者

欢迎提交 Issue 和 Pull Request！
