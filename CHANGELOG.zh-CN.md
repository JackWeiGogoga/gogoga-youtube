# 更新日志

gogoga YouTube 每个版本的主要变化都记在这里。格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。English: [CHANGELOG.md](CHANGELOG.md).

## [0.3.0] - 2026-10-15

### 新增
- 界面支持英文和简体中文，跟随 Obsidian 的语言设置。
- 英文 README，另附简体中文版。

## [0.2.1] - 2026-10-14

### 改进
- 调整插件描述的措辞。

## [0.2.0] - 2026-10-14

首个公开版本。

### 新增
- 添加单个或批量粘贴频道，支持频道链接、`@handle`、`UC…` ID 和 Google Takeout 的 `subscriptions.csv`。
- 频道可以分到多个分组；每个频道一篇 Markdown 笔记，生成 `Channels.base` 表格 / 卡片视图。
- 从公开 RSS 拉取最新视频，按分组、搜索、未读筛选，标记已读，选中的视频存成笔记。
- 启动时、定时或手动刷新；可以暂停单个频道。
- 可选的 Google 账号同步（只读权限），导入并持续同步订阅列表。

[0.3.0]: https://github.com/JackWeiGogoga/gogoga-youtube/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/JackWeiGogoga/gogoga-youtube/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/JackWeiGogoga/gogoga-youtube/releases/tag/0.2.0
