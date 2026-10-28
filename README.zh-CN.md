# gogoga YouTube

[English](https://github.com/JackWeiGogoga/gogoga-youtube/blob/main/README.md) | **简体中文**

一个用于管理 YouTube 订阅的 Obsidian 插件。公开 RSS 和 Google Takeout 无需登录即可使用；
可选的 Google OAuth 账号同步能让频道列表与已登录的 YouTube 账号保持一致。

插件把更新频繁的视频流保存在插件数据中，为每个频道写一个普通的 Markdown 文件来存放长期元数据和分组，
只有在你明确保存某个视频时才会创建视频笔记。这样即使订阅很多，也不会让仓库被成千上万个文件淹没。

界面语言跟随 Obsidian 的语言设置，支持简体中文和英文。

## 功能

- 单个添加频道，或一次粘贴多个。
- 支持频道 URL、`@handles`、`UC…` 频道 ID，以及 Google Takeout 的
  `subscriptions.csv` 内容。
- 一个频道可以不属于任何分组，也可以属于一个或多个分组。
- 通过 YouTube 公开的 Atom feed 获取最近上传的视频。
- 按分组、搜索或未读状态筛选视频流。
- 将视频标记为已读/未读，并把选中的视频保存为 Markdown 笔记。
- 暂停单个频道，同时保留其本地数据。
- 生成原生的 `Channels.base` 表格/卡片视图。
- 可在启动时、Obsidian 打开期间按间隔，或手动刷新。
- 通过系统浏览器和 PKCE 授权 Google 账号，仅使用只读的 YouTube 权限范围。
- 导入已登录账号的完整订阅列表，并定期同步新增订阅和取消订阅。

## 安装

将以下文件复制到 `<vault>/.obsidian/plugins/gogoga-youtube/`：

- `main.js`
- `manifest.json`
- `styles.css`

重新加载 Obsidian，然后在「第三方插件」中启用 **gogoga YouTube**。点击侧边栏的 YouTube 图标，
或在命令面板中运行 **打开 YouTube 订阅**。

[gogoga theme](https://github.com/JackWeiGogoga/gogoga-theme) 仓库中的
`scripts/dev-install.sh <vault-path>` 也可以安装本插件。

## 添加订阅

选择 **添加或导入 YouTube 频道**，可以混合输入以下任意形式：

```text
https://www.youtube.com/@veritasium
https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA
UCHnyfMqiRRG1u-2MsSQLbXA
```

对于 Takeout 导出，可以在弹窗中选择 `subscriptions.csv`，也可以直接粘贴其内容。
导入器会识别 `Channel Id`、`Channel Url`、`Channel Title` 这类列名。

## Google 账号同步（C2）

账号同步是可选的。未配置时，插件仍可通过公开 RSS 正常工作。

1. 在 Google Cloud 中为某个项目启用 **YouTube Data API v3**。
2. 配置 OAuth 同意屏幕。如果应用仍处于外部测试状态，请把你用于 YouTube 的
   Google 账号添加为测试用户。
3. 创建类型为 **桌面应用**（Desktop app）的 OAuth Client ID。
4. 在 Obsidian 中打开 **gogoga YouTube** 的设置页，粘贴 Client ID，把 Client Secret
   保存到 Obsidian SecretStorage，然后选择 **授权 Google 账号**。
5. 在系统浏览器中完成授权。之后 Obsidian 会同步账号的订阅，并继续通过 RSS 获取最新视频。

首次授权使用 localhost 回调，因此需要在 Obsidian 桌面版上完成。仪表盘和已同步的数据在移动端依然可用。
插件只申请 `youtube.readonly` 权限范围。Client Secret 和刷新令牌保存在 Obsidian SecretStorage 中，
绝不会写入插件的 `data.json`。

## 仓库数据

默认结构如下：

```text
YouTube/
├── Channels.base
├── Channels/
│   └── UC….md
└── Videos/
    └── 2026-09-29 Video title.md
```

频道文件名使用稳定的 YouTube 频道 ID，因此频道改名不会产生重复文件。显示的标题保存在 frontmatter 中。

对于已有的频道笔记，插件只更新它自己管理的属性，frontmatter 下方写的任何内容都会保留。
停止跟踪时，笔记会被标记为 `subscribed: false`，而不是被删除。

`groups` 和 `enabled` 属性也可以直接在生成的 Bases 视图或频道笔记中编辑，插件会把这些修改读回仪表盘状态。

## 网络与隐私

- 请求由 Obsidian 直接发送到 YouTube 的公开频道页面和 Atom feed。
- 可选的账号同步会直接连接 Google 的 OAuth 和 YouTube Data API 端点。它只使用只读权限，
  从不发布内容、点赞或更改订阅。
- OAuth Client ID 保存在插件设置中；Client Secret 和刷新令牌单独保存在 Obsidian SecretStorage 中。
- 不使用任何统计分析或第三方中转服务。
- Obsidian 关闭时，插件无法刷新。
- 公开 feed 只提供最近一段时间的上传，因此这个 MVP 面向持续的增量跟踪，而不是完整的频道历史。

## 更新日志

每个版本的变化见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)（[English](CHANGELOG.md)）。发版前先写好新版本的条目：Release 说明从这里取，没写时发布会失败。

## 许可证

MIT，参见 [LICENSE](https://github.com/JackWeiGogoga/gogoga-youtube/blob/main/LICENSE)。
