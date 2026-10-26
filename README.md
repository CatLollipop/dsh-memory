# dsh-memory

DSH 的轻量记忆插件：保存、检索、查看来源与版本，支持启用/停用、自动保存策略、导出与清空。所有写入只由用户在设置页或面板中发起；模型只有只读的 `memory` 工具。

## 能力

- **设置 → Memory** 页面：启用/停用记忆、自动保存开关、记忆数量与版本统计、导出 JSON、清空全部记忆（两步确认）。
- 同一设置页内嵌记忆管理区：新增记忆、搜索、来源标签、版本号、删除/恢复、显示已删除、空态与错误提示；不再新增左侧栏图标。
- Host 侧使用 `storageDomain` KV（`dsh_memory` 域，`memory_items`/`sources`/`revisions`/`policy`/`access_log` 表）；服务不可用时退回进程内存储，便于本地试跑。
- 作用域隔离：RPC 按浏览器 peer 归属，工具按 agent/session 归属；不同作用域互不可见。
- 敏感内容拒绝保存：secret/password/token/api key/私钥/信用卡等字段与取值直接拒绝，并记录一次失败访问日志。
- 软删除 + 恢复、版本快照、来源元数据、访问日志、上限保护（默认 500 条）。
- 模型工具 `memory`：仅 `status` / `list` / `search`，无法写入或删除。

## 安装

```text
plugin_manager({ action: "install_bundle", target: "<本目录绝对路径>" })
```

安装后：设置窗口出现 **Memory** 页（含全部管理操作）；不新增左侧栏图标；模型获得只读 `memory` 工具。

## RPC

端点 `/api/dsh-memory`，动作：`status`、`list`、`search`、`create`、`update`、`delete`、`restore`、`toggle_policy`、`clear`（需 `confirm: true`）、`export`。

## 数据与隐私

- 内容默认保存在本机 DSH 数据目录；不上传、不调用外部服务。
- 清空会永久删除当前作用域的全部记忆、来源与版本，导出只是本地 JSON 下载。
- 停用记忆后不再保存新内容，也不会自动检索；已有数据保留，直到用户清空。

## 验证

```sh
node --check index.js && node --check rpc.js && node --check client.js
node --test test/*.test.js
```

当前结果：4 项单元测试通过（敏感内容拒绝、作用域隔离与恢复、策略开关、导出与清空）。

## 验证状态（DSH 0.2.1-rc.2）

- Host bundle 在当前 profile 中 `application: applied`，`fiberPhase: active`。
- Client 只注册到设置窗口的 `settings.section`（id `memory`）；`sidebar.panellist` 与 `main` 不再占用。
- 设置页与面板都只使用 `--dsw-alias-*` 主题 token、`ctx.connection.rpc`、`ctx.slots`、`ctx.locale`，不写 DOM、不导入 DSH Client 包。

### 关于界面截图

本机编写本文件时处于锁屏状态，`screencapture` 只能拿到锁屏画面，因此仓库中**没有伪造截图或 mock 图**。解锁后可自行截图，或在会话里让我抓取真实画面后补进本文件。

## 仓库

- GitHub: <https://github.com/CatLollipop/dsh-memory>
