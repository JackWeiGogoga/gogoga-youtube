'use strict';

const {
  ItemView,
  Modal,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  getLanguage,
  normalizePath,
  requestUrl,
  setIcon,
} = require('obsidian');

const VIEW_TYPE = 'gogoga-youtube-view';
const CHANNEL_ID_RE = /UC[A-Za-z0-9_-]{22}/;
const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const CLIENT_SECRET_SECRET_ID = 'gogoga-youtube-oauth-client-secret';
const REFRESH_TOKEN_SECRET_ID = 'gogoga-youtube-refresh-token';

const DEFAULT_SETTINGS = {
  rootFolder: 'YouTube',
  refreshIntervalMinutes: 60,
  refreshOnStartup: true,
  maxStoredVideos: 1500,
  oauthClientId: '',
  accountSyncIntervalMinutes: 360,
  removeMissingAccountSubscriptions: true,
};

// UI strings. Both locales must define the same keys. A value can be an
// object `{ one, other }`, chosen by `vars.count`. Anything written into vault
// files (frontmatter, Channels.base, note templates) is data and stays out of
// this table.
const STRINGS = {
  en: {
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'time.never': 'Never',
    'time.ago': '{time} ago',
    'time.in': 'in {time}',
    'time.seconds': { one: '{count} second', other: '{count} seconds' },
    'time.minutes': { one: '{count} minute', other: '{count} minutes' },
    'time.hours': { one: '{count} hour', other: '{count} hours' },
    'time.days': { one: '{count} day', other: '{count} days' },
    'views.count': { one: '{count} view', other: '{count} views' },
    'modal.add.title': 'Add YouTube channels',
    'modal.add.desc':
      'One channel URL, @handle, or channel ID per line. You can also paste a Google Takeout subscriptions.csv.',
    'modal.add.list': 'Channels',
    'modal.add.pickFile': 'Choose CSV or TXT file',
    'modal.add.groups': 'Initial groups',
    'modal.add.groupsDesc': 'Optional, comma-separated. You can change each channel later',
    'modal.add.groupsPlaceholder': 'AI, Product',
    'modal.add.submit': 'Add and refresh',
    'modal.add.empty': 'Enter at least one channel first',
    'modal.groups.title': 'Edit channel groups',
    'modal.groups.name': 'Groups',
    'modal.groups.desc': 'A channel can belong to several groups, separated by commas',
    'view.title': 'YouTube subscriptions',
    'view.status.videos': 'Videos refreshed: {time}',
    'view.status.account': 'Account synced: {time}',
    'view.status.syncing': 'Syncing Google account subscriptions…',
    'view.status.refreshing': 'Refreshing {done}/{total}',
    'view.addChannel': 'Add channel',
    'view.syncAccount': 'Sync Google account subscriptions',
    'view.authorize': 'Authorize Google account',
    'view.refreshing': 'Refreshing',
    'view.refreshAll': 'Refresh all channels',
    'view.tab.videos': 'Latest videos',
    'view.tab.channels': 'Channels',
    'view.empty.title': 'No channels yet',
    'view.empty.desc':
      'Add a channel URL, @handle, or channel ID, or import a Google Takeout subscriptions.csv.',
    'view.filter.search': 'Search channels or videos…',
    'view.filter.allGroups': 'All groups',
    'view.filter.ungrouped': 'Ungrouped',
    'view.filter.unreadOnly': 'Unread only',
    'view.summary.videos': {
      one: '{count} video · {unread} unread',
      other: '{count} videos · {unread} unread',
    },
    'view.markAllRead': 'Mark all as read',
    'view.noUnreadVideos': 'No unread videos match the current filters.',
    'view.noVideos': 'No videos match the current filters.',
    'view.markUnread': 'Mark as unread',
    'view.markRead': 'Mark as read',
    'view.openNote': 'Open video note',
    'view.saveNote': 'Save as video note',
    'view.summary.channels': {
      one: '{count} channel · {enabled} enabled',
      other: '{count} channels · {enabled} enabled',
    },
    'view.noChannels': 'No channels match the current filters.',
    'view.channelMeta': 'Last upload: {published} · Checked: {checked}',
    'view.ungrouped': 'Ungrouped',
    'view.editGroups': 'Edit groups',
    'view.pause': 'Pause refresh',
    'view.resume': 'Resume refresh',
    'view.refreshOne': 'Refresh this channel',
    'view.untrack': 'Stop tracking channel',
    'command.open': 'Open YouTube subscriptions',
    'command.add': 'Add or import YouTube channels',
    'command.authorize': 'Authorize Google account',
    'command.sync': 'Sync Google account subscriptions',
    'command.revoke': 'Revoke Google account authorization',
    'command.refreshAll': 'Refresh all YouTube channels',
    'command.openBase': 'Open YouTube channel library',
    'error.unknown': 'Unknown error',
    'error.google': 'Google request failed',
    'error.oauth': 'Google OAuth request failed',
    'error.noRefreshToken':
      'Google did not return a refresh token. Revoke the old authorization and try again',
    'error.oauthState': 'Google OAuth state check failed',
    'error.oauthDenied': 'You canceled Google authorization',
    'error.oauthNoCode': 'Google did not return an authorization code',
    'error.oauthTimeout': 'Timed out waiting for Google authorization. Try again',
    'error.notAuthorized': 'Google account is not authorized',
    'error.missingClientId': 'Missing Google OAuth Client ID',
    'error.missingClientSecret': 'Missing Google OAuth Client Secret',
    'error.authExpired': 'Google authorization has expired. Authorize again',
    'error.youtubeApi': 'YouTube API request failed (HTTP {status})',
    'error.duplicatePageToken': 'YouTube API returned a duplicate page token',
    'error.tooManySubscriptions': 'YouTube subscriptions exceed the sync safety limit',
    'error.revokeHttp': 'Google revoke request failed (HTTP {status})',
    'error.emptyChannel': 'Channel address is empty',
    'error.noChannelId': 'Could not find a channel ID for this address: {input}',
    'error.rssHttp': 'RSS request failed (HTTP {status})',
    'error.rssParse': 'YouTube returned an RSS feed that could not be parsed',
    'error.renameNote': 'Could not rename channel note: {path}',
    'oauth.page.notFound.title': 'Page not found',
    'oauth.page.notFound.detail': 'Return to Obsidian and start authorization again.',
    'oauth.page.state.title': 'Authorization check failed',
    'oauth.page.state.detail': 'The request state did not match. Return to Obsidian and try again.',
    'oauth.page.incomplete.title': 'Authorization not completed',
    'oauth.page.incomplete.detail': 'You can close this page and return to Obsidian.',
    'oauth.page.noCode.title': 'Invalid authorization response',
    'oauth.page.noCode.detail':
      'No authorization code was received. Return to Obsidian and try again.',
    'oauth.page.success.title': 'Google authorization succeeded',
    'oauth.page.success.detail':
      'Subscription sync continues in Obsidian. You can close this page now.',
    'oauth.page.exchange.title': 'Token exchange failed',
    'oauth.page.exchange.detail': 'Return to Obsidian to see the error and try again.',
    'notice.needClientId': 'Enter a Google OAuth Client ID in the gogoga YouTube settings first',
    'notice.badClientId': 'Google OAuth Client ID is not valid',
    'notice.needClientSecret':
      'Save the OAuth Client Secret in the gogoga YouTube settings first',
    'notice.desktopOnly': 'The first Google authorization must be done in Obsidian desktop',
    'notice.authInProgress': 'Google authorization is already in progress',
    'notice.authOpened': 'Opened the Google authorization page in your browser',
    'notice.authSuccess': 'Google account authorized',
    'notice.authFailed': 'Google authorization failed: {error}',
    'notice.authorizeFirst': 'Authorize a Google account first',
    'notice.syncInProgress': 'YouTube sync is already in progress',
    'notice.syncDone': {
      one: 'Account subscriptions synced: {count} channel ({added} added, {updated} updated, {removed} removed)',
      other:
        'Account subscriptions synced: {count} channels ({added} added, {updated} updated, {removed} removed)',
    },
    'notice.syncFailed': 'Google account sync failed: {error}',
    'notice.revokePartial':
      'Local token removed, but revoking access on Google failed. Check your Google account security page. Existing channels and notes are kept.',
    'notice.revoked': 'Google account authorization revoked. Local channels and notes are kept',
    'notice.revokeLocalFailed': 'Could not remove the local Google authorization: {error}',
    'notice.adding': { one: 'Adding {count} channel…', other: 'Adding {count} channels…' },
    'notice.importFailure': '{input}: {error}',
    'notice.added': { one: 'Added {count} channel', other: 'Added {count} channels' },
    'notice.addedMerged': {
      one: ', merged {count} existing channel',
      other: ', merged {count} existing channels',
    },
    'notice.addedFailed': ', {count} failed',
    'notice.refreshInProgress': 'YouTube subscriptions are already refreshing',
    'notice.refreshing': {
      one: 'Refreshing {count} YouTube channel…',
      other: 'Refreshing {count} YouTube channels…',
    },
    'notice.refreshDonePartial': {
      one: 'YouTube refresh finished. {count} channel failed; see the Channels tab',
      other: 'YouTube refresh finished. {count} channels failed; see the Channels tab',
    },
    'notice.refreshDone': 'YouTube refresh finished',
    'notice.untracked': 'Stopped tracking “{title}”. Existing notes are kept',
    'account.fallbackTitle': 'Authorized Google account',
    'confirm.revoke.title': 'Revoke Google authorization?',
    'confirm.revoke.message':
      'The plugin will ask Google to revoke access and remove the refresh token from the Obsidian keychain. Existing channels, videos, and notes are kept.',
    'confirm.revoke.button': 'Revoke authorization',
    'confirm.untrack.title': 'Stop tracking channel?',
    'confirm.untrack.message':
      '“{title}” will be removed from the subscriptions panel. The channel Markdown file and saved video notes are kept.',
    'confirm.untrack.button': 'Stop tracking',
    'settings.intro':
      'Channels and saved videos are stored as plain Markdown. The latest video feed and read state are kept in plugin data.',
    'settings.rootFolder.name': 'Data folder',
    'settings.rootFolder.desc':
      'Root folder for channel notes, video notes, and Channels.base. Changing it does not move existing files',
    'settings.account.heading': 'Google account sync (C2)',
    'settings.account.intro':
      'Uses the system browser and PKCE, and only requests read-only access to your YouTube account. The refresh token is stored in the Obsidian keychain, never in data.json. The first authorization requires Obsidian desktop.',
    'settings.cloud.name': 'Google Cloud setup',
    'settings.cloud.desc':
      'Enable YouTube Data API v3 and create an OAuth Client ID of type “Desktop app”',
    'settings.cloud.button': 'Open setup guide',
    'settings.clientId.name': 'OAuth Client ID',
    'settings.clientId.desc':
      'Looks like 123456789-xxxx.apps.googleusercontent.com. The Client ID is not a token',
    'settings.clientSecret.name': 'OAuth Client Secret',
    'settings.clientSecret.descSaved':
      'Saved in the Obsidian keychain. Enter a new value to replace it',
    'settings.clientSecret.descEmpty':
      'The secret shown when you create the desktop client in Google Cloud. It is stored only in the Obsidian keychain',
    'settings.clientSecret.placeholderSaved': 'Saved securely',
    'settings.clientSecret.replace': 'Replace secret',
    'settings.clientSecret.save': 'Save secret',
    'settings.clientSecret.clear': 'Clear secret',
    'settings.clientSecret.needValue': 'Enter the OAuth Client Secret first',
    'settings.clientSecret.saved': 'OAuth Client Secret saved to the Obsidian keychain',
    'settings.clientSecret.cleared': 'OAuth Client Secret removed from the Obsidian keychain',
    'settings.auth.name': 'Authorization status',
    'settings.auth.authorized': 'Authorized',
    'settings.auth.account': ': {account}',
    'settings.auth.lastSynced': '; last synced: {time}',
    'settings.auth.none': 'No Google account authorized',
    'settings.auth.syncNow': 'Sync subscriptions now',
    'settings.auth.revoke': 'Revoke authorization',
    'settings.auth.authorize': 'Authorize Google account',
    'settings.accountInterval.name': 'Account sync interval',
    'settings.accountInterval.desc':
      'Automatically checks your Google account for new and canceled subscriptions. Video updates still come from RSS',
    'settings.interval.manual': 'Manual only',
    'settings.interval.minutes': { one: '{count} minute', other: '{count} minutes' },
    'settings.interval.hours': { one: '{count} hour', other: '{count} hours' },
    'settings.interval.daily': 'Daily',
    'settings.removeMissing.name': 'Sync unsubscribes',
    'settings.removeMissing.desc':
      'When you unsubscribe on YouTube, remove the matching account-managed channel from the panel. Markdown files and saved videos are not deleted',
    'settings.refreshOnStartup.name': 'Refresh on startup',
    'settings.refreshOnStartup.desc':
      'Refresh after Obsidian starts if the refresh interval has passed since the last refresh',
    'settings.refreshInterval.name': 'Refresh interval',
    'settings.refreshInterval.desc':
      'How often to check while Obsidian is open. Choose “Manual only” to turn off automatic refresh',
    'settings.maxVideos.name': 'Stored video index',
    'settings.maxVideos.desc':
      'Limits how much plugin data the latest video feed uses. Videos saved as notes are never pruned',
    'settings.base.name': 'Channel library',
    'settings.base.desc': 'Open the native Bases channel view generated by the plugin',
    'settings.base.button': 'Open Channels.base',
    'settings.notes.heading': 'How it works',
    'settings.notes.auth':
      'Public RSS and Takeout work without authorization. Once authorized, the YouTube Data API is used only to sync your subscription list.',
    'settings.notes.rss':
      'RSS only provides each channel’s most recent videos. It suits ongoing incremental sync, not a full history backfill.',
    'settings.notes.closed':
      'The plugin cannot refresh while Obsidian is closed. It catches up based on the refresh interval the next time Obsidian opens.',
  },
  zh: {
    'common.cancel': '取消',
    'common.save': '保存',
    'time.never': '从未',
    'time.ago': '{time}前',
    'time.in': '{time}后',
    'time.seconds': '{count}秒',
    'time.minutes': '{count}分钟',
    'time.hours': '{count}小时',
    'time.days': '{count}天',
    'views.count': '{count}次观看',
    'modal.add.title': '添加 YouTube 频道',
    'modal.add.desc': '每行一个频道 URL、@handle 或频道 ID。也可以粘贴 Google Takeout 的 subscriptions.csv。',
    'modal.add.list': '频道列表',
    'modal.add.pickFile': '选择 CSV / TXT 文件',
    'modal.add.groups': '初始分组',
    'modal.add.groupsDesc': '可选，使用逗号分隔；之后可以逐个频道修改',
    'modal.add.groupsPlaceholder': 'AI, 产品',
    'modal.add.submit': '添加并刷新',
    'modal.add.empty': '请先输入至少一个频道',
    'modal.groups.title': '编辑频道分组',
    'modal.groups.name': '分组',
    'modal.groups.desc': '一个频道可以属于多个组，使用逗号分隔',
    'view.title': 'YouTube 订阅',
    'view.status.videos': '视频刷新：{time}',
    'view.status.account': '账号订阅：{time}',
    'view.status.syncing': '正在同步 Google 账号订阅…',
    'view.status.refreshing': '正在刷新 {done}/{total}',
    'view.addChannel': '添加频道',
    'view.syncAccount': '同步 Google 账号订阅',
    'view.authorize': '授权 Google 账号',
    'view.refreshing': '正在刷新',
    'view.refreshAll': '刷新全部频道',
    'view.tab.videos': '最新视频',
    'view.tab.channels': '频道管理',
    'view.empty.title': '还没有订阅频道',
    'view.empty.desc': '添加频道 URL、@handle、频道 ID，或导入 Google Takeout 的 subscriptions.csv。',
    'view.filter.search': '搜索频道或视频…',
    'view.filter.allGroups': '全部分组',
    'view.filter.ungrouped': '未分组',
    'view.filter.unreadOnly': '仅未读',
    'view.summary.videos': '{count} 个视频 · {unread} 个未读',
    'view.markAllRead': '全部标为已读',
    'view.noUnreadVideos': '当前筛选下没有未读视频。',
    'view.noVideos': '当前筛选下没有视频。',
    'view.markUnread': '标为未读',
    'view.markRead': '标为已读',
    'view.openNote': '打开视频笔记',
    'view.saveNote': '保存为视频笔记',
    'view.summary.channels': '{count} 个频道 · {enabled} 个启用',
    'view.noChannels': '当前筛选下没有频道。',
    'view.channelMeta': '最近更新：{published} · 检查：{checked}',
    'view.ungrouped': '未分组',
    'view.editGroups': '编辑分组',
    'view.pause': '暂停刷新',
    'view.resume': '恢复刷新',
    'view.refreshOne': '刷新这个频道',
    'view.untrack': '停止跟踪频道',
    'command.open': '打开 YouTube 订阅',
    'command.add': '添加或导入 YouTube 频道',
    'command.authorize': '授权 Google 账号',
    'command.sync': '同步 Google 账号订阅',
    'command.revoke': '撤销 Google 账号授权',
    'command.refreshAll': '刷新全部 YouTube 频道',
    'command.openBase': '打开 YouTube 频道库',
    'error.unknown': '未知错误',
    'error.google': 'Google 请求失败',
    'error.oauth': 'Google OAuth 请求失败',
    'error.noRefreshToken': 'Google 没有返回刷新令牌，请撤销旧授权后重试',
    'error.oauthState': 'Google OAuth 状态校验失败',
    'error.oauthDenied': '你取消了 Google 授权',
    'error.oauthNoCode': 'Google 没有返回授权码',
    'error.oauthTimeout': 'Google 授权等待超时，请重试',
    'error.notAuthorized': '尚未授权 Google 账号',
    'error.missingClientId': '缺少 Google OAuth Client ID',
    'error.missingClientSecret': '缺少 Google OAuth Client Secret',
    'error.authExpired': 'Google 授权已失效，请重新授权',
    'error.youtubeApi': 'YouTube API 请求失败（HTTP {status}）',
    'error.duplicatePageToken': 'YouTube API 返回了重复的分页标记',
    'error.tooManySubscriptions': 'YouTube 订阅数量超过同步安全上限',
    'error.revokeHttp': 'Google 撤销请求失败（HTTP {status}）',
    'error.emptyChannel': '频道地址为空',
    'error.noChannelId': '无法从这个地址识别频道 ID：{input}',
    'error.rssHttp': 'RSS 请求失败（HTTP {status}）',
    'error.rssParse': 'YouTube 返回了无法解析的 RSS',
    'error.renameNote': '频道笔记重命名失败：{path}',
    'oauth.page.notFound.title': '未找到页面',
    'oauth.page.notFound.detail': '请返回 Obsidian 重新发起授权。',
    'oauth.page.state.title': '授权校验失败',
    'oauth.page.state.detail': '请求状态不匹配，请返回 Obsidian 重试。',
    'oauth.page.incomplete.title': '授权未完成',
    'oauth.page.incomplete.detail': '你可以关闭此页面并返回 Obsidian。',
    'oauth.page.noCode.title': '授权响应无效',
    'oauth.page.noCode.detail': '没有收到授权码，请返回 Obsidian 重试。',
    'oauth.page.success.title': 'Google 授权成功',
    'oauth.page.success.detail': '订阅同步将继续在 Obsidian 中运行，现在可以关闭此页面。',
    'oauth.page.exchange.title': '令牌交换失败',
    'oauth.page.exchange.detail': '请返回 Obsidian 查看错误并重试。',
    'notice.needClientId': '请先在 gogoga YouTube 设置中填写 Google OAuth Client ID',
    'notice.badClientId': 'Google OAuth Client ID 格式不正确',
    'notice.needClientSecret': '请先在 gogoga YouTube 设置中安全保存 OAuth Client Secret',
    'notice.desktopOnly': 'Google 首次授权需要在 Obsidian 桌面版完成',
    'notice.authInProgress': 'Google 授权正在进行',
    'notice.authOpened': '已在系统浏览器打开 Google 授权页面',
    'notice.authSuccess': 'Google 账号授权成功',
    'notice.authFailed': 'Google 授权失败：{error}',
    'notice.authorizeFirst': '请先授权 Google 账号',
    'notice.syncInProgress': 'YouTube 同步正在进行',
    'notice.syncDone': '账号订阅同步完成：{count} 个频道（新增 {added}，更新 {updated}，移除 {removed}）',
    'notice.syncFailed': 'Google 账号同步失败：{error}',
    'notice.revokePartial':
      '本机令牌已移除，但 Google 端撤销失败；请到 Google 账号安全页确认。已有频道和笔记已保留。',
    'notice.revoked': 'Google 账号授权已撤销；本地频道和笔记已保留',
    'notice.revokeLocalFailed': '移除本机 Google 授权失败：{error}',
    'notice.adding': '正在添加 {count} 个频道…',
    'notice.importFailure': '{input}：{error}',
    'notice.added': '已添加 {count} 个频道',
    'notice.addedMerged': '，合并 {count} 个已有频道',
    'notice.addedFailed': '，{count} 个失败',
    'notice.refreshInProgress': 'YouTube 订阅正在刷新',
    'notice.refreshing': '正在刷新 {count} 个 YouTube 频道…',
    'notice.refreshDonePartial': 'YouTube 刷新完成，{count} 个频道失败；可在频道管理中查看',
    'notice.refreshDone': 'YouTube 刷新完成',
    'notice.untracked': '已停止跟踪“{title}”，原有笔记已保留',
    'account.fallbackTitle': '已授权的 Google 账号',
    'confirm.revoke.title': '撤销 Google 授权？',
    'confirm.revoke.message':
      '插件会通知 Google 撤销访问权，并从 Obsidian 钥匙串移除刷新令牌。已有频道、视频和笔记会保留。',
    'confirm.revoke.button': '撤销授权',
    'confirm.untrack.title': '停止跟踪频道？',
    'confirm.untrack.message': '“{title}”会从订阅面板移除；频道 Markdown 和已保存的视频笔记会保留。',
    'confirm.untrack.button': '停止跟踪',
    'settings.intro': '频道和重要视频会保存为普通 Markdown；最新视频流和已读状态保存在插件数据中。',
    'settings.rootFolder.name': '数据目录',
    'settings.rootFolder.desc': '频道笔记、视频笔记和 Channels.base 的根目录；修改后不会自动搬迁旧文件',
    'settings.account.heading': 'Google 账号同步（C2）',
    'settings.account.intro':
      '使用系统浏览器和 PKCE 授权，只申请查看 YouTube 账号的只读权限。刷新令牌保存在 Obsidian 钥匙串，不会写入 data.json。首次授权需要桌面版。',
    'settings.cloud.name': 'Google Cloud 配置',
    'settings.cloud.desc': '先启用 YouTube Data API v3，并创建“桌面应用”类型的 OAuth Client ID',
    'settings.cloud.button': '打开配置指南',
    'settings.clientId.name': 'OAuth Client ID',
    'settings.clientId.desc': '形如 123456789-xxxx.apps.googleusercontent.com；Client ID 不是令牌',
    'settings.clientSecret.name': 'OAuth Client Secret',
    'settings.clientSecret.descSaved': '已保存在 Obsidian 钥匙串；输入新值可以替换',
    'settings.clientSecret.descEmpty': 'Google Cloud 创建桌面客户端时显示的密钥；只保存到 Obsidian 钥匙串',
    'settings.clientSecret.placeholderSaved': '已安全保存',
    'settings.clientSecret.replace': '替换密钥',
    'settings.clientSecret.save': '保存密钥',
    'settings.clientSecret.clear': '清除密钥',
    'settings.clientSecret.needValue': '请先输入 OAuth Client Secret',
    'settings.clientSecret.saved': 'OAuth Client Secret 已保存到 Obsidian 钥匙串',
    'settings.clientSecret.cleared': 'OAuth Client Secret 已从 Obsidian 钥匙串移除',
    'settings.auth.name': '授权状态',
    'settings.auth.authorized': '已授权',
    'settings.auth.account': '：{account}',
    'settings.auth.lastSynced': '；上次同步：{time}',
    'settings.auth.none': '尚未授权 Google 账号',
    'settings.auth.syncNow': '立即同步订阅',
    'settings.auth.revoke': '撤销授权',
    'settings.auth.authorize': '授权 Google 账号',
    'settings.accountInterval.name': '账号订阅同步间隔',
    'settings.accountInterval.desc': '自动检查 Google 账号中的新增和取消订阅；视频更新仍由 RSS 完成',
    'settings.interval.manual': '仅手动',
    'settings.interval.minutes': '{count} 分钟',
    'settings.interval.hours': '{count} 小时',
    'settings.interval.daily': '每天',
    'settings.removeMissing.name': '同步取消订阅',
    'settings.removeMissing.desc':
      'YouTube 账号中取消订阅后，将对应账号托管频道从面板移除；Markdown 和已保存视频不会删除',
    'settings.refreshOnStartup.name': '启动时刷新',
    'settings.refreshOnStartup.desc': '距离上次刷新超过设定间隔时，在 Obsidian 启动后刷新',
    'settings.refreshInterval.name': '刷新间隔',
    'settings.refreshInterval.desc': 'Obsidian 打开期间的检查间隔；设为 0 可关闭自动刷新',
    'settings.maxVideos.name': '保留的视频索引',
    'settings.maxVideos.desc': '限制最新视频流占用的插件数据；已经保存为笔记的视频不会被清理',
    'settings.base.name': '频道库',
    'settings.base.desc': '打开插件生成的原生 Bases 频道视图',
    'settings.base.button': '打开 Channels.base',
    'settings.notes.heading': '说明',
    'settings.notes.auth': '未授权时仍可使用公开 RSS 和 Takeout；授权后只用 YouTube Data API 同步账号订阅列表。',
    'settings.notes.rss': 'RSS 只提供每个频道最近的一批视频，适合持续增量同步，不适合完整历史回填。',
    'settings.notes.closed': 'Obsidian 关闭时插件不会刷新；下一次打开时会按刷新间隔补一次。',
  },
};

let locale = 'en';

function resolveLocale() {
  let language = '';
  try {
    language = typeof getLanguage === 'function' ? String(getLanguage() || '') : '';
  } catch (_error) {
    language = '';
  }
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function setLocale(value) {
  locale = value === 'zh' ? 'zh' : 'en';
}

function t(key, vars) {
  let value = STRINGS[locale][key];
  if (value == null) value = STRINGS.en[key];
  if (value == null) return key;
  if (typeof value === 'object') {
    value = vars && vars.count === 1 ? value.one : value.other;
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeGroups(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return unique(source.map((item) => String(item).trim()).filter(Boolean));
}

function sanitizeFilename(value) {
  const clean = String(value || '')
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || 'YouTube video').slice(0, 120);
}

function isoNow() {
  return new Date().toISOString();
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseImportText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((field) =>
    field
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
  );
  const idIndex = header.findIndex((field) =>
    /channelid|频道id|频道编号/.test(field)
  );
  const urlIndex = header.findIndex((field) =>
    /channelurl|^url$|频道网址|频道链接/.test(field)
  );
  const titleIndex = header.findIndex((field) =>
    /channeltitle|^title$|^name$|频道标题|频道名称/.test(field)
  );
  const hasHeader = idIndex >= 0 || urlIndex >= 0;
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line) => {
      const fields = parseCsvLine(line);
      if (hasHeader) {
        return {
          input: fields[urlIndex] || fields[idIndex] || '',
          title: titleIndex >= 0 ? fields[titleIndex] : '',
        };
      }
      const joined = fields.join(' ');
      const url = fields.find((field) => /(?:youtube\.com|youtu\.be|feeds\/videos\.xml)/i.test(field));
      const id = joined.match(CHANNEL_ID_RE);
      return {
        input: url || (id && id[0]) || fields[0] || '',
        title: url || id ? fields.find((field) => field !== url && !CHANNEL_ID_RE.test(field)) || '' : '',
      };
    })
    .filter((row) => row.input);
}

function normalizeOAuthClientId(value) {
  return String(value || '').trim();
}

function bestThumbnail(thumbnails) {
  const source = thumbnails || {};
  return (
    (source.high && source.high.url) ||
    (source.medium && source.medium.url) ||
    (source.default && source.default.url) ||
    ''
  );
}

function subscriptionItemsToEntries(items) {
  const entries = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const snippet = (item && item.snippet) || {};
    const resourceId = snippet.resourceId || {};
    const id = channelIdFromInput(resourceId.channelId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      title: snippet.title || id,
      thumbnail: bestThumbnail(snippet.thumbnails),
    });
  }
  return entries;
}

function channelIdFromInput(input) {
  const direct = String(input || '').match(CHANNEL_ID_RE);
  return direct ? direct[0] : '';
}

function normalizeChannelInput(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (CHANNEL_ID_RE.test(value)) return channelIdFromInput(value);
  if (value.startsWith('@')) return 'https://www.youtube.com/' + value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(?:www\.)?youtube\.com\//i.test(value)) return 'https://' + value;
  return 'https://www.youtube.com/@' + value;
}

function decodeHtml(value) {
  if (!value) return '';
  const doc = new DOMParser().parseFromString('<body>' + value, 'text/html');
  return (doc.body && doc.body.textContent) || value;
}

function extractPageMetadata(html) {
  const source = String(html || '');
  const idMatch =
    source.match(/feeds\/videos\.xml\?channel_id=(UC[A-Za-z0-9_-]{22})/) ||
    source.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/) ||
    source.match(/<link[^>]+href="https?:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/i) ||
    source.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/);
  const titleMatch =
    source.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    source.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
  const imageMatch =
    source.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
    source.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
  return {
    id: idMatch ? idMatch[1] : '',
    title: titleMatch ? decodeHtml(titleMatch[1]) : '',
    thumbnail: imageMatch ? decodeHtml(imageMatch[1]) : '',
  };
}

function firstText(parent, tagName) {
  const node = parent.getElementsByTagName(tagName)[0];
  return node ? String(node.textContent || '').trim() : '';
}

function firstAttribute(parent, tagName, attribute) {
  const node = parent.getElementsByTagName(tagName)[0];
  return node ? String(node.getAttribute(attribute) || '').trim() : '';
}

function parseFeedXml(xml, fallbackChannelId) {
  const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error(t('error.rssParse'));
  }
  const feed = doc.documentElement;
  // YouTube's feed-level yt:channelId currently omits the leading "UC",
  // while each entry contains the full ID. The known ID from the feed URL
  // is therefore the safest canonical value.
  const channelId = fallbackChannelId || firstText(feed, 'yt:channelId');
  const channelTitle = firstText(feed, 'title');
  const entries = Array.from(doc.getElementsByTagName('entry'));
  const videos = entries
    .map((entry) => {
      const videoId = firstText(entry, 'yt:videoId');
      const mediaGroup = entry.getElementsByTagName('media:group')[0] || entry;
      const linkNodes = Array.from(entry.getElementsByTagName('link'));
      const alternate = linkNodes.find((node) => node.getAttribute('rel') === 'alternate');
      const url =
        (alternate && alternate.getAttribute('href')) ||
        (videoId ? 'https://www.youtube.com/watch?v=' + videoId : '');
      return {
        id: videoId,
        channelId: firstText(entry, 'yt:channelId') || channelId,
        channelTitle: firstText(entry, 'name') || channelTitle,
        title: firstText(entry, 'title'),
        url,
        publishedAt: firstText(entry, 'published'),
        updatedAt: firstText(entry, 'updated'),
        thumbnail: firstAttribute(mediaGroup, 'media:thumbnail', 'url'),
        views: Number(firstAttribute(mediaGroup, 'media:statistics', 'views')) || null,
      };
    })
    .filter((video) => video.id && video.title && video.url);
  return { channelId, channelTitle, videos };
}

function formatRelativeTime(value) {
  if (!value) return t('time.never');
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const delta = Date.now() - timestamp;
  const future = delta < 0;
  const absolute = Math.abs(delta);
  let amount;
  let unit;
  if (absolute < 60 * 1000) {
    amount = Math.max(1, Math.round(absolute / 1000));
    unit = 'time.seconds';
  } else if (absolute < 60 * 60 * 1000) {
    amount = Math.round(absolute / (60 * 1000));
    unit = 'time.minutes';
  } else if (absolute < 24 * 60 * 60 * 1000) {
    amount = Math.round(absolute / (60 * 60 * 1000));
    unit = 'time.hours';
  } else if (absolute < 30 * 24 * 60 * 60 * 1000) {
    amount = Math.round(absolute / (24 * 60 * 60 * 1000));
    unit = 'time.days';
  } else {
    return new Date(value).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US');
  }
  const time = t(unit, { count: amount });
  return future ? t('time.in', { time }) : t('time.ago', { time });
}

function formatViews(value) {
  if (!value) return '';
  if (locale !== 'zh') {
    const compact = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return t('views.count', { count: value === 1 ? 1 : compact });
  }
  if (value >= 100000000) return (value / 100000000).toFixed(1) + '亿次观看';
  if (value >= 10000) return (value / 10000).toFixed(1) + '万次观看';
  return t('views.count', { count: value.toLocaleString('zh-CN') });
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const results = new Array(items.length);
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

class AddChannelsModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.importText = '';
    this.groups = '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('gg-youtube-modal');
    contentEl.createEl('h2', { text: t('modal.add.title') });
    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('modal.add.desc'),
    });

    let textArea;
    new Setting(contentEl)
      .setName(t('modal.add.list'))
      .addTextArea((component) => {
        textArea = component;
        component
          .setPlaceholder('https://www.youtube.com/@channel\nUCxxxxxxxxxxxxxxxxxxxxxx')
          .onChange((value) => {
            this.importText = value;
          });
        component.inputEl.rows = 9;
        component.inputEl.addClass('gg-youtube-import-textarea');
      });

    const pickerRow = contentEl.createDiv({ cls: 'gg-youtube-file-picker' });
    const pickerLabel = pickerRow.createEl('label', {
      cls: 'mod-cta gg-youtube-file-button',
      text: t('modal.add.pickFile'),
    });
    const picker = pickerLabel.createEl('input', {
      attr: { type: 'file', accept: '.csv,.txt,text/csv,text/plain' },
    });
    picker.addEventListener('change', async () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      const value = await file.text();
      this.importText = value;
      textArea.setValue(value);
    });

    new Setting(contentEl)
      .setName(t('modal.add.groups'))
      .setDesc(t('modal.add.groupsDesc'))
      .addText((component) =>
        component.setPlaceholder(t('modal.add.groupsPlaceholder')).onChange((value) => {
          this.groups = value;
        })
      );

    const actions = contentEl.createDiv({ cls: 'modal-button-container' });
    actions.createEl('button', { text: t('common.cancel') }).addEventListener('click', () => this.close());
    actions
      .createEl('button', { cls: 'mod-cta', text: t('modal.add.submit') })
      .addEventListener('click', () => {
        const entries = parseImportText(this.importText);
        if (!entries.length) {
          new Notice(t('modal.add.empty'));
          return;
        }
        this.close();
        this.onSubmit(entries, normalizeGroups(this.groups));
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class EditGroupsModal extends Modal {
  constructor(app, channel, onSubmit) {
    super(app);
    this.channel = channel;
    this.groups = channel.groups.join(', ');
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('gg-youtube-modal');
    contentEl.createEl('h2', { text: t('modal.groups.title') });
    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: this.channel.title,
    });
    new Setting(contentEl)
      .setName(t('modal.groups.name'))
      .setDesc(t('modal.groups.desc'))
      .addText((component) =>
        component.setValue(this.groups).onChange((value) => {
          this.groups = value;
        })
      );
    const actions = contentEl.createDiv({ cls: 'modal-button-container' });
    actions.createEl('button', { text: t('common.cancel') }).addEventListener('click', () => this.close());
    actions
      .createEl('button', { cls: 'mod-cta', text: t('common.save') })
      .addEventListener('click', () => {
        this.close();
        this.onSubmit(normalizeGroups(this.groups));
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ConfirmModal extends Modal {
  constructor(app, title, message, confirmText, onConfirm) {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmText = confirmText;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', { text: this.message });
    const actions = contentEl.createDiv({ cls: 'modal-button-container' });
    actions.createEl('button', { text: t('common.cancel') }).addEventListener('click', () => this.close());
    actions
      .createEl('button', { cls: 'mod-warning', text: this.confirmText })
      .addEventListener('click', () => {
        this.close();
        this.onConfirm();
      });
  }
}

class GogogaYouTubeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = 'videos';
    this.group = '';
    this.query = '';
    this.unreadOnly = false;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return t('view.title');
  }

  getIcon() {
    return 'youtube';
  }

  async onOpen() {
    this.render();
  }

  onClose() {}

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('gg-youtube-view');
    this.renderHeader(root);
    if (!this.plugin.channels.length) {
      this.renderEmpty(root);
      return;
    }
    if (this.tab === 'channels') this.renderChannels(root);
    else this.renderVideos(root);
  }

  renderHeader(root) {
    const header = root.createDiv({ cls: 'gg-youtube-header' });
    const titleWrap = header.createDiv();
    titleWrap.createEl('h2', { text: t('view.title') });
    const statusParts = [
      t('view.status.videos', { time: formatRelativeTime(this.plugin.lastRefreshAt) }),
    ];
    if (this.plugin.hasGoogleAuthorization()) {
      statusParts.push(
        t('view.status.account', {
          time: formatRelativeTime(this.plugin.accountSync.lastSyncedAt),
        })
      );
    }
    titleWrap.createDiv({
      cls: 'gg-youtube-sync-status',
      text: this.plugin.syncingAccount
        ? t('view.status.syncing')
        : this.plugin.refreshing
          ? t('view.status.refreshing', {
              done: this.plugin.refreshProgress.done,
              total: this.plugin.refreshProgress.total,
            })
          : statusParts.join(' · '),
    });

    const actions = header.createDiv({ cls: 'gg-youtube-header-actions' });
    const addButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': t('view.addChannel') },
    });
    setIcon(addButton, 'plus');
    addButton.addEventListener('click', () => this.plugin.openAddModal());

    const accountButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: {
        'aria-label': this.plugin.hasGoogleAuthorization()
          ? t('view.syncAccount')
          : t('view.authorize'),
      },
    });
    accountButton.disabled = this.plugin.refreshing || this.plugin.syncingAccount;
    setIcon(
      accountButton,
      this.plugin.hasGoogleAuthorization() ? 'cloud-download' : 'key-round'
    );
    accountButton.addEventListener('click', () => {
      if (this.plugin.hasGoogleAuthorization()) this.plugin.syncAccountSubscriptions();
      else this.plugin.authorizeGoogleAccount();
    });

    const refreshButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: {
        'aria-label': this.plugin.refreshing ? t('view.refreshing') : t('view.refreshAll'),
      },
    });
    refreshButton.disabled = this.plugin.refreshing || this.plugin.syncingAccount;
    setIcon(refreshButton, 'refresh-cw');
    refreshButton.toggleClass('is-spinning', this.plugin.refreshing);
    refreshButton.addEventListener('click', () => this.plugin.refreshAll());

    const tabs = root.createDiv({ cls: 'gg-youtube-tabs' });
    [
      ['videos', t('view.tab.videos')],
      ['channels', t('view.tab.channels')],
    ].forEach(([value, label]) => {
      const button = tabs.createEl('button', {
        cls: 'gg-youtube-tab',
        text: label,
      });
      button.toggleClass('is-active', this.tab === value);
      button.addEventListener('click', () => {
        this.tab = value;
        this.render();
      });
    });
  }

  renderEmpty(root) {
    const empty = root.createDiv({ cls: 'gg-youtube-empty' });
    const icon = empty.createDiv({ cls: 'gg-youtube-empty-icon' });
    setIcon(icon, 'youtube');
    empty.createEl('h3', { text: t('view.empty.title') });
    empty.createEl('p', {
      text: t('view.empty.desc'),
    });
    empty
      .createEl('button', { cls: 'mod-cta', text: t('view.addChannel') })
      .addEventListener('click', () => this.plugin.openAddModal());
  }

  renderFilters(root, includeUnread) {
    const filters = root.createDiv({ cls: 'gg-youtube-filters' });
    const groups = this.plugin.groups();
    if (
      this.group &&
      this.group !== '__ungrouped__' &&
      !groups.includes(this.group)
    ) {
      this.group = '';
    }
    const search = filters.createEl('input', {
      cls: 'gg-youtube-search',
      attr: { type: 'search', placeholder: t('view.filter.search'), value: this.query },
    });
    search.addEventListener('input', () => {
      this.query = search.value;
      this.render();
      const next = this.contentEl.querySelector('.gg-youtube-search');
      if (next) {
        next.focus();
        next.setSelectionRange(this.query.length, this.query.length);
      }
    });

    const select = filters.createEl('select', { cls: 'dropdown' });
    select.createEl('option', { text: t('view.filter.allGroups'), value: '' });
    select.createEl('option', { text: t('view.filter.ungrouped'), value: '__ungrouped__' });
    groups.forEach((group) => {
      select.createEl('option', { text: group, value: group });
    });
    select.value = this.group;
    select.addEventListener('change', () => {
      this.group = select.value;
      this.render();
    });

    if (includeUnread) {
      const unread = filters.createEl('label', { cls: 'gg-youtube-unread-toggle' });
      const checkbox = unread.createEl('input', { attr: { type: 'checkbox' } });
      checkbox.checked = this.unreadOnly;
      unread.createSpan({ text: t('view.filter.unreadOnly') });
      checkbox.addEventListener('change', () => {
        this.unreadOnly = checkbox.checked;
        this.render();
      });
    }
  }

  filteredChannels(applyQuery) {
    const shouldApplyQuery = applyQuery !== false;
    const query = shouldApplyQuery ? this.query.trim().toLocaleLowerCase() : '';
    return this.plugin.channels
      .filter((channel) => {
        if (this.group === '__ungrouped__' && channel.groups.length) return false;
        if (this.group && this.group !== '__ungrouped__' && !channel.groups.includes(this.group)) {
          return false;
        }
        if (!query) return true;
        return (
          channel.title.toLocaleLowerCase().includes(query) ||
          channel.groups.some((group) => group.toLocaleLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        return new Date(b.lastPublishedAt || 0).getTime() - new Date(a.lastPublishedAt || 0).getTime();
      });
  }

  filteredVideos() {
    const channelIds = new Set(this.filteredChannels(false).map((channel) => channel.id));
    const query = this.query.trim().toLocaleLowerCase();
    return Object.values(this.plugin.videos)
      .filter((video) => channelIds.has(video.channelId))
      .filter((video) => !this.unreadOnly || !video.readAt)
      .filter((video) => {
        if (!query) return true;
        return (
          video.title.toLocaleLowerCase().includes(query) ||
          video.channelTitle.toLocaleLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  renderVideos(root) {
    this.renderFilters(root, true);
    const videos = this.filteredVideos();
    const summary = root.createDiv({ cls: 'gg-youtube-summary' });
    summary.createSpan({
      text: t('view.summary.videos', {
        count: videos.length,
        unread: videos.filter((video) => !video.readAt).length,
      }),
    });
    if (videos.some((video) => !video.readAt)) {
      summary
        .createEl('button', { cls: 'clickable-icon gg-youtube-text-button', text: t('view.markAllRead') })
        .addEventListener('click', () => this.plugin.markVideosRead(videos));
    }

    if (!videos.length) {
      root.createDiv({
        cls: 'gg-youtube-no-results',
        text: this.unreadOnly ? t('view.noUnreadVideos') : t('view.noVideos'),
      });
      return;
    }

    const grid = root.createDiv({ cls: 'gg-youtube-video-grid' });
    videos.forEach((video) => this.renderVideoCard(grid, video));
  }

  renderVideoCard(grid, video) {
    const card = grid.createDiv({ cls: 'gg-youtube-video-card' });
    card.toggleClass('is-read', Boolean(video.readAt));
    const media = card.createEl('a', {
      cls: 'gg-youtube-thumbnail',
      href: video.url,
      attr: { target: '_blank', rel: 'noopener' },
    });
    if (video.thumbnail) {
      media.createEl('img', {
        attr: {
          src: video.thumbnail,
          alt: '',
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
        },
      });
    } else {
      const placeholder = media.createDiv({ cls: 'gg-youtube-thumbnail-placeholder' });
      setIcon(placeholder, 'youtube');
    }
    media.addEventListener('click', () => this.plugin.markVideoRead(video.id));

    const body = card.createDiv({ cls: 'gg-youtube-video-body' });
    const title = body.createEl('a', {
      cls: 'gg-youtube-video-title',
      text: video.title,
      href: video.url,
      attr: { target: '_blank', rel: 'noopener' },
    });
    title.addEventListener('click', () => this.plugin.markVideoRead(video.id));
    body.createDiv({
      cls: 'gg-youtube-video-channel',
      text: video.channelTitle,
    });
    const meta = body.createDiv({ cls: 'gg-youtube-video-meta' });
    meta.createSpan({ text: formatRelativeTime(video.publishedAt) });
    const views = formatViews(video.views);
    if (views) meta.createSpan({ text: views });

    const actions = body.createDiv({ cls: 'gg-youtube-video-actions' });
    const readButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': video.readAt ? t('view.markUnread') : t('view.markRead') },
    });
    setIcon(readButton, video.readAt ? 'mail' : 'check');
    readButton.addEventListener('click', () => this.plugin.toggleVideoRead(video.id));

    const saveButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': video.notePath ? t('view.openNote') : t('view.saveNote') },
    });
    setIcon(saveButton, video.notePath ? 'file-check-2' : 'file-plus-2');
    saveButton.addEventListener('click', () => this.plugin.saveOrOpenVideoNote(video.id));
  }

  renderChannels(root) {
    this.renderFilters(root, false);
    const channels = this.filteredChannels();
    const summary = root.createDiv({ cls: 'gg-youtube-summary' });
    summary.createSpan({
      text: t('view.summary.channels', {
        count: channels.length,
        enabled: channels.filter((channel) => channel.enabled).length,
      }),
    });

    if (!channels.length) {
      root.createDiv({ cls: 'gg-youtube-no-results', text: t('view.noChannels') });
      return;
    }

    const list = root.createDiv({ cls: 'gg-youtube-channel-list' });
    channels.forEach((channel) => this.renderChannelRow(list, channel));
  }

  renderChannelRow(list, channel) {
    const row = list.createDiv({ cls: 'gg-youtube-channel-row' });
    row.toggleClass('is-disabled', !channel.enabled);
    if (channel.thumbnail) {
      row.createEl('img', {
        cls: 'gg-youtube-channel-avatar',
        attr: {
          src: channel.thumbnail,
          alt: '',
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
        },
      });
    } else {
      const avatar = row.createDiv({ cls: 'gg-youtube-channel-avatar is-placeholder' });
      setIcon(avatar, 'user-round');
    }

    const body = row.createDiv({ cls: 'gg-youtube-channel-body' });
    const titleLine = body.createDiv({ cls: 'gg-youtube-channel-title-line' });
    titleLine.createEl('a', {
      text: channel.title,
      href: channel.url,
      attr: { target: '_blank', rel: 'noopener' },
    });
    if (channel.error) {
      const error = titleLine.createSpan({
        cls: 'gg-youtube-error-dot',
        attr: { 'aria-label': channel.error },
      });
      setIcon(error, 'circle-alert');
    }
    body.createDiv({
      cls: 'gg-youtube-channel-meta',
      text: t('view.channelMeta', {
        published: formatRelativeTime(channel.lastPublishedAt),
        checked: formatRelativeTime(channel.lastCheckedAt),
      }),
    });
    const chips = body.createDiv({ cls: 'gg-youtube-group-chips' });
    if (channel.groups.length) {
      channel.groups.forEach((group) => chips.createSpan({ text: group }));
    } else {
      chips.createSpan({ cls: 'is-muted', text: t('view.ungrouped') });
    }

    const actions = row.createDiv({ cls: 'gg-youtube-channel-actions' });
    const groupButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': t('view.editGroups') },
    });
    setIcon(groupButton, 'tags');
    groupButton.addEventListener('click', () => this.plugin.openEditGroups(channel.id));

    const toggleButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': channel.enabled ? t('view.pause') : t('view.resume') },
    });
    setIcon(toggleButton, channel.enabled ? 'pause' : 'play');
    toggleButton.addEventListener('click', () => this.plugin.toggleChannel(channel.id));

    const refreshButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': t('view.refreshOne') },
    });
    setIcon(refreshButton, 'refresh-cw');
    refreshButton.addEventListener('click', () => this.plugin.refreshOne(channel.id));

    const removeButton = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': t('view.untrack') },
    });
    setIcon(removeButton, 'trash-2');
    removeButton.addEventListener('click', () => this.plugin.confirmRemoveChannel(channel.id));
  }
}

class GogogaYouTube extends Plugin {
  async onload() {
    setLocale(resolveLocale());
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || {});
    this.channels = Array.isArray(saved.channels)
      ? saved.channels.map((channel) => this.normalizeChannel(channel))
      : [];
    this.videos = saved.videos && typeof saved.videos === 'object' ? saved.videos : {};
    this.lastRefreshAt = saved.lastRefreshAt || '';
    this.accountSync = Object.assign(
      {
        accountChannelId: '',
        accountTitle: '',
        accountThumbnail: '',
        grantedScope: '',
        authorizedAt: '',
        lastSyncedAt: '',
      },
      saved.accountSync || {}
    );
    this.oauthAccessToken = '';
    this.oauthAccessTokenExpiresAt = 0;
    this.oauthServer = null;
    this.authorizing = false;
    this.syncingAccount = false;
    this.refreshing = false;
    this.refreshProgress = { done: 0, total: 0 };

    this.registerView(VIEW_TYPE, (leaf) => new GogogaYouTubeView(leaf, this));
    this.addRibbonIcon('youtube', t('view.title'), () => this.activateView());
    this.settingsTab = new GogogaYouTubeSettings(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.addCommand({
      id: 'open-subscriptions',
      name: t('command.open'),
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: 'add-channels',
      name: t('command.add'),
      callback: () => this.openAddModal(),
    });
    this.addCommand({
      id: 'authorize-google-account',
      name: t('command.authorize'),
      checkCallback: (checking) => {
        if (this.authorizing || this.hasGoogleAuthorization()) return false;
        if (!checking) this.authorizeGoogleAccount();
        return true;
      },
    });
    this.addCommand({
      id: 'sync-google-subscriptions',
      name: t('command.sync'),
      checkCallback: (checking) => {
        if (
          !this.hasGoogleAuthorization() ||
          this.authorizing ||
          this.syncingAccount ||
          this.refreshing
        ) {
          return false;
        }
        if (!checking) this.syncAccountSubscriptions();
        return true;
      },
    });
    this.addCommand({
      id: 'revoke-google-authorization',
      name: t('command.revoke'),
      checkCallback: (checking) => {
        if (!this.hasGoogleAuthorization() || this.authorizing || this.syncingAccount) {
          return false;
        }
        if (!checking) this.confirmRevokeGoogleAuthorization();
        return true;
      },
    });
    this.addCommand({
      id: 'refresh-all',
      name: t('command.refreshAll'),
      checkCallback: (checking) => {
        if (!this.channels.length || this.refreshing) return false;
        if (!checking) this.refreshAll();
        return true;
      },
    });
    this.addCommand({
      id: 'open-channels-base',
      name: t('command.openBase'),
      callback: () => this.openChannelsBase(),
    });

    this.registerInterval(
      window.setInterval(() => this.runScheduledSync(), 60 * 1000)
    );
    this.registerEvent(
      this.app.metadataCache.on('changed', (file, _data, cache) => {
        this.ingestChannelNote(file, cache);
      })
    );

    this.app.workspace.onLayoutReady(async () => {
      await this.ensureScaffold();
      if (this.isAccountSyncDue()) {
        await this.syncAccountSubscriptions({ quiet: true });
      }
      if (this.settings.refreshOnStartup && this.isRefreshDue()) {
        await this.refreshAll({ quiet: true });
      }
    });
  }

  normalizeChannel(channel) {
    return {
      id: channel.id || '',
      title: channel.title || channel.id || 'YouTube channel',
      url: channel.url || (channel.id ? 'https://www.youtube.com/channel/' + channel.id : ''),
      feedUrl:
        channel.feedUrl ||
        (channel.id
          ? 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channel.id
          : ''),
      thumbnail: channel.thumbnail || '',
      groups: normalizeGroups(channel.groups),
      enabled: channel.enabled !== false,
      addedAt: channel.addedAt || isoNow(),
      lastCheckedAt: channel.lastCheckedAt || '',
      lastPublishedAt: channel.lastPublishedAt || '',
      latestVideoId: channel.latestVideoId || '',
      error: channel.error || '',
      notePath: channel.notePath || '',
      accountManaged: channel.accountManaged === true,
    };
  }

  async persist() {
    await this.saveData({
      settings: this.settings,
      channels: this.channels,
      videos: this.videos,
      lastRefreshAt: this.lastRefreshAt,
      accountSync: this.accountSync,
    });
  }

  get rootFolder() {
    return normalizePath(this.settings.rootFolder || 'YouTube');
  }

  get channelFolder() {
    return normalizePath(this.rootFolder + '/Channels');
  }

  get videoFolder() {
    return normalizePath(this.rootFolder + '/Videos');
  }

  get basePath() {
    return normalizePath(this.rootFolder + '/Channels.base');
  }

  channelNoteTargetPath(channel, currentFile) {
    const baseName = sanitizeFilename(channel.title || channel.id || 'YouTube channel');
    const currentPath = currentFile instanceof TFile ? currentFile.path : '';
    const shortId = String(channel.id || '').slice(-6) || 'channel';
    let attempt = 0;

    while (attempt < 100) {
      const suffix = attempt === 0 ? '' : ' ' + shortId + (attempt === 1 ? '' : '-' + attempt);
      const path = normalizePath(this.channelFolder + '/' + baseName + suffix + '.md');
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (!existing || path === currentPath) return path;
      attempt++;
    }

    return normalizePath(this.channelFolder + '/' + baseName + ' ' + channel.id + '.md');
  }

  async ensureFolder(folder) {
    const normalized = normalizePath(folder);
    if (!normalized || this.app.vault.getAbstractFileByPath(normalized)) return;
    const segments = normalized.split('/');
    let current = '';
    for (const segment of segments) {
      current = current ? current + '/' + segment : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async ensureScaffold() {
    await this.ensureFolder(this.channelFolder);
    await this.ensureFolder(this.videoFolder);
    if (!this.app.vault.getAbstractFileByPath(this.basePath)) {
      const base = [
        'filters:',
        '  and:',
        '    - type == "youtube-channel"',
        '    - subscribed == true',
        'formulas:',
        "  avatar: 'image(note.thumbnail)'",
        "  channel: 'link(note.channel_url, note.title)'",
        'properties:',
        '  formula.avatar:',
        '    displayName: 头像',
        '  formula.channel:',
        '    displayName: 频道',
        '  note.groups:',
        '    displayName: 分组',
        '  note.last_published_at:',
        '    displayName: 最近更新',
        '  note.latest_video_title:',
        '    displayName: 最新视频',
        '  note.unseen_count:',
        '    displayName: 未读',
        '  note.enabled:',
        '    displayName: 自动刷新',
        'views:',
        '  - type: table',
        '    name: 最近更新',
        '    order:',
        '      - formula.avatar',
        '      - formula.channel',
        '      - note.groups',
        '      - note.latest_video_title',
        '      - note.last_published_at',
        '      - note.unseen_count',
        '      - note.enabled',
        '    sort:',
        '      - property: note.last_published_at',
        '        direction: DESC',
        '    columnSize:',
        '      formula.avatar: 56',
        '  - type: cards',
        '    name: 频道卡片',
        '    order:',
        '      - note.title',
        '      - note.latest_video_title',
        '      - note.last_published_at',
        '      - note.groups',
        '    sort:',
        '      - property: note.last_published_at',
        '        direction: DESC',
        '    image: note.thumbnail',
        '    imageAspectRatio: 1',
        '    cardSize: 210',
        '',
      ].join('\n');
      await this.app.vault.create(this.basePath, base);
    }
  }

  views() {
    return this.app.workspace
      .getLeavesOfType(VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view) => view instanceof GogogaYouTubeView);
  }

  renderViews() {
    this.views().forEach((view) => view.render());
  }

  refreshSettingsTab() {
    if (this.settingsTab && this.settingsTab.containerEl.isConnected) {
      this.settingsTab.display();
    }
  }

  openPluginSettings() {
    if (!this.app.setting) return;
    this.app.setting.open();
    this.app.setting.openTabById(this.manifest.id);
  }

  getRefreshToken() {
    return this.app.secretStorage.getSecret(REFRESH_TOKEN_SECRET_ID) || '';
  }

  setRefreshToken(token) {
    this.app.secretStorage.setSecret(REFRESH_TOKEN_SECRET_ID, String(token || ''));
  }

  getOAuthClientSecret() {
    return this.app.secretStorage.getSecret(CLIENT_SECRET_SECRET_ID) || '';
  }

  setOAuthClientSecret(secret) {
    this.app.secretStorage.setSecret(
      CLIENT_SECRET_SECRET_ID,
      String(secret || '').trim()
    );
  }

  hasGoogleAuthorization() {
    return Boolean(this.getRefreshToken());
  }

  clearAccessToken() {
    this.oauthAccessToken = '';
    this.oauthAccessTokenExpiresAt = 0;
  }

  responseJson(response) {
    if (response && response.json && typeof response.json === 'object') {
      return response.json;
    }
    try {
      return JSON.parse((response && response.text) || '{}');
    } catch (_error) {
      return {};
    }
  }

  googleError(data, fallback) {
    if (data && typeof data.error_description === 'string') return data.error_description;
    if (data && data.error && typeof data.error.message === 'string') {
      return data.error.message;
    }
    if (data && typeof data.error === 'string') return data.error;
    return fallback || t('error.google');
  }

  async oauthTokenRequest(parameters) {
    const response = await requestUrl({
      url: OAUTH_TOKEN_URL,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(parameters).toString(),
      throw: false,
    });
    const data = this.responseJson(response);
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(this.googleError(data, t('error.oauth')));
      error.code = data.error || '';
      throw error;
    }
    return data;
  }

  async exchangeAuthorizationCode(code, redirectUri, codeVerifier) {
    const clientId = normalizeOAuthClientId(this.settings.oauthClientId);
    const clientSecret = this.getOAuthClientSecret();
    const parameters = {
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    if (clientSecret) parameters.client_secret = clientSecret;
    const tokens = await this.oauthTokenRequest(parameters);
    if (!tokens.refresh_token && !this.getRefreshToken()) {
      throw new Error(t('error.noRefreshToken'));
    }
    return tokens;
  }

  async openSystemBrowser(url) {
    try {
      const electron = require('electron');
      if (electron && electron.shell && electron.shell.openExternal) {
        await electron.shell.openExternal(url);
        return;
      }
    } catch (_error) {
      // Electron is unavailable on mobile; the caller already guards desktop-only OAuth.
    }
    window.open(url);
  }

  async requestGoogleAuthorization() {
    const http = require('http');
    const crypto = require('crypto');
    const clientId = normalizeOAuthClientId(this.settings.oauthClientId);
    const codeVerifier = crypto.randomBytes(64).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = crypto.randomBytes(32).toString('base64url');

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        if (this.oauthServer === server) this.oauthServer = null;
        if (server.listening) server.close();
        if (error) reject(error);
        else resolve(value);
      };
      const sendPage = (response, status, page) => {
        const title = t('oauth.page.' + page + '.title');
        const detail = t('oauth.page.' + page + '.detail');
        const html = [
          '<!doctype html><html lang="' + (locale === 'zh' ? 'zh-CN' : 'en') + '"><meta charset="utf-8">',
          '<meta name="viewport" content="width=device-width,initial-scale=1">',
          '<title>' + title + '</title>',
          '<style>body{font:16px system-ui;max-width:560px;margin:12vh auto;padding:24px;line-height:1.6;color:#202124}h1{font-size:24px}</style>',
          '<h1>' + title + '</h1>',
          '<p>' + detail + '</p>',
        ].join('');
        response.writeHead(status, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        });
        response.end(html);
      };

      const server = http.createServer(async (request, response) => {
        const address = server.address();
        const redirectUri = 'http://127.0.0.1:' + address.port + '/oauth2callback';
        const url = new URL(request.url || '/', redirectUri);
        if (url.pathname !== '/oauth2callback') {
          sendPage(response, 404, 'notFound');
          return;
        }
        if (url.searchParams.get('state') !== state) {
          sendPage(response, 400, 'state');
          finish(new Error(t('error.oauthState')));
          return;
        }
        const oauthError = url.searchParams.get('error');
        if (oauthError) {
          sendPage(response, 400, 'incomplete');
          finish(new Error(oauthError === 'access_denied' ? t('error.oauthDenied') : oauthError));
          return;
        }
        const code = url.searchParams.get('code');
        if (!code) {
          sendPage(response, 400, 'noCode');
          finish(new Error(t('error.oauthNoCode')));
          return;
        }
        try {
          const tokens = await this.exchangeAuthorizationCode(
            code,
            redirectUri,
            codeVerifier
          );
          sendPage(response, 200, 'success');
          finish(null, tokens);
        } catch (error) {
          sendPage(response, 500, 'exchange');
          finish(error);
        }
      });

      this.oauthServer = server;
      server.once('error', (error) => finish(error));
      server.listen(0, '127.0.0.1', async () => {
        const address = server.address();
        const redirectUri = 'http://127.0.0.1:' + address.port + '/oauth2callback';
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: YOUTUBE_READONLY_SCOPE,
          access_type: 'offline',
          include_granted_scopes: 'true',
          prompt: 'consent select_account',
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        });
        try {
          await this.openSystemBrowser(OAUTH_AUTHORIZE_URL + '?' + params.toString());
        } catch (error) {
          finish(error);
        }
      });
      timeoutId = window.setTimeout(
        () => finish(new Error(t('error.oauthTimeout'))),
        10 * 60 * 1000
      );
    });
  }

  applyAccessToken(tokens) {
    this.oauthAccessToken = tokens.access_token || '';
    this.oauthAccessTokenExpiresAt =
      Date.now() + Math.max(0, Number(tokens.expires_in || 3600) - 60) * 1000;
    if (tokens.refresh_token) this.setRefreshToken(tokens.refresh_token);
    if (tokens.scope) this.accountSync.grantedScope = tokens.scope;
  }

  async authorizeGoogleAccount(options) {
    const opts = options || {};
    const clientId = normalizeOAuthClientId(this.settings.oauthClientId);
    if (!clientId) {
      new Notice(t('notice.needClientId'), 7000);
      this.openPluginSettings();
      return;
    }
    if (!/\.apps\.googleusercontent\.com$/i.test(clientId)) {
      new Notice(t('notice.badClientId'), 7000);
      this.openPluginSettings();
      return;
    }
    if (!this.getOAuthClientSecret()) {
      new Notice(t('notice.needClientSecret'), 7000);
      this.openPluginSettings();
      return;
    }
    if (!Platform.isDesktopApp) {
      new Notice(t('notice.desktopOnly'));
      return;
    }
    if (this.authorizing) {
      new Notice(t('notice.authInProgress'));
      return;
    }

    this.authorizing = true;
    this.renderViews();
    new Notice(t('notice.authOpened'));
    try {
      const tokens = await this.requestGoogleAuthorization();
      this.applyAccessToken(tokens);
      this.accountSync.authorizedAt = isoNow();
      await this.persist();
      this.refreshSettingsTab();
      new Notice(t('notice.authSuccess'));
      this.authorizing = false;
      this.renderViews();
      if (opts.syncAfter !== false) {
        await this.syncAccountSubscriptions();
      }
    } catch (error) {
      console.error('[gogoga-youtube] Google authorization failed', error);
      new Notice(t('notice.authFailed', { error: this.errorMessage(error) }), 10000);
    } finally {
      this.authorizing = false;
      this.renderViews();
      this.refreshSettingsTab();
    }
  }

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error(t('error.notAuthorized'));
    const clientId = normalizeOAuthClientId(this.settings.oauthClientId);
    if (!clientId) throw new Error(t('error.missingClientId'));
    const clientSecret = this.getOAuthClientSecret();
    if (!clientSecret) throw new Error(t('error.missingClientSecret'));
    try {
      const tokens = await this.oauthTokenRequest({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });
      this.applyAccessToken(tokens);
      await this.persist();
      return this.oauthAccessToken;
    } catch (error) {
      if (error && error.code === 'invalid_grant') {
        this.setRefreshToken('');
        this.clearAccessToken();
        this.accountSync.authorizedAt = '';
        await this.persist();
        this.refreshSettingsTab();
        throw new Error(t('error.authExpired'));
      }
      throw error;
    }
  }

  async getAccessToken() {
    if (
      this.oauthAccessToken &&
      this.oauthAccessTokenExpiresAt > Date.now()
    ) {
      return this.oauthAccessToken;
    }
    return this.refreshAccessToken();
  }

  async youtubeApiGet(path, parameters, allowRetry) {
    const retry = allowRetry !== false;
    const token = await this.getAccessToken();
    const params = new URLSearchParams(parameters || {});
    const response = await requestUrl({
      url: YOUTUBE_API_URL + path + '?' + params.toString(),
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + token,
      },
      throw: false,
    });
    if (response.status === 401 && retry) {
      this.clearAccessToken();
      return this.youtubeApiGet(path, parameters, false);
    }
    const data = this.responseJson(response);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(this.googleError(data, t('error.youtubeApi', { status: response.status })));
    }
    return data;
  }

  async fetchGoogleAccountChannel() {
    const data = await this.youtubeApiGet('/channels', {
      part: 'snippet',
      mine: 'true',
      maxResults: '1',
      fields: 'items(id,snippet(title,thumbnails))',
    });
    const item = Array.isArray(data.items) ? data.items[0] : null;
    return item
      ? {
          id: item.id || '',
          title: (item.snippet && item.snippet.title) || '',
          thumbnail: bestThumbnail(item.snippet && item.snippet.thumbnails),
        }
      : { id: '', title: t('account.fallbackTitle'), thumbnail: '' };
  }

  async fetchGoogleSubscriptions() {
    const items = [];
    const seenTokens = new Set();
    let pageToken = '';
    do {
      const parameters = {
        part: 'snippet',
        mine: 'true',
        maxResults: '50',
        order: 'alphabetical',
        fields: 'nextPageToken,items(snippet(title,resourceId/channelId,thumbnails))',
      };
      if (pageToken) parameters.pageToken = pageToken;
      const data = await this.youtubeApiGet('/subscriptions', parameters);
      if (Array.isArray(data.items)) items.push(...data.items);
      pageToken = data.nextPageToken || '';
      if (pageToken && seenTokens.has(pageToken)) {
        throw new Error(t('error.duplicatePageToken'));
      }
      if (pageToken) seenTokens.add(pageToken);
      if (seenTokens.size > 100) throw new Error(t('error.tooManySubscriptions'));
    } while (pageToken);
    return subscriptionItemsToEntries(items);
  }

  isAccountSyncDue() {
    if (!this.hasGoogleAuthorization() || this.syncingAccount || this.refreshing) return false;
    const interval = Number(this.settings.accountSyncIntervalMinutes);
    if (!interval) return false;
    if (!this.accountSync.lastSyncedAt) return true;
    return (
      Date.now() - new Date(this.accountSync.lastSyncedAt).getTime() >=
      interval * 60 * 1000
    );
  }

  async runScheduledSync() {
    if (this.syncingAccount || this.refreshing || this.authorizing) return;
    try {
      if (this.isAccountSyncDue()) {
        await this.syncAccountSubscriptions({ quiet: true });
      } else {
        this.maybeAutoRefresh();
      }
    } catch (error) {
      console.error('[gogoga-youtube] scheduled sync failed', error);
    }
  }

  async syncAccountSubscriptions(options) {
    const opts = options || {};
    if (!this.hasGoogleAuthorization()) {
      if (!opts.quiet) new Notice(t('notice.authorizeFirst'));
      return;
    }
    if (this.syncingAccount || this.refreshing || this.authorizing) {
      if (!opts.quiet) new Notice(t('notice.syncInProgress'));
      return;
    }

    this.syncingAccount = true;
    this.renderViews();
    if (!opts.quiet) new Notice(t('view.status.syncing'));
    let added = 0;
    let updated = 0;
    let removed = 0;
    let remoteEntries = [];
    try {
      const account = await this.fetchGoogleAccountChannel();
      remoteEntries = await this.fetchGoogleSubscriptions();
      const remoteIds = new Set(remoteEntries.map((entry) => entry.id));

      for (const entry of remoteEntries) {
        let channel = this.channels.find((item) => item.id === entry.id);
        if (channel) {
          channel.title = entry.title || channel.title;
          channel.thumbnail = entry.thumbnail || channel.thumbnail;
          channel.accountManaged = true;
          channel.url = 'https://www.youtube.com/channel/' + entry.id;
          channel.feedUrl =
            'https://www.youtube.com/feeds/videos.xml?channel_id=' + entry.id;
          updated++;
        } else {
          channel = this.normalizeChannel({
            id: entry.id,
            title: entry.title,
            thumbnail: entry.thumbnail,
            url: 'https://www.youtube.com/channel/' + entry.id,
            feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=' + entry.id,
            accountManaged: true,
            addedAt: isoNow(),
          });
          this.channels.push(channel);
          added++;
        }
        await this.syncChannelNote(channel);
      }

      if (this.settings.removeMissingAccountSubscriptions) {
        const missing = this.channels.filter(
          (channel) => channel.accountManaged && !remoteIds.has(channel.id)
        );
        for (const channel of missing) {
          channel.enabled = false;
          await this.syncChannelNote(channel, { subscribed: false });
        }
        if (missing.length) {
          const missingIds = new Set(missing.map((channel) => channel.id));
          this.channels = this.channels.filter((channel) => !missingIds.has(channel.id));
          removed = missing.length;
        }
      }

      this.accountSync.accountChannelId = account.id;
      this.accountSync.accountTitle = account.title;
      this.accountSync.accountThumbnail = account.thumbnail;
      this.accountSync.lastSyncedAt = isoNow();
      await this.persist();
      this.renderViews();
      this.refreshSettingsTab();

      const refreshIds = remoteEntries
        .map((entry) => entry.id)
        .filter((id) => {
          const channel = this.channels.find((item) => item.id === id);
          return channel && channel.enabled;
        });
      if (refreshIds.length) {
        await this.refreshSelected(refreshIds, { quiet: true });
      }

      if (!opts.quiet) {
        new Notice(
          t('notice.syncDone', {
            count: remoteEntries.length,
            added,
            updated,
            removed,
          }),
          8000
        );
      }
    } catch (error) {
      console.error('[gogoga-youtube] account sync failed', error);
      if (!opts.quiet) {
        new Notice(t('notice.syncFailed', { error: this.errorMessage(error) }), 10000);
      }
    } finally {
      this.syncingAccount = false;
      this.renderViews();
      this.refreshSettingsTab();
    }
  }

  confirmRevokeGoogleAuthorization() {
    new ConfirmModal(
      this.app,
      t('confirm.revoke.title'),
      t('confirm.revoke.message'),
      t('confirm.revoke.button'),
      () => this.revokeGoogleAuthorization()
    ).open();
  }

  async revokeGoogleAuthorization() {
    let revokeError = null;
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        const response = await requestUrl({
          url: OAUTH_REVOKE_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ token: refreshToken }).toString(),
          throw: false,
        });
        if (response.status < 200 || response.status >= 300) {
          revokeError = new Error(t('error.revokeHttp', { status: response.status }));
        }
      }
    } catch (error) {
      revokeError = error;
      console.error('[gogoga-youtube] remote revoke failed', error);
    }

    try {
      this.setRefreshToken('');
      this.clearAccessToken();
      this.accountSync = {
        accountChannelId: '',
        accountTitle: '',
        accountThumbnail: '',
        grantedScope: '',
        authorizedAt: '',
        lastSyncedAt: '',
      };
      await this.persist();
      this.renderViews();
      this.refreshSettingsTab();
      new Notice(
        revokeError
          ? t('notice.revokePartial')
          : t('notice.revoked'),
        revokeError ? 10000 : 5000
      );
    } catch (error) {
      console.error('[gogoga-youtube] local revoke cleanup failed', error);
      new Notice(t('notice.revokeLocalFailed', { error: this.errorMessage(error) }), 10000);
    }
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  openAddModal() {
    new AddChannelsModal(this.app, (entries, groups) => {
      this.addChannels(entries, groups);
    }).open();
  }

  openEditGroups(channelId) {
    const channel = this.channels.find((item) => item.id === channelId);
    if (!channel) return;
    new EditGroupsModal(this.app, channel, async (groups) => {
      channel.groups = groups;
      await this.syncChannelNote(channel);
      await this.persist();
      this.renderViews();
    }).open();
  }

  groups() {
    return unique(this.channels.flatMap((channel) => channel.groups)).sort((a, b) =>
      a.localeCompare(b, 'zh-CN')
    );
  }

  async ingestChannelNote(file, cache) {
    if (!(file instanceof TFile)) return;
    const frontmatter = cache && cache.frontmatter;
    if (!frontmatter || frontmatter.type !== 'youtube-channel') return;
    const id = String(frontmatter.channel_id || '');
    const channel = this.channels.find(
      (item) => item.id === id || item.notePath === file.path
    );
    if (!channel) return;

    const groups = normalizeGroups(frontmatter.groups);
    const enabled =
      typeof frontmatter.enabled === 'boolean'
        ? frontmatter.enabled
        : String(frontmatter.enabled).toLowerCase() !== 'false';
    const changed =
      channel.notePath !== file.path ||
      channel.enabled !== enabled ||
      JSON.stringify(channel.groups) !== JSON.stringify(groups);
    if (!changed) return;

    channel.notePath = file.path;
    channel.groups = groups;
    channel.enabled = enabled;
    await this.persist();
    this.renderViews();
  }

  async resolveChannel(entry) {
    const normalized = normalizeChannelInput(entry.input);
    if (!normalized) throw new Error(t('error.emptyChannel'));
    let id = channelIdFromInput(normalized);
    let pageMetadata = { id: '', title: '', thumbnail: '' };
    let pageUrl = id ? 'https://www.youtube.com/channel/' + id : normalized;

    try {
      const response = await requestUrl({
        url: pageUrl,
        method: 'GET',
        headers: { Accept: 'text/html' },
        throw: false,
      });
      if (response.status >= 200 && response.status < 400) {
        pageMetadata = extractPageMetadata(response.text);
        if (!id) id = pageMetadata.id;
      }
    } catch (error) {
      if (!id) throw error;
    }

    if (!id) {
      throw new Error(t('error.noChannelId', { input: entry.input }));
    }
    return {
      id,
      title: entry.title || pageMetadata.title || id,
      url: 'https://www.youtube.com/channel/' + id,
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=' + id,
      thumbnail: pageMetadata.thumbnail || '',
    };
  }

  async fetchFeed(channel) {
    const response = await requestUrl({
      url: channel.feedUrl,
      method: 'GET',
      headers: {
        Accept: 'application/atom+xml, application/xml, text/xml',
      },
      throw: false,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(t('error.rssHttp', { status: response.status }));
    }
    return parseFeedXml(response.text, channel.id);
  }

  async addChannels(entries, groups) {
    if (!entries.length) return;
    new Notice(t('notice.adding', { count: entries.length }));
    let added = 0;
    let duplicates = 0;
    const failures = [];

    const results = await mapLimit(entries, 3, (entry) => this.resolveChannel(entry));
    for (let index = 0; index < results.length; index++) {
      const resolved = results[index];
      if (!resolved || resolved.error) {
        failures.push(
          t('notice.importFailure', {
            input: entries[index].input,
            error: this.errorMessage(resolved && resolved.error),
          })
        );
        continue;
      }
      const existing = this.channels.find((channel) => channel.id === resolved.id);
      if (existing) {
        existing.groups = unique(existing.groups.concat(groups));
        if (!existing.thumbnail && resolved.thumbnail) existing.thumbnail = resolved.thumbnail;
        duplicates++;
        await this.syncChannelNote(existing);
        continue;
      }
      const channel = this.normalizeChannel(
        Object.assign({}, resolved, {
          groups,
          addedAt: isoNow(),
        })
      );
      this.channels.push(channel);
      added++;
      await this.syncChannelNote(channel);
    }

    await this.persist();
    this.renderViews();
    const successChannels = unique(
      results
        .filter((result) => result && !result.error)
        .map((result) => result.id)
    );
    if (successChannels.length) {
      const refreshed = new Set(successChannels);
      const coversAll = this.channels
        .filter((channel) => channel.enabled)
        .every((channel) => refreshed.has(channel.id));
      await this.refreshSelected(successChannels, {
        quiet: true,
        allChannels: coversAll,
      });
    }

    let message = t('notice.added', { count: added });
    if (duplicates) message += t('notice.addedMerged', { count: duplicates });
    if (failures.length) {
      message += t('notice.addedFailed', { count: failures.length });
      console.warn('[gogoga-youtube] import failures', failures);
    }
    new Notice(message, 7000);
  }

  errorMessage(error) {
    if (!error) return t('error.unknown');
    return error.message || String(error);
  }

  async refreshChannel(channel) {
    try {
      const feed = await this.fetchFeed(channel);
      channel.title = feed.channelTitle || channel.title;
      channel.error = '';
      channel.lastCheckedAt = isoNow();
      feed.videos.forEach((incoming) => {
        const existing = this.videos[incoming.id] || {};
        this.videos[incoming.id] = Object.assign({}, existing, incoming, {
          discoveredAt: existing.discoveredAt || isoNow(),
          readAt: existing.readAt || '',
          notePath: existing.notePath || '',
        });
      });
      const latest = feed.videos
        .slice()
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
      if (latest) {
        channel.latestVideoId = latest.id;
        channel.lastPublishedAt = latest.publishedAt;
      }
      await this.syncChannelNote(channel);
      return { ok: true, count: feed.videos.length };
    } catch (error) {
      channel.lastCheckedAt = isoNow();
      channel.error = this.errorMessage(error);
      await this.syncChannelNote(channel);
      return { ok: false, error };
    }
  }

  async refreshAll(options) {
    const opts = Object.assign({}, options || {}, { allChannels: true });
    return this.refreshSelected(
      this.channels.filter((channel) => channel.enabled).map((channel) => channel.id),
      opts
    );
  }

  async refreshOne(channelId) {
    await this.refreshSelected([channelId]);
  }

  async refreshSelected(channelIds, options) {
    const opts = options || {};
    if (this.refreshing) {
      if (!opts.quiet) new Notice(t('notice.refreshInProgress'));
      return;
    }
    const wanted = new Set(channelIds);
    const channels = this.channels.filter((channel) => wanted.has(channel.id));
    if (!channels.length) return;

    this.refreshing = true;
    this.refreshProgress = { done: 0, total: channels.length };
    this.renderViews();
    if (!opts.quiet) new Notice(t('notice.refreshing', { count: channels.length }));

    let failed = 0;
    try {
      const results = await mapLimit(channels, 4, async (channel) => {
        const result = await this.refreshChannel(channel);
        this.refreshProgress.done++;
        this.renderViews();
        return result;
      });
      failed = results.filter((result) => result && !result.error && !result.ok).length;
      failed += results.filter((result) => result && result.error).length;
      this.pruneVideos();
      if (opts.allChannels) this.lastRefreshAt = isoNow();
      await this.persist();
    } finally {
      this.refreshing = false;
      this.renderViews();
    }

    if (!opts.quiet) {
      new Notice(
        failed
          ? t('notice.refreshDonePartial', { count: failed })
          : t('notice.refreshDone')
      );
    }
  }

  pruneVideos() {
    const limit = Math.max(100, Number(this.settings.maxStoredVideos) || 1500);
    const videos = Object.values(this.videos).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    if (videos.length <= limit) return;
    const keep = new Set(
      videos
        .filter((video, index) => index < limit || video.notePath)
        .map((video) => video.id)
    );
    Object.keys(this.videos).forEach((id) => {
      if (!keep.has(id)) delete this.videos[id];
    });
  }

  isRefreshDue() {
    if (!this.channels.some((channel) => channel.enabled)) return false;
    if (!this.lastRefreshAt) return true;
    const interval = Number(this.settings.refreshIntervalMinutes);
    if (!interval) return false;
    return Date.now() - new Date(this.lastRefreshAt).getTime() >= interval * 60 * 1000;
  }

  maybeAutoRefresh() {
    if (!this.refreshing && this.isRefreshDue()) this.refreshAll({ quiet: true });
  }

  videosForChannel(channelId) {
    return Object.values(this.videos).filter((video) => video.channelId === channelId);
  }

  latestForChannel(channel) {
    return channel.latestVideoId ? this.videos[channel.latestVideoId] : null;
  }

  unreadCount(channelId) {
    return this.videosForChannel(channelId).filter((video) => !video.readAt).length;
  }

  async syncChannelNote(channel, options) {
    const opts = Object.assign({ subscribed: true }, options || {});
    await this.ensureFolder(this.channelFolder);
    const legacyPath = normalizePath(this.channelFolder + '/' + channel.id + '.md');
    let file = this.app.vault.getAbstractFileByPath(channel.notePath || legacyPath);
    if (!(file instanceof TFile)) {
      file = this.app.vault.getAbstractFileByPath(legacyPath);
    }
    const latest = this.latestForChannel(channel);
    const properties = {
      type: 'youtube-channel',
      title: channel.title,
      channel_id: channel.id,
      channel_url: channel.url,
      feed_url: channel.feedUrl,
      groups: channel.groups,
      subscribed: opts.subscribed,
      enabled: channel.enabled,
      account_managed: channel.accountManaged,
      added_at: channel.addedAt,
      last_checked_at: channel.lastCheckedAt || null,
      last_published_at: channel.lastPublishedAt || null,
      latest_video_title: latest ? latest.title : null,
      latest_video_url: latest ? latest.url : null,
      unseen_count: this.unreadCount(channel.id),
      thumbnail: channel.thumbnail || null,
    };

    if (file instanceof TFile) {
      const targetPath = this.channelNoteTargetPath(channel, file);
      if (targetPath !== file.path) {
        await this.app.fileManager.renameFile(file, targetPath);
        file = this.app.vault.getAbstractFileByPath(targetPath);
        if (!(file instanceof TFile)) {
          throw new Error(t('error.renameNote', { path: targetPath }));
        }
      }
      channel.notePath = file.path;
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        Object.entries(properties).forEach(([key, value]) => {
          if (value == null || value === '') delete frontmatter[key];
          else frontmatter[key] = value;
        });
        if (channel.error) frontmatter.sync_error = channel.error;
        else delete frontmatter.sync_error;
      });
      return file;
    }

    const yaml = [
      '---',
      'type: youtube-channel',
      'title: ' + JSON.stringify(channel.title),
      'channel_id: ' + JSON.stringify(channel.id),
      'channel_url: ' + JSON.stringify(channel.url),
      'feed_url: ' + JSON.stringify(channel.feedUrl),
      'groups:' + (channel.groups.length ? '' : ' []'),
    ];
    channel.groups.forEach((group) => yaml.push('  - ' + JSON.stringify(group)));
    yaml.push(
      'subscribed: ' + (opts.subscribed ? 'true' : 'false'),
      'enabled: ' + (channel.enabled ? 'true' : 'false'),
      'account_managed: ' + (channel.accountManaged ? 'true' : 'false'),
      'added_at: ' + JSON.stringify(channel.addedAt),
      'unseen_count: ' + this.unreadCount(channel.id)
    );
    if (channel.thumbnail) yaml.push('thumbnail: ' + JSON.stringify(channel.thumbnail));
    yaml.push(
      '---',
      '',
      '# ' + channel.title,
      '',
      '[打开 YouTube 频道](' + channel.url + ')',
      '',
      '## 备注',
      '',
      ''
    );
    const notePath = this.channelNoteTargetPath(channel, null);
    file = await this.app.vault.create(notePath, yaml.join('\n'));
    channel.notePath = file.path;
    return file;
  }

  async toggleVideoRead(videoId) {
    const video = this.videos[videoId];
    if (!video) return;
    video.readAt = video.readAt ? '' : isoNow();
    await this.afterReadStateChanged([video.channelId]);
  }

  async markVideoRead(videoId) {
    const video = this.videos[videoId];
    if (!video || video.readAt) return;
    video.readAt = isoNow();
    await this.afterReadStateChanged([video.channelId]);
  }

  async markVideosRead(videos) {
    const channelIds = new Set();
    videos.forEach((video) => {
      if (!video.readAt) video.readAt = isoNow();
      channelIds.add(video.channelId);
    });
    await this.afterReadStateChanged(Array.from(channelIds));
  }

  async afterReadStateChanged(channelIds) {
    const wanted = new Set(channelIds);
    await Promise.all(
      this.channels
        .filter((channel) => wanted.has(channel.id))
        .map((channel) => this.syncChannelNote(channel))
    );
    await this.persist();
    this.renderViews();
  }

  async saveOrOpenVideoNote(videoId) {
    const video = this.videos[videoId];
    if (!video) return;
    let file = video.notePath
      ? this.app.vault.getAbstractFileByPath(video.notePath)
      : null;
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }

    await this.ensureFolder(this.videoFolder);
    const date = String(video.publishedAt || '').slice(0, 10) || 'undated';
    const baseName = sanitizeFilename(date + ' ' + video.title);
    let notePath = normalizePath(this.videoFolder + '/' + baseName + '.md');
    const existing = this.app.vault.getAbstractFileByPath(notePath);
    if (existing) {
      notePath = normalizePath(this.videoFolder + '/' + baseName + ' ' + video.id + '.md');
    }
    const channel = this.channels.find((item) => item.id === video.channelId);
    const channelLink = channel && channel.notePath
      ? '[[' + channel.notePath.replace(/\.md$/, '') + '|' + channel.title + ']]'
      : video.channelTitle;
    const content = [
      '---',
      'type: youtube-video',
      'title: ' + JSON.stringify(video.title),
      'video_id: ' + JSON.stringify(video.id),
      'video_url: ' + JSON.stringify(video.url),
      'channel: ' + JSON.stringify(channelLink),
      'channel_id: ' + JSON.stringify(video.channelId),
      'published_at: ' + JSON.stringify(video.publishedAt),
      'saved_at: ' + JSON.stringify(isoNow()),
      'status: inbox',
      'thumbnail: ' + JSON.stringify(video.thumbnail || ''),
      'tags:',
      '  - youtube',
      '---',
      '',
      '# ' + video.title,
      '',
      '![](' + video.url + ')',
      '',
      '## 笔记',
      '',
      '',
    ].join('\n');
    file = await this.app.vault.create(notePath, content);
    video.notePath = file.path;
    video.readAt = video.readAt || isoNow();
    await this.afterReadStateChanged([video.channelId]);
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  async toggleChannel(channelId) {
    const channel = this.channels.find((item) => item.id === channelId);
    if (!channel) return;
    channel.enabled = !channel.enabled;
    await this.syncChannelNote(channel);
    await this.persist();
    this.renderViews();
  }

  confirmRemoveChannel(channelId) {
    const channel = this.channels.find((item) => item.id === channelId);
    if (!channel) return;
    new ConfirmModal(
      this.app,
      t('confirm.untrack.title'),
      t('confirm.untrack.message', { title: channel.title }),
      t('confirm.untrack.button'),
      () => this.removeChannel(channelId)
    ).open();
  }

  async removeChannel(channelId) {
    const channel = this.channels.find((item) => item.id === channelId);
    if (!channel) return;
    channel.enabled = false;
    await this.syncChannelNote(channel, { subscribed: false });
    this.channels = this.channels.filter((item) => item.id !== channelId);
    await this.persist();
    this.renderViews();
    new Notice(t('notice.untracked', { title: channel.title }));
  }

  async openChannelsBase() {
    await this.ensureScaffold();
    const file = this.app.vault.getAbstractFileByPath(this.basePath);
    if (file) await this.app.workspace.getLeaf('tab').openFile(file);
  }

  async saveSettings() {
    await this.persist();
    await this.ensureScaffold();
    this.renderViews();
  }

  onunload() {
    if (this.oauthServer && this.oauthServer.listening) this.oauthServer.close();
    this.oauthServer = null;
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
}

class GogogaYouTubeSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'gogoga YouTube' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('settings.intro'),
    });

    new Setting(containerEl)
      .setName(t('settings.rootFolder.name'))
      .setDesc(t('settings.rootFolder.desc'))
      .addText((component) =>
        component.setValue(this.plugin.settings.rootFolder).onChange(async (value) => {
          const normalized = normalizePath(value.trim() || 'YouTube');
          this.plugin.settings.rootFolder = normalized;
          await this.plugin.persist();
        })
      );

    containerEl.createEl('h3', { text: t('settings.account.heading') });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('settings.account.intro'),
    });

    new Setting(containerEl)
      .setName(t('settings.cloud.name'))
      .setDesc(t('settings.cloud.desc'))
      .addButton((component) =>
        component.setButtonText(t('settings.cloud.button')).onClick(() => {
          window.open(
            'https://developers.google.com/youtube/v3/guides/auth/installed-apps'
          );
        })
      );

    new Setting(containerEl)
      .setName(t('settings.clientId.name'))
      .setDesc(t('settings.clientId.desc'))
      .addText((component) => {
        component
          .setPlaceholder('….apps.googleusercontent.com')
          .setValue(this.plugin.settings.oauthClientId)
          .onChange(async (value) => {
            this.plugin.settings.oauthClientId = normalizeOAuthClientId(value);
            await this.plugin.persist();
          });
        component.inputEl.addClass('gg-youtube-oauth-client-id');
      });

    const hasClientSecret = Boolean(this.plugin.getOAuthClientSecret());
    let pendingClientSecret = '';
    const clientSecretSetting = new Setting(containerEl)
      .setName(t('settings.clientSecret.name'))
      .setDesc(
        hasClientSecret
          ? t('settings.clientSecret.descSaved')
          : t('settings.clientSecret.descEmpty')
      )
      .addText((component) => {
        component
          .setPlaceholder(hasClientSecret ? t('settings.clientSecret.placeholderSaved') : 'GOCSPX-…')
          .onChange((value) => {
            pendingClientSecret = value;
          });
        component.inputEl.type = 'password';
        component.inputEl.addClass('gg-youtube-oauth-client-id');
      })
      .addButton((component) =>
        component
          .setButtonText(
            hasClientSecret ? t('settings.clientSecret.replace') : t('settings.clientSecret.save')
          )
          .setCta()
          .onClick(() => {
            const secret = pendingClientSecret.trim();
            if (!secret) {
              new Notice(t('settings.clientSecret.needValue'));
              return;
            }
            this.plugin.setOAuthClientSecret(secret);
            new Notice(t('settings.clientSecret.saved'));
            this.display();
          })
      );
    if (hasClientSecret) {
      clientSecretSetting.addButton((component) =>
        component.setButtonText(t('settings.clientSecret.clear')).onClick(() => {
          this.plugin.setOAuthClientSecret('');
          new Notice(t('settings.clientSecret.cleared'));
          this.display();
        })
      );
    }

    const authorized = this.plugin.hasGoogleAuthorization();
    const authDescription = authorized
      ? t('settings.auth.authorized') +
        (this.plugin.accountSync.accountTitle
          ? t('settings.auth.account', { account: this.plugin.accountSync.accountTitle })
          : '') +
        (this.plugin.accountSync.lastSyncedAt
          ? t('settings.auth.lastSynced', {
              time: formatRelativeTime(this.plugin.accountSync.lastSyncedAt),
            })
          : '')
      : t('settings.auth.none');
    const authSetting = new Setting(containerEl)
      .setName(t('settings.auth.name'))
      .setDesc(authDescription);
    if (authorized) {
      authSetting
        .addButton((component) =>
          component
            .setButtonText(t('settings.auth.syncNow'))
            .setCta()
            .setDisabled(this.plugin.syncingAccount || this.plugin.refreshing)
            .onClick(() => this.plugin.syncAccountSubscriptions())
        )
        .addButton((component) =>
          component
            .setButtonText(t('settings.auth.revoke'))
            .onClick(() => this.plugin.confirmRevokeGoogleAuthorization())
        );
    } else {
      authSetting.addButton((component) =>
        component
          .setButtonText(t('settings.auth.authorize'))
          .setCta()
          .setDisabled(this.plugin.authorizing)
          .onClick(() => this.plugin.authorizeGoogleAccount())
      );
    }

    new Setting(containerEl)
      .setName(t('settings.accountInterval.name'))
      .setDesc(t('settings.accountInterval.desc'))
      .addDropdown((component) =>
        component
          .addOption('0', t('settings.interval.manual'))
          .addOption('60', t('settings.interval.hours', { count: 1 }))
          .addOption('360', t('settings.interval.hours', { count: 6 }))
          .addOption('1440', t('settings.interval.daily'))
          .setValue(String(this.plugin.settings.accountSyncIntervalMinutes))
          .onChange(async (value) => {
            this.plugin.settings.accountSyncIntervalMinutes = Number(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('settings.removeMissing.name'))
      .setDesc(t('settings.removeMissing.desc'))
      .addToggle((component) =>
        component
          .setValue(this.plugin.settings.removeMissingAccountSubscriptions)
          .onChange(async (value) => {
            this.plugin.settings.removeMissingAccountSubscriptions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('settings.refreshOnStartup.name'))
      .setDesc(t('settings.refreshOnStartup.desc'))
      .addToggle((component) =>
        component
          .setValue(this.plugin.settings.refreshOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.refreshOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('settings.refreshInterval.name'))
      .setDesc(t('settings.refreshInterval.desc'))
      .addDropdown((component) =>
        component
          .addOption('0', t('settings.interval.manual'))
          .addOption('15', t('settings.interval.minutes', { count: 15 }))
          .addOption('30', t('settings.interval.minutes', { count: 30 }))
          .addOption('60', t('settings.interval.hours', { count: 1 }))
          .addOption('180', t('settings.interval.hours', { count: 3 }))
          .addOption('360', t('settings.interval.hours', { count: 6 }))
          .setValue(String(this.plugin.settings.refreshIntervalMinutes))
          .onChange(async (value) => {
            this.plugin.settings.refreshIntervalMinutes = Number(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('settings.maxVideos.name'))
      .setDesc(t('settings.maxVideos.desc'))
      .addDropdown((component) =>
        component
          .addOption('500', '500')
          .addOption('1000', '1,000')
          .addOption('1500', '1,500')
          .addOption('3000', '3,000')
          .addOption('5000', '5,000')
          .setValue(String(this.plugin.settings.maxStoredVideos))
          .onChange(async (value) => {
            this.plugin.settings.maxStoredVideos = Number(value);
            this.plugin.pruneVideos();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('settings.base.name'))
      .setDesc(t('settings.base.desc'))
      .addButton((component) =>
        component.setButtonText(t('settings.base.button')).onClick(() => {
          this.plugin.openChannelsBase();
        })
      );

    containerEl.createEl('h3', { text: t('settings.notes.heading') });
    const notes = containerEl.createEl('ul', { cls: 'gg-youtube-settings-notes' });
    notes.createEl('li', {
      text: t('settings.notes.auth'),
    });
    notes.createEl('li', {
      text: t('settings.notes.rss'),
    });
    notes.createEl('li', {
      text: t('settings.notes.closed'),
    });
  }
}

GogogaYouTube.__test = {
  STRINGS,
  bestThumbnail,
  channelIdFromInput,
  extractPageMetadata,
  formatRelativeTime,
  formatViews,
  normalizeChannelInput,
  normalizeGroups,
  normalizeOAuthClientId,
  parseCsvLine,
  parseFeedXml,
  parseImportText,
  sanitizeFilename,
  setLocale,
  subscriptionItemsToEntries,
  t,
};

module.exports = GogogaYouTube;
