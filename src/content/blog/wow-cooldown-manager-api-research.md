---
title: "魔兽世界 Cooldown Manager（CDM）与相关 API：架构、状态机制及插件开发应用研究"
description: "从公开 API、Blizzard UI 源码与特定客户端实机观察出发，梳理 CDM 的技能目录、Frame 状态、Secret Value 边界及插件开发中的生命周期管理。"
date: 2026-09-30
tags:
  - 魔兽世界
  - 插件开发
  - Cooldown Manager
  - Lua
  - Secret Value
category: Coding
cover: "/images/blog/wow-cooldown-manager/01-architecture.svg"
pinned: false
draft: false
---

# 魔兽世界 Cooldown Manager（CDM）与相关 API：架构、状态机制及插件开发应用研究

![Cooldown Manager 从技能目录到状态展示的架构示意](/images/blog/wow-cooldown-manager/01-architecture.svg)

## 一、引言

随着《魔兽世界》进入 Midnight 时代，暴雪正在重新调整游戏客户端、默认 UI 与第三方插件之间的边界。

其中一个非常重要的变化，是 Blizzard 在 11.1.5 开始加入并持续完善的 **Cooldown Manager（冷却管理器，以下简称 CDM）**。

从玩家视角来看，CDM 只是默认界面中的技能冷却、Buff 和重要状态展示工具；但从插件开发角度来看，它的意义要大得多。

CDM 实际上构成了一套新的：

**技能目录 → 状态数据 → CooldownViewer → Frame → Alert**

运行体系。

尤其是在 Midnight 引入 Secret Value 后，很多传统战斗数据开始受到访问限制，而 Blizzard 自己的 CooldownViewer 仍然需要正确显示 Buff、技能冷却、充能、触发状态等信息，因此 CDM 成为了理解新一代 WoW UI 状态系统的重要入口。

Blizzard 对这一设计方向的解释是：限制插件“处理”当前战斗信息的能力，同时尽量保留插件“显示”这些信息的能力。某些当前战斗状态会变成 Secret Value，即插件可以承载或显示这些数据，但不能像普通 Lua 值一样自由读取、比较和参与决策。与此同时，Blizzard 也在扩展原生 UI 与受控 API，为插件提供新的安全数据路径。

本文尝试从 API、Blizzard UI 源码以及实机观察三个层面，对 CDM 的结构和可利用能力进行一次系统整理。

---

# 二、CDM 并不只是“冷却条”

从名字看，Cooldown Manager 很容易让人以为它只是技能 CD 显示器。

实际上，当前 CooldownViewer 至少涉及以下几种信息：

- 技能冷却；
- 技能充能；
- 玩家 Buff；
- 目标 Debuff；
- 图腾；
- 技能替换；
- Spell Activation Overlay；
- Pandemic 刷新窗口；
- 技能 Alert；
- 技能是否学习；
- 技能目录与分类；
- CooldownViewer 布局和可见性。

Blizzard 自己的 `Blizzard_CooldownViewer` 源码也表明，CooldownViewer 的 Buff Item 会综合 Aura、Totem、Linked Spell 等数据决定自身状态，而普通 Cooldown Item 则会处理技能 CD、充能、可用性以及 Spell Activation Overlay。

因此，更准确地说，CDM 是一套：

> **面向职业战斗信息的结构化状态展示系统。**

它不仅知道“技能还有几秒冷却”，还维护“这个 Viewer Item 代表什么”“是否处于 Active 状态”“是否应该显示”“是否有 Aura”“是否存在替换技能”等信息。

---

# 三、公开接口：`C_CooldownViewer`

目前 CooldownViewer 的公开命名空间为：

```lua
C_CooldownViewer
```

从 Blizzard 自动生成的 API Documentation 可以确认，目前核心接口包括：

```lua
C_CooldownViewer.GetCooldownViewerCategorySet()
C_CooldownViewer.GetCooldownViewerCooldownInfo()
C_CooldownViewer.GetLayoutData()
C_CooldownViewer.GetValidAlertTypes()
C_CooldownViewer.IsCooldownViewerAvailable()
C_CooldownViewer.SetLayoutData()
```

其中部分接口声明了：

```text
SecretArguments = "AllowedWhenUntainted"
```

这意味着这些接口已经被纳入新的 Secret Value / taint 安全模型中。

对于插件研究而言，最有价值的是前两个。

---

# 四、`GetCooldownViewerCategorySet`：建立 CDM 目录

基本形式：

```lua
local cooldownIDs =
    C_CooldownViewer.GetCooldownViewerCategorySet(
        category,
        allowUnlearned
    )
```

它的作用是：

> 返回指定 CooldownViewer Category 下的 cooldownID 集合。

第二个参数：

```lua
allowUnlearned
```

很重要。

如果设置：

```lua
true
```

目录中可以包含当前角色尚未学习的技能。

因此：

```text
目录中存在某 cooldownID
```

不能等价于：

```text
当前角色已经学习该技能
```

这也是为什么后续还需要读取：

```lua
cooldownInfo.isKnown
```

进行判断。

从架构上看，`GetCooldownViewerCategorySet` 很适合用于建立动态 Catalog，而不是在插件内部长期维护一张写死的 cooldownID 表。

一个更合理的流程是：

```text
客户端启动
   ↓
CooldownViewer 数据加载
   ↓
枚举 Category
   ↓
得到 cooldownID
   ↓
解析 CooldownInfo
   ↓
建立本地索引
```

这使插件能够跟随客户端和 Hotfix 自动更新。

---

# 五、`GetCooldownViewerCooldownInfo`：CDM 最重要的元数据接口

调用形式：

```lua
local info =
    C_CooldownViewer.GetCooldownViewerCooldownInfo(cooldownID)
```

官方文档特别标记：

```text
MayReturnNothing = true
```

因此，没有返回值并不能简单解释成“这个 cooldownID 永远不存在”，调用方应该保留 NO_DATA、API 不可用或扫描不完整等状态。

当前 `CooldownViewerCooldown` 数据结构至少包含：

```text
cooldownID
spellID
overrideSpellID
overrideTooltipSpellID
linkedSpellIDs
selfAura
hasAura
charges
isKnown
flags
category
```


这些字段值得分别理解。

---

## 六、`spellID`：基础技能映射

最直接的关系是：

```text
cooldownID
    ↓
spellID
```

例如一个 CDM 条目可能对应：

```text
cooldownID = 111050
spellID    = 408459
```

这类关系可以称为：

**Direct Mapping，直接映射。**

它比通过名称、图标甚至 Tooltip 推断技能身份更加可靠。

但需要注意：

> spellID 直连只说明目录映射较明确，并不自动证明这个 Frame 在所有场景下只表示这个单一 Aura 或单一战斗状态。

实机观察中已经出现 cooldownID 同时携带多个关联 SpellID 的情况，因此目录映射和运行时语义必须区分。

---

# 七、`overrideSpellID`：技能替换系统

现代 WoW 中同一个能力可能由于：

- 天赋；
- 专精；
- Hero Talent；
- Spell Override；
- 形态；
- 其他职业机制；

被替换成另一个 Spell。

因此 CooldownViewer 不是简单维护：

```text
cooldownID → spellID
```

而可能是：

```text
cooldownID
   ↓
base spell
   ↓
override spell
```

API 中提供：

```lua
overrideSpellID
```

正是为了表达这种关系。

对应的事件：

```text
COOLDOWN_VIEWER_SPELL_OVERRIDE_UPDATED
```

还会提供：

```text
baseSpellID
overrideSpellID
```

其中 `overrideSpellID == nil` 表示 override 被移除。

因此，对于长期运行的插件来说，不能只在登录时读取一次 SpellID。

更合理的设计是：

```text
基础目录
   ↓
监听 Spell Override
   ↓
映射失效
   ↓
重新解析
```

---

# 八、`linkedSpellIDs`：最容易被误解的字段

一个 cooldownID 可以同时关联多个 SpellID：

```text
cooldownID
├── spellID
└── linkedSpellIDs[]
```

这对理解 Blizzard 内部职业机制很有价值。

但它也非常容易产生错误推论。

例如：

```text
cooldownID 当前 Active
```

并不能推出：

```text
所有 linkedSpellIDs 对应的 Buff 都 Active
```

更不能认为每一个 linkedSpellID 都代表独立的 Aura。

实机观察中，同一 cooldownID 的多个关联 ID 会共享同一个 Frame 状态信号。多个关联 ID 被记录，并不等于发生了多个独立 Buff。

因此正确模型应该是：

```text
Cooldown Entry
    │
    ├── Primary Spell
    ├── Override Spell
    └── Linked Spells
```

而不是：

```text
一个 SpellID = 一个独立状态
```

---

# 九、`hasAura` 与 `selfAura`

`CooldownViewerCooldown` 还有两个很值得关注的字段：

```lua
hasAura
selfAura
```

它们可以帮助插件了解：

> 这个 CDM 条目是否具有 Aura 相关语义。

但它们仍然只是 **Metadata**。

例如：

```text
hasAura = true
```

不能直接解释成：

```text
当前 Aura 存在
```

同样：

```text
selfAura = true
```

也不能直接视为：

```text
玩家当前拥有该 Buff
```

更准确的模型应该分成两层：

```text
静态元数据

hasAura
selfAura
spellID
linkedSpellIDs
```

以及：

```text
运行时状态

ACTIVE
INACTIVE
UNKNOWN
```

两者不能混用。

---

# 十、`isKnown`：技能是否属于当前角色

另一个实用字段是：

```lua
isKnown
```

它能够帮助过滤：

```text
存在于职业目录
```

但：

```text
当前角色并未学习
```

的能力。

尤其在使用：

```lua
GetCooldownViewerCategorySet(category, true)
```

进行完整目录扫描时，这个字段非常有意义。

理论上可以形成：

```text
Catalog Entry
├── Exists
├── IsKnown
├── HasAura
├── Charges
├── Category
└── Spell Mapping
```

这样的完整能力描述。

---

# 十一、`GetValidAlertTypes`：Alert 能力目录

接口：

```lua
C_CooldownViewer.GetValidAlertTypes(cooldownID)
```

返回：

```text
CooldownViewerAlertEventType[]
```

官方 API 定义确认该接口返回某个 cooldownID 支持的 Alert 类型。

这里必须注意：

**Valid Alert Type 是能力信息，不是当前状态。**

例如某条目支持：

```text
Available
OnCooldown
ChargeGained
```

只能说明：

> 该条目理论上支持这些 Alert。

不能直接推出：

```text
技能现在 Available
```

或者：

```text
刚刚获得了一层 Charge
```

因此它更适合作为：

```text
Capability Metadata
```

而不是 Runtime State。

---

# 十二、`IsCooldownViewerAvailable`

接口：

```lua
local available, reason =
    C_CooldownViewer.IsCooldownViewerAvailable()
```

返回：

```text
isAvailable
failureReason
```


这个 API 很适合用于环境诊断，例如解释：

```text
为什么 CooldownViewer 没有加载？
```

但：

```text
Viewer 不可用
```

不能直接推出：

```text
某 Buff 不存在
```

也不能将 Viewer 的可见性状态当成游戏战斗状态。

---

# 十三、三个重要系统事件

目前公开 API 定义中还有三个非常值得插件开发者监听的事件：

```text
COOLDOWN_VIEWER_DATA_LOADED
COOLDOWN_VIEWER_SPELL_OVERRIDE_UPDATED
COOLDOWN_VIEWER_TABLE_HOTFIXED
```


它们分别承担不同生命周期职责。

### `COOLDOWN_VIEWER_DATA_LOADED`

表示 CDM 数据已经加载。

适合用于：

```text
开始第一次目录扫描
```

而不是仅依赖 `PLAYER_LOGIN` 后固定延时。

---

### `COOLDOWN_VIEWER_SPELL_OVERRIDE_UPDATED`

表示：

```text
base spell
   ↓
override spell
```

关系发生变化。

这种情况可能由：

- 天赋改变；
- 专精改变；
- 技能 morph；
- 其他能力替换；

引起。

因此该事件非常适合作为：

```text
Catalog Invalidation Trigger
```

---

### `COOLDOWN_VIEWER_TABLE_HOTFIXED`

这一事件更值得注意。

它意味着 Blizzard 可以通过 Hotfix 更新 CooldownViewer Table。

因此：

> cooldownID 不是一个应该长期永久硬编码的稳定业务 ID。

更安全的做法是：

```text
TABLE_HOTFIXED
     ↓
现有映射失效
     ↓
重新扫描 Category
     ↓
重新构建索引
```

---

# 十四、真正关键的运行时状态并不来自公共 API

目前 `C_CooldownViewer` 没有公开类似：

```lua
C_CooldownViewer.IsActive(cooldownID)
```

这样的 API。

真正有意思的部分存在于：

```text
Blizzard_CooldownViewer
```

的 Frame / Mixin 实现中。

其中核心逻辑之一是：

```lua
function CooldownViewerItemMixin:RefreshActive()
    self:SetIsActive(self:ShouldBeActive())
end
```

随后：

```lua
function CooldownViewerItemMixin:SetIsActive(active)
    if active ~= self.isActive
        or self.isActiveSpell ~= self:GetSpellID()
    then
        self.isActive = active
        self.isActiveSpell = self:GetSpellID()
        self:OnActiveStateChanged()
    end
end
```

Blizzard 当前 `live` UI 源码表明，`SetIsActive` 不仅会在 `isActive` 发生变化时调用 `OnActiveStateChanged`，当当前对应 SpellID 发生变化时，同样会触发这一回调。

这带来一个很重要的结论：

> `OnActiveStateChanged` 是很有价值的低噪声状态重读时机，但它不能被简单解释成纯粹的“Buff 出现/消失事件”。

因为触发原因也可能是：

```text
Item 表示的 Spell 身份发生变化
```

而并非 Active Boolean 改变。

因此可靠实现应该在收到状态回调后重新确认：

```text
当前 cooldownID
当前 spellID
当前映射 generation
当前 isActive
```

而不是永久把一个 Frame 和第一次看到的 SpellID 绑定。

---

# 十五、Buff Item 的 `ShouldBeActive`

CDM 中 Buff Item 的运行机制尤其值得关注。

当前 Blizzard UI 源码中：

```lua
CooldownViewerBuffItemMixin:ShouldBeActive()
```

会综合：

- 当前 Aura 缓存；
- Aura 是否过期；
- Totem 信息；
- Linked Spell；
- Player / Target Aura；

判断自身是否 Active。

源码同时显示，Buff Item 可能对：

```text
player
target
```

两类 Aura 感兴趣。

这带来了一个极为重要的边界：

```text
Frame ACTIVE
```

不能天然等同于：

```text
玩家拥有某 SpellID 的 Buff
```

因为它有可能由：

- 玩家 Aura；
- 目标 Aura；
- Totem；
- Linked Spell；

等不同来源驱动。

实机源码复核也得出了相同结论：即使一个条目存在 `spellID` 直连，在没有逐场景语义验证的情况下，也不能直接把该 Frame 的 ACTIVE 命名成“玩家某 Buff 存在”。

---

# 十六、`TriggerAuraAppliedAlert` 与 `TriggerAuraRemovedAlert`

CooldownViewer 内部还有：

```text
TriggerAuraAppliedAlert
TriggerAuraRemovedAlert
```

等机制。

从名称上很容易认为：

```text
Applied → ACTIVE
Removed → INACTIVE
```

但源码并不支持这种简单等价。

Blizzard 的处理顺序中，Aura Removal 的 Alert 可能发生在 Item Frame 完成刷新之前；而某些 Full Update 也可能直接重新布局，而没有对每一个 Aura 分别产生 applied/removed 回调。

因此更合理的解释是：

```text
TriggerAuraAppliedAlert
TriggerAuraRemovedAlert
```

表示：

> Viewer 报告了相关 Aura 实例变化。

而不是：

> Frame 已经确定进入 ACTIVE/INACTIVE。

实机研究中也观察到，真正支持 Frame 状态判断的是独立读取的公开 `isActive` Boolean，而不是根据回调名字自行赋予 ACTIVE 或 INACTIVE。

因此插件设计最好采用：

```text
Callback
   ↓
事件提示
   ↓
重新读取当前 Frame 状态
```

而不是：

```text
Callback 名称
   ↓
直接推导 Buff 状态
```

---

# 十七、CDM 中的 Spell Activation Overlay

CooldownViewer 不仅处理 Aura。

普通 Cooldown Item 的源码还会调用：

```lua
C_SpellActivationOverlay.IsSpellOverlayed(spellID)
```

并通过：

```text
ActionButtonSpellAlertManager
```

控制技能触发发光。

这说明 Blizzard 当前默认 UI 已经把多种职业战斗状态整合进同一个 CooldownViewer Item 生命周期：

```text
Cooldown
Charges
Aura
Usability
Overlay Glow
Active State
```

从系统设计角度看，CooldownViewer 已经逐渐成为一种：

> **Battle UI State Aggregator**

而不仅是简单的 Cooldown Display。

---

# 十八、Secret Value 环境下 CDM 为什么特别重要

Blizzard 在 Midnight 插件调整说明中明确表示：

> 当前战斗状态中的部分信息会被标记为 Secret Value。

插件仍然可以：

- 移动某些 Buff；
- 调整 Buff Frame 的大小；
- 调整 Nameplate；
- 调整 Cast Bar；

但不能再像过去那样自由取得所有原始战斗值后做任意计算。

这使插件开发出现了一个新的架构问题：

过去：

```text
Game API
   ↓
Raw Combat Data
   ↓
Addon Logic
   ↓
Addon UI
```

未来更可能是：

```text
Game State
   ↓
Blizzard Controlled State Layer
   ↓
Public / Secret Boundary
   ↓
Addon Observation
   ↓
Addon UI
```

而 CDM 正是 Blizzard Controlled State Layer 中最值得研究的系统之一。

---

# 十九、公开 Boolean 与 Secret Value 必须严格区分

![公开 Boolean 与 UNKNOWN 的三值状态判断](/images/blog/wow-cooldown-manager/03-three-states.svg)

如果一个 Frame 当前存在：

```lua
isActive
```

仍然不能因为字段名看起来像 Boolean，就直接认为插件能够安全使用。

实际开发中应该至少做：

```text
字段存在？
   ↓
调用成功？
   ↓
是否 Secret？
   ↓
Lua type 是否为 boolean？
```

只有最后得到普通公开：

```lua
true
false
```

才可以作为普通 Lua 状态处理。

否则应该保持：

```text
UNKNOWN
```

而不是：

```text
false
```

这是非常重要的工程原则：

> **Unknown ≠ False。**

实机实验表明，在特定正式服 Build 和特定职业场景中，确实可以观察到部分 CooldownViewer 直连条目的公开 `ACTIVE/INACTIVE` Boolean；但这一结论仍然只应绑定到对应客户端 Build、角色构筑以及实验场景，而不能扩展成“所有 Buff 都能读取”。

---

# 二十、CDM Frame Pool 带来的另一个问题：Frame 会复用

CooldownViewer 使用 Frame Pool。

这意味着一个 Frame：

```text
这一刻
→ cooldownID A
```

下一次可能：

```text
→ cooldownID B
```

因此不能：

```lua
frame → 永久 spellID
```

更合理的结构是：

```text
Frame
  ↓
每次回调
  ↓
重新读取 cooldownID
  ↓
重新查询当前映射
```

否则非常容易产生：

```text
旧技能状态
被错误记录到新技能
```

的问题。

实机实现中采用“回调时重新读取当前 cooldownID”的策略，就是为了避免 Frame Pool 复用造成永久身份绑定。

---

# 二十一、不要把“Frame 正在使用”当成“Buff Active”

另一个很常见的误解是：

```text
Frame Pool 中的 Active Frame
```

和：

```text
frame.isActive
```

是完全不同的概念。

前者表示：

> 这个 UI Frame 当前从对象池中被分配使用。

后者才表示：

> CooldownViewer Item 当前计算得到的 Active 状态。

除此之外还有：

```text
Frame 是否 Show
Viewer 是否 Show
Buff 是否存在
```

这些也完全不同。

因此至少存在：

```text
Pool Active
Frame Active
Frame Visible
Aura Active
Viewer Visible
```

五个不同概念。

实际插件设计中不应把它们混成一个 `active`。

---

# 二十二、建议的数据模型

![Catalog、Runtime Frame、Observation 与 Semantic State 四层数据模型](/images/blog/wow-cooldown-manager/02-data-layers.svg)

对于希望研究或使用 CooldownViewer 的插件，我认为比较合理的数据结构可以拆成四层。

## 第一层：Catalog

```text
cooldownID
spellID
overrideSpellID
overrideTooltipSpellID
linkedSpellIDs
category
isKnown
charges
hasAura
selfAura
flags
```

来源：

```lua
C_CooldownViewer
```

---

## 第二层：Runtime Frame

```text
viewer
frame
currentCooldownID
currentSpellID
isActive
isShown
```

来源：

```text
Blizzard_CooldownViewer Frame
```

---

## 第三层：Observation

```text
OnActiveStateChanged
AuraApplied callback
AuraRemoved callback
Scan
Spell Override event
Table Hotfix event
```

这里记录：

> 发生了什么观察事件。

而不是直接赋予战斗语义。

---

## 第四层：Semantic State

只有经过验证之后，才进一步解释：

```text
这个状态真正代表什么？
```

例如：

```text
CooldownEntryActive
PlayerBuffActive
TargetDebuffActive
TotemActive
SpellOverlayActive
```

如果语义尚未验证，就应该保留：

```text
UNKNOWN
```

---

# 二十三、生命周期管理比 API 调用本身更重要

![映射失效、重新解析与新一轮观察的生命周期](/images/blog/wow-cooldown-manager/04-lifecycle.svg)

CooldownViewer 不是静态数据。

以下情况都可能使之前保存的状态失效：

- 登录；
- `/reload`；
- Viewer 开关；
- 编辑模式；
- 进入/离开战斗；
- 专精改变；
- 天赋改变；
- Spell Override；
- Table Hotfix；
- Frame Pool 复用；
- Viewer 重新布局；
- 客户端版本变化。

因此一个稳健实现应该具备：

```text
generation
session
build
mappingGeneration
```

等生命周期概念。

当发生：

```text
目录变化
Spell Override
Hotfix
Frame 身份变化
```

时，不应该继续沿用旧状态。

---

# 二十四、CDM 可以用于哪些插件功能？

在不越过 Secret Value 和 Protected Action 边界的前提下，CDM 有不少合理用途。

例如：

### 1. 自定义冷却展示

通过目录找到技能，再使用自定义布局集中展示：

```text
Essential
Utility
Tracked Buff
Tracked Bar
```

---

### 2. 职业状态面板

对已经经过验证的 CooldownViewer Entry：

```text
ACTIVE
INACTIVE
UNKNOWN
```

进行独立显示。

---

### 3. Debug / Diagnostic 工具

显示：

```text
cooldownID
spellID
overrideSpellID
linkedSpellIDs
hasAura
selfAura
isKnown
category
frame state
```

用于分析职业机制和 Blizzard 默认 UI 行为。

---

### 4. CooldownViewer 数据浏览器

甚至可以制作一个客户端内数据库：

```text
职业
  ↓
Category
  ↓
cooldownID
  ↓
Spell Mapping
  ↓
Alert Types
```

对插件开发和职业机制研究都很有价值。

---

### 5. 状态驱动的 UI 提示

如果某个 CDM Entry 的运行语义经过充分验证，并且其状态是公开 Boolean，可以基于：

```text
Entry ACTIVE
```

改变：

```text
图标
文字
边框
提示区域
```

但这里必须强调：

> CDM 状态可观察，并不等于插件因此获得执行受保护战斗动作的权限。

“状态观察”和“自动施法”属于完全不同的权限层。

---

# 二十五、不建议的使用方式

同样，有几类做法应该避免。

### 1. 从 UI 显示反推出 Secret Value

例如通过：

```text
Frame Width
StatusBar
Alpha
Color
Texture
```

间接恢复 Secret 数值。

这和 Blizzard 当前限制方向明显冲突，并且极易随着客户端更新失效。

---

### 2. 把 UNKNOWN 当 false

如果：

```text
Frame 不存在
API 失败
Secret
目录未加载
```

都直接解释为：

```text
INACTIVE
```

会产生非常严重的逻辑错误。

正确状态应该至少是三值：

```text
ACTIVE
INACTIVE
UNKNOWN
```

---

### 3. 永久硬编码 cooldownID

因为：

```text
COOLDOWN_VIEWER_TABLE_HOTFIXED
```

已经明确说明 CooldownViewer Table 可以被热修。

因此应动态解析。

---

### 4. 根据持续时间自行恢复受限 Aura 时间

如果一个 Aura 的时间数据不可直接读取，不应该使用：

```text
检测到 ACTIVE 的时间
+
已知默认持续时间
```

去重新推算：

```text
Aura remains
```

这类推导需要特别谨慎。

---

# 二十六、当前实机观察能证明什么？

截至 2026 年 9 月的一组正式服实验，在：

```text
WoW 12.1.0
Build 69933
Interface 120100
zhCN
```

的特定职业测试场景中，对多个 CooldownViewer 条目进行了持续观察。

其中两个 spellID 直连条目：

```text
408459
1306162
```

均多次观察到公开的：

```text
ACTIVE
INACTIVE
```

Frame 状态变化。

另外多个：

```text
linkedSpellIDs
```

也观察到了共享条目的 applied/removed 代理信号。

但这些结果严格只能证明：

> 存在一条可重复的 Blizzard CooldownViewer Frame 状态观察路径。

不能进一步自动升级为：

```text
所有 Buff 真值可读取
所有 Proc 可读取
所有技能状态可读取
```

更不能因为多个 linkedSpellID 共用一个 Frame，就把一个状态复制成多个独立 Buff 状态。

---

# 二十七、源码与实机必须结合研究

研究 CDM 时还有一个非常重要的问题：

GitHub 上常用的：

```text
Gethe/wow-ui-source
branch: live
```

是一个不断移动的 Live 分支。

它不等于：

```text
某次测试所使用客户端 Build
```

因此最可靠的研究方式应该是：

```text
API Documentation
+
当前 UI Source
+
目标客户端 Probe
```

三者结合。

源码用于解释：

> Blizzard 理论上是怎样工作的。

目标客户端实验用于证明：

> 当前这个 Build 实际允许插件获得什么。

二者不能互相替代。

---

# 二十八、未来值得重点关注的接口与机制

从当前架构来看，后续值得持续跟踪的方向主要包括：

```text
C_CooldownViewer
Blizzard_CooldownViewer
CooldownViewerItemMixin
CooldownViewerBuffItemMixin
CooldownViewerCooldownItemMixin
C_SpellActivationOverlay
ActionButtonSpellAlertManager
Secret Value 检测机制
```

以及三个生命周期事件：

```text
COOLDOWN_VIEWER_DATA_LOADED
COOLDOWN_VIEWER_SPELL_OVERRIDE_UPDATED
COOLDOWN_VIEWER_TABLE_HOTFIXED
```

如果 Blizzard 继续扩大原生 Cooldown Manager 的能力，未来职业状态、Buff、Proc 和技能提示体系很可能进一步围绕这套系统统一。

---

# 二十九、总结

Cooldown Manager 的价值远远超过“默认冷却条”。

从 Blizzard 当前实现来看，它已经形成：

```text
CooldownViewer Catalog
        ↓
Cooldown Entry
        ↓
Spell / Override / Linked Spell
        ↓
Aura / Cooldown / Charge / Totem
        ↓
Item Runtime State
        ↓
Alert / Frame
```

这样一套完整的战斗 UI 状态体系。

对于插件开发者来说，最值得关注的不是某一个单独 API，而是它提供了一种新的客户端状态模型：

**公开目录负责描述“这个条目是谁”；  
CooldownViewer Frame 负责维护“这个条目当前是什么状态”；  
Secret Value 决定插件究竟能知道多少；  
Alert 和 UI 则负责最终展示。**

当前研究已经能够确认：

1. `C_CooldownViewer` 可以动态枚举并解析 CooldownViewer 条目；
2. Cooldown Entry 包含 Spell、Override、Linked Spell、Aura、Charges 等丰富元数据；
3. CooldownViewer 使用独立的 `isActive` 状态和 `OnActiveStateChanged` 生命周期；
4. 部分 Frame 状态在特定客户端和场景下可以表现为公开 Boolean；
5. `ACTIVE` 并不能未经验证直接等价为某个玩家 Buff；
6. Applied/Removed 回调也不能简单等价为 ACTIVE/INACTIVE；
7. cooldownID、Spell Override 和目录本身都应被视为动态数据；
8. 在 Midnight 的 Secret Value 架构下，CDM 很可能成为未来 WoW 插件研究中越来越重要的一套官方状态接口。

因此，与其继续把 Cooldown Manager 理解成一个“暴雪自带 WeakAuras”，更准确的理解可能是：

> **Cooldown Manager 正在成为 Blizzard 新战斗 UI 架构中的状态中间层。**

而理解这个中间层，可能是未来 WoW 插件继续适应 Secret Value 时代的关键之一。

---

## 参考资料

1. Blizzard Entertainment：《Combat Philosophy and Addon Disarmament in Midnight》。
2. Blizzard UI API Documentation：`CooldownViewerDocumentation.lua`。
3. Blizzard 默认 UI 源码：`Blizzard_CooldownViewer/CooldownViewer.lua`。
4. Gethe / wow-ui-source GitHub 镜像。
5. Warcraft Wiki CooldownViewer API documentation。
6. CooldownViewer 正式服 Build 69933 实机观察与源码复核记录。

> 注：Blizzard UI 源码仓库中的 `live` 分支会随客户端持续更新，本文涉及的源码行为不应视为对未来版本的永久接口保证。实际开发应以目标客户端 Build 的 API、运行结果及 Secret Value 状态为准。