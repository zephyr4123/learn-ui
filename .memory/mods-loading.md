---
name: mods-loading
description: 本机 Claude Code mods 放在 ~/.claude/mods，新 mod 必须加进 settings.json 的 CLAUDE_CODE_PLUGIN_DIRS 才会加载
metadata:
  node_type: memory
  type: reference
  originSessionId: 0d016bbc-bdac-465d-9045-a20796eda43c
  modified: 2026-11-07T16:57:44.280Z
---

本机自写的 mods 放在 `~/.claude/mods/<名字>/`，目前只有 usage-line（额度行）。两个号共用：`~/.claude-jivu/mods` 和 `~/.claude-jivu/settings.json` 都是链接到 `~/.claude` 的符号链接。

加载靠 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`，多个目录用 `:` 隔开，当前是 `~/.claude/mods/usage-line`。

**Why:** 2026-11-07 新建一个 mod 后，`/reload-plugins` 和 `/restart` 都没加载它，原因是这个变量只列了 usage-line。那个 mod（desk-cat 小猫）后来用户觉得鸡肋，已彻底删除。
**How to apply:** 新增 mod 时，同时把它的目录加进这个变量，然后让用户 `/restart`（这个变量只在启动时读，`/reload-plugins` 不够）；删除 mod 时也要从这里去掉。已列出的 mod 改代码会热重载，不用重启。
