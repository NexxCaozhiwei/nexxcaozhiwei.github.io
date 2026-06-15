---
title: "Codex 额度耗尽时，如何让 ChatGPT 无缝承接编程工作流"
date: 2026-06-15
tags:
  - ChatGPT
  - Codex
  - AI 编程
  - Agent
  - 工程工作流
description: "本文介绍一种可复制的 ChatGPT 与 Codex 协同开发方法：当 Codex 额度耗尽时，如何通过 AGENTS.md、HANDOFF.md、Git diff、Issue 和测试日志，让 ChatGPT 接续分析、审查和规划后续开发。"
cover: "/images/blog/codex-chatgpt-handoff-blog/01-hero.svg"
---

# Codex 额度耗尽时，如何让 ChatGPT 无缝承接编程工作流

![Codex 额度耗尽时，如何让 ChatGPT 无缝承接编程工作流](/images/blog/codex-chatgpt-handoff-blog/01-hero.svg)

使用 Codex 开发项目时，最容易打断节奏的不是模型写不出代码，而是**工作流突然中断**。

比如：

- 任务做到一半，Codex 额度耗尽；
- Codex 线程里有大量上下文，但 ChatGPT 不能自动完整继承；
- 项目里改了哪些文件、为什么这么改、下一步该做什么，开发者自己也需要重新复盘；
- 报错日志、测试结果、Git diff 分散在多个地方，后续很难恢复现场。

所以，所谓“让 ChatGPT 无缝承接 Codex 的编程工作流”，并不是指让 ChatGPT 自动同步 Codex 的全部对话，而是建立一套**可交接、可恢复、可审查、可继续执行**的工程机制。

核心结论很简单：

> 不要把上下文只留在聊天窗口里。  
> 要把上下文沉淀到项目仓库里。

---

## 一、先明确边界：ChatGPT 不能天然继承 Codex 的完整上下文

很多人会有一个直觉：既然 ChatGPT 和 Codex 都属于同一账号体系，那么 Codex 里的对话、代码修改过程、执行日志，ChatGPT 应该可以自动看到。

实际使用中，不应该这么假设。

更稳妥的理解是：

| 工具 | 更适合做什么 |
|---|---|
| Codex | 读取仓库、修改代码、运行命令、生成 diff、提交 PR |
| ChatGPT | 需求拆解、方案设计、错误分析、diff 审查、Prompt 编写、文档整理 |

Codex 更像执行工程师，ChatGPT 更像技术负责人。  
两者可以配合，但不能依赖“自动共享对话”来维持工程连续性。

---

## 二、推荐架构：让项目仓库成为唯一事实来源

如果希望 ChatGPT 在 Codex 额度耗尽后继续接手，最稳定的做法是：  
**让项目仓库承担上下文中枢的角色。**

![让项目仓库成为上下文中枢](/images/blog/codex-chatgpt-handoff-blog/02-context-hub.svg)

建议在每个长期项目根目录增加以下文件：

```text
AGENTS.md
PROJECT_CONTEXT.md
TASKS.md
DECISIONS.md
CHANGELOG.md
HANDOFF.md
```

它们的职责如下：

| 文件 | 作用 |
|---|---|
| `AGENTS.md` | 给 Codex / Agent 的长期行为规则 |
| `PROJECT_CONTEXT.md` | 项目背景、目标、架构、关键模块说明 |
| `TASKS.md` | 当前任务列表、优先级、状态 |
| `DECISIONS.md` | 已经确认的技术决策，避免反复推翻 |
| `CHANGELOG.md` | 版本变化记录 |
| `HANDOFF.md` | Codex 与 ChatGPT 之间的交接记录 |

这样，Codex 和 ChatGPT 虽然不是同一个会话，但它们围绕的是同一组工程事实。

这比复制一大段聊天记录更稳定。

---

## 三、整体工作流：Codex 负责执行，ChatGPT 负责承接

理想流程如下：

![Codex 中断后的接力闭环](/images/blog/codex-chatgpt-handoff-blog/03-handoff-loop.svg)

这套流程的关键不是“让 ChatGPT 直接变成 Codex”，而是让 ChatGPT 在 Codex 中断时承担三件事：

1. 判断 Codex 已经完成了什么；
2. 判断当前代码修改是否合理；
3. 生成下一轮可交给 Codex 的恢复 Prompt。

---

## 四、AGENTS.md：给 Codex 的长期工作纪律

`AGENTS.md` 不应该写成项目介绍，而应该写成 Agent 工作规范。

它的作用是约束 Codex 每次如何读取项目、如何修改代码、如何留下交接记录。

示例：

```md
# AGENTS.md

## 项目工作规则

1. 修改代码前，必须先阅读：
   - PROJECT_CONTEXT.md
   - TASKS.md
   - DECISIONS.md
   - CHANGELOG.md
   - HANDOFF.md

2. 不允许无关重构。
   只修改与当前任务直接相关的文件。

3. 每次完成任务后，必须更新 HANDOFF.md，内容包括：
   - 本轮目标
   - 已修改文件
   - 核心改动
   - 未完成事项
   - 已运行测试
   - 测试结果
   - 下一步建议

4. 如果遇到不确定问题，不要大范围猜测修改。
   应先记录到 HANDOFF.md 的“待确认问题”部分。

5. 所有修复必须尽量保留现有功能和界面行为。
   除非任务明确要求，不得改变既有交互逻辑。

6. 输出结果时必须包含：
   - 修改摘要
   - 文件列表
   - 测试命令
   - 是否通过
   - 下一步建议
```

这份文件的价值在于：  
它强制 Codex 每轮工作后都留下可交接痕迹。

---

## 五、HANDOFF.md：真正的“无缝承接接口”

如果只能选一个文件，最重要的是 `HANDOFF.md`。

它是 Codex 和 ChatGPT 之间的交接接口。

![最小交接包](/images/blog/codex-chatgpt-handoff-blog/04-handoff-package.svg)

建议模板如下：

````md
# HANDOFF.md

## 当前任务

一句话说明当前任务目标。

## 当前状态

- 已完成：
  - ...
- 未完成：
  - ...
- 阻塞点：
  - ...

## 本轮修改文件

- `src/example.py`
  - 修改原因：
  - 主要变化：

- `tests/test_example.py`
  - 修改原因：
  - 主要变化：

## 关键设计判断

1. 为什么采用当前方案：
2. 为什么没有采用其他方案：
3. 是否存在兼容性风险：

## 测试情况

### 已运行命令

```bash
pytest
npm test
python main.py
```

### 测试结果

- 通过：
- 失败：
- 未能测试的原因：

## 当前错误或异常

粘贴关键报错，不要只写“报错了”。

## 下一步建议

1. ...
2. ...
3. ...

## 给 ChatGPT 的接手提示

请根据以上上下文，继续分析当前问题。
优先检查未完成事项、测试失败项和当前错误。
不要建议大范围重构，除非现有实现无法继续维护。
````

只要 `HANDOFF.md` 写得好，即使 Codex 突然中断，ChatGPT 也能迅速理解当前项目状态。

---

## 六、Codex 额度耗尽时，具体应该收集什么

当 Codex 额度耗尽时，不要急着重新描述整个项目。

先收集现场。

建议执行：

```bash
git status
git diff > codex-last-diff.patch
git log --oneline -5
```

然后整理以下材料：

```text
1. HANDOFF.md
2. TASKS.md
3. PROJECT_CONTEXT.md
4. git status 输出
5. git diff 或 codex-last-diff.patch
6. 报错日志
7. 测试命令和测试结果
```

这一步做得越规范，ChatGPT 接手越稳。

---

## 七、ChatGPT 接手 Prompt 模板

当 Codex 额度耗尽后，可以直接把下面这段发给 ChatGPT：

```md
你现在需要接手一个 Codex 中断的编程任务。

我会提供：
1. PROJECT_CONTEXT.md
2. TASKS.md
3. HANDOFF.md
4. git status
5. git diff
6. 报错日志
7. 测试结果

你的任务不是重写项目，而是：

1. 判断 Codex 已经完成了什么；
2. 判断当前修改是否合理；
3. 找出失败原因；
4. 给出最小修复方案；
5. 必要时输出可直接应用的补丁；
6. 给出下一轮可以交给 Codex 的 Prompt。

要求：

- 不要泛泛建议；
- 不要大范围重构；
- 优先基于现有 diff 分析；
- 每个结论都要说明依据；
- 如果信息不足，请列出缺失信息，但仍然先给出当前可执行方案。
```

这里的关键是：  
让 ChatGPT 进入“工程接手模式”，而不是重新开始需求讨论。

---

## 八、ChatGPT 接手后能做什么，不能做什么

ChatGPT 接手 Codex 中断任务时，适合做这些事：

| ChatGPT 适合 | ChatGPT 不适合 |
|---|---|
| 分析问题 | 假装已经运行了本地测试 |
| 审查 diff | 猜测未提供的代码细节 |
| 生成补丁建议 | 大范围重写项目 |
| 写下一轮 Codex Prompt | 直接继承 Codex 私有会话 |
| 整理文档和测试计划 | 代替本地真实运行环境 |

一句话：

> ChatGPT 可以接手判断和规划，但不能替代真实的本地执行环境。

---

## 九、把任务拆成 Codex 可执行的小块

额度有限时，最忌讳给 Codex 模糊大任务。

不推荐：

```text
帮我优化整个项目。
```

不推荐：

```text
帮我修复所有问题。
```

不推荐：

```text
帮我重构代码，让它更好。
```

推荐：

```md
当前任务：
只修复“空闲状态不触发”的问题。

要求：
1. 先定位状态来源；
2. 不修改 UI 布局；
3. 不重构无关模块；
4. 增加必要日志；
5. 修改后更新 HANDOFF.md；
6. 输出测试方式。

验收标准：
1. 无任务运行时显示红灯；
2. 任务运行时显示绿灯；
3. 任务完成后显示蓝灯；
4. 完成一段时间后可回到红灯，或按设计明确保持蓝灯；
5. 日志能说明状态切换原因。
```

这种任务更适合 Codex 执行，也更适合 ChatGPT 中途接手。

---

## 十、三类固定 Prompt：执行、接手、恢复

建议在项目里长期保存三类 Prompt。

### 1. Codex 执行 Prompt

```md
请先阅读 AGENTS.md、PROJECT_CONTEXT.md、TASKS.md、DECISIONS.md、HANDOFF.md。

当前任务：
修复 XXX 问题。

限制：
1. 不要修改无关功能；
2. 不要大范围重构；
3. 保持现有 UI 和配置兼容；
4. 必须更新 HANDOFF.md；
5. 必须说明测试结果。

完成后输出：
1. 修改文件列表；
2. 核心改动；
3. 测试命令；
4. 测试结果；
5. 下一步建议。
```

### 2. ChatGPT 接手 Prompt

```md
Codex 额度耗尽，请你接手当前编程任务。

我会提供：
1. HANDOFF.md
2. git diff
3. 报错日志
4. 测试结果

请你完成：
1. 复盘当前状态；
2. 判断当前 diff 是否合理；
3. 找出问题根因；
4. 给出最小修复方案；
5. 输出下一轮 Codex Prompt；
6. 如可以，给出可直接复制的代码修改建议。

不要重新设计整个项目。
```

### 3. Codex 恢复 Prompt

```md
请继续上次中断的任务。

你必须先阅读：
1. HANDOFF.md
2. ChatGPT 给出的接手分析
3. 当前 git diff
4. 测试失败日志

请根据 ChatGPT 的建议执行最小修复。
不要扩展新功能。
完成后更新 HANDOFF.md，并运行相关测试。
```

这三类 Prompt 的关系可以简化为：

```text
Codex 执行 Prompt
      ↓
Codex 修改代码并更新 HANDOFF.md
      ↓
额度耗尽 / 中断
      ↓
ChatGPT 接手 Prompt
      ↓
ChatGPT 分析并生成修复方案
      ↓
Codex 恢复 Prompt
      ↓
Codex 继续执行
```

---

## 十一、推荐目录结构

长期项目建议增加一个 `docs/agent-workflow/` 目录：

```text
docs/
  agent-workflow/
    codex-prompt.md
    chatgpt-handoff-prompt.md
    recovery-prompt.md
    test-checklist.md
    release-checklist.md

AGENTS.md
PROJECT_CONTEXT.md
TASKS.md
DECISIONS.md
CHANGELOG.md
HANDOFF.md
```

这样做以后，每次不需要重新设计流程，只需要按模板执行。

---

## 十二、用 GitHub Issue 做任务中转站

如果项目托管在 GitHub，建议把每个任务都写成 Issue。

Issue 比聊天记录更适合作为工程协作对象。

模板如下：

````md
## 背景

说明这个问题为什么存在。

## 当前表现

说明用户看到的错误或异常。

## 期望表现

说明修复后的行为。

## 影响范围

说明涉及哪些模块。

## 技术限制

说明哪些地方不能改。

## 验收标准

- [ ] ...
- [ ] ...
- [ ] ...

## 测试方式

```bash
...
```

## 交接要求

完成后必须更新 HANDOFF.md。
````

这个流程比“在聊天记录里找上下文”可靠得多。

---

## 十三、本地项目也可以这样做

即使项目没有上传 GitHub，也可以使用同样的方法。

每次 Codex 工作前后执行：

```bash
git status
git diff
```

如果你希望保留中间状态，可以临时提交：

```bash
git add .
git commit -m "WIP: codex handoff before quota limit"
```

如果暂时不想提交，可以保存补丁：

```bash
git diff > handoff.patch
```

然后把 `handoff.patch`、`HANDOFF.md` 和报错日志交给 ChatGPT 分析。

---

## 十四、实际例子：修复 codex-bar 的“空闲状态不触发”

假设你正在开发一个任务栏软件 `codex-bar`，它有三个状态灯：

```text
红灯：空闲
绿灯：工作中
蓝灯：已完成
```

现在问题是：  
**空闲状态一直没有触发。**

不要直接让 Codex 这样做：

```text
帮我修复空闲状态。
```

更好的任务描述是：

```md
当前问题：
任务栏状态灯中，“空闲”状态一直没有触发。

请执行：
1. 搜索状态判断逻辑；
2. 找到状态来源；
3. 找到从“工作中/完成”回到“空闲”的条件；
4. 检查是否存在定时器、事件监听、状态缓存未刷新问题；
5. 增加必要日志；
6. 不修改 UI 布局；
7. 不改变进度条逻辑；
8. 修改后更新 HANDOFF.md。

验收标准：
1. 无任务运行时显示红灯；
2. 任务运行时显示绿灯；
3. 任务完成后显示蓝灯；
4. 完成一段时间后可回到红灯，或按设计明确保持蓝灯；
5. 日志能说明状态切换原因。
```

这个任务的排查图可以这样表示：

![状态灯问题的排查路径](/images/blog/codex-chatgpt-handoff-blog/06-status-state-machine.svg)

如果 Codex 做到一半额度耗尽，ChatGPT 可以根据 `HANDOFF.md` 和 `git diff` 继续判断：

```text
1. 是否只实现了“工作中”和“完成”，没有设计“无任务”的状态？
2. 是否轮询函数只在检测到任务时更新状态？
3. 是否 UI 状态被最后一次完成状态锁住？
4. 是否没有设置完成状态过期时间？
5. 是否状态缓存没有被清空？
```

这样，ChatGPT 不是从零开始，而是基于 Codex 已有工作继续接力。

---

## 十五、关键原则：所有上下文都要可复制、可提交、可恢复

要让 ChatGPT 顺利接手 Codex，不要依赖“我记得刚才怎么说的”。

所有关键信息都应该落到下面这些地方：

```text
1. 仓库文件
2. Git diff
3. Issue
4. HANDOFF.md
5. 测试日志
6. 报错堆栈
7. 版本记录
```

只存在于聊天窗口里的内容，都是脆弱上下文。  
写入仓库的内容，才是稳定上下文。

---

## 十六、最终建议：把 ChatGPT 当技术负责人，把 Codex 当执行工程师

比较理想的分工是：

![ChatGPT 与 Codex 的角色分工](/images/blog/codex-chatgpt-handoff-blog/05-roles.svg)

| ChatGPT | Codex |
|---|---|
| 需求澄清 | 阅读项目 |
| 架构判断 | 修改代码 |
| 方案设计 | 运行命令 |
| Prompt 编写 | 生成 diff |
| diff 审查 | 补测试 |
| bug 定位 | 提交 PR |
| 测试计划 | 更新交接文件 |
| 文档整理 | 输出修改摘要 |

不要把 Codex 当成永不断线的开发者，也不要把 ChatGPT 当成可以自动接管本地环境的 IDE。

二者之间需要一个清晰、稳定、可追踪的交接层。

这个交接层就是：

```text
AGENTS.md + HANDOFF.md + Git diff + Issue + 测试日志
```

只要这几样材料维护得好，即使 Codex 额度耗尽，ChatGPT 也能继续承担分析、审查、修复设计和下一轮任务编排。

等 Codex 额度恢复后，再把 ChatGPT 的结论交回 Codex 执行。

这就是目前最接近“无缝承接”的 ChatGPT + Codex 编程工作流。

---

## 参考资料

- [OpenAI Developers：Codex cloud](https://developers.openai.com/codex/cloud)
- [OpenAI Help：Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
