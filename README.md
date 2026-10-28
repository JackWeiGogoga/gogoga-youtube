# gogoga YouTube

**English** | [简体中文](https://github.com/JackWeiGogoga/gogoga-youtube/blob/main/README.zh-CN.md)

An Obsidian companion plugin for managing YouTube subscriptions. Public RSS and
Google Takeout work without login; optional Google OAuth account sync keeps the
channel list aligned with the signed-in YouTube account.

The interface follows Obsidian's language setting — English, or Simplified
Chinese when Obsidian is set to Chinese.

The plugin keeps the fast-moving video feed in plugin data, writes one ordinary
Markdown file per channel for long-lived metadata and groups, and creates video
notes only when you explicitly save one. This keeps a large subscription list
from flooding the vault with thousands of files.

## Features

- Add one channel or paste many at once.
- Accept channel URLs, `@handles`, `UC…` channel IDs, and Google Takeout
  `subscriptions.csv` content.
- Organize a channel into zero, one, or several groups.
- Fetch recent uploads from YouTube's public Atom feeds.
- Filter the feed by group, search, or unread state.
- Mark videos read/unread and save selected videos as Markdown notes.
- Pause individual channels and retain their local data.
- Generate a native `Channels.base` table/card view.
- Refresh at startup, on an interval while Obsidian is open, or manually.
- Authorize a Google account with the system browser, PKCE, and the read-only
  YouTube scope.
- Import the complete signed-in subscription list and periodically mirror new
  subscriptions and cancellations.

## Install

Copy these files into `<vault>/.obsidian/plugins/gogoga-youtube/`:

- `main.js`
- `manifest.json`
- `styles.css`

Reload Obsidian, then enable **gogoga YouTube** under Community plugins. Use the
YouTube ribbon icon or run **Open YouTube subscriptions** from the command palette.

The [gogoga theme](https://github.com/JackWeiGogoga/gogoga-theme) repo's
`scripts/dev-install.sh <vault-path>` also installs it.

## Add subscriptions

Choose **Add or import YouTube channels** and use any mixture of:

```text
https://www.youtube.com/@veritasium
https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA
UCHnyfMqiRRG1u-2MsSQLbXA
```

For a Takeout export, either select `subscriptions.csv` in the modal or paste
its contents. The importer recognizes columns named like `Channel Id`,
`Channel Url`, and `Channel Title`.

## Google account sync (C2)

Account sync is optional. The plugin continues to work with public RSS when it
is not configured.

1. In Google Cloud, enable **YouTube Data API v3** for a project.
2. Configure the OAuth consent screen. If the app remains in external testing,
   add the Google account you use for YouTube as a test user.
3. Create an OAuth Client ID of type **Desktop app**.
4. In Obsidian, open **gogoga YouTube → Options**, paste the Client ID, save
   the Client Secret to Obsidian SecretStorage, and choose **Authorize Google
   account**.
5. Complete consent in the system browser. Obsidian then synchronizes the
   account subscriptions and continues fetching recent videos through RSS.

The first authorization uses a localhost callback and therefore requires
Obsidian desktop. The dashboard and synchronized data remain usable on mobile.
Only the `youtube.readonly` scope is requested. The Client Secret and refresh
token are stored in Obsidian SecretStorage and are never written to the plugin's
`data.json`.

## Vault data

The default structure is:

```text
YouTube/
├── Channels.base
├── Channels/
│   └── UC….md
└── Videos/
    └── 2026-09-29 Video title.md
```

Channel filenames use the stable YouTube channel ID so a renamed channel does
not create a duplicate. The visible title lives in frontmatter.

On an existing channel note, the plugin updates only the properties it owns.
Anything written below the frontmatter is preserved. Stopping tracking marks
the note as `subscribed: false` instead of deleting it.

The `groups` and `enabled` properties can also be edited directly in the
generated Bases view or channel note. The plugin reads those changes back into
its dashboard state.

## Network and privacy

- Requests go directly from Obsidian to public YouTube channel pages and Atom
  feeds.
- Optional account sync connects directly to Google's OAuth and YouTube Data
  API endpoints. It uses read-only access and never posts, likes, or changes
  subscriptions.
- The OAuth Client ID is stored in plugin settings; the Client Secret and
  refresh token are stored separately in Obsidian SecretStorage.
- No analytics or third-party relay service is used.
- The plugin cannot refresh while Obsidian is closed.
- Public feeds expose only a recent window of uploads, so this MVP is designed
  for ongoing incremental tracking rather than complete channel history.

## Changelog

What changed in each version is in [CHANGELOG.md](CHANGELOG.md) ([中文](CHANGELOG.zh-CN.md)). Add the new version there before releasing: the release notes are taken from it, and the release fails when the entry is missing.

## License

MIT, see [LICENSE](https://github.com/JackWeiGogoga/gogoga-youtube/blob/main/LICENSE).
