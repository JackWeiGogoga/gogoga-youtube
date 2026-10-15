'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'obsidian') {
    class Stub {}
    return {
      ItemView: Stub,
      Modal: Stub,
      Notice: Stub,
      Platform: { isDesktopApp: true },
      Plugin: Stub,
      PluginSettingTab: Stub,
      Setting: Stub,
      TFile: Stub,
      normalizePath: (value) => value.replace(/\/+/g, '/').replace(/^\/|\/$/g, ''),
      requestUrl: async () => {
        throw new Error('network is not available in unit tests');
      },
      setIcon: () => {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const helpers = require('./main.js').__test;
Module._load = originalLoad;

test('parses Google Takeout subscription CSV', () => {
  const rows = helpers.parseImportText(
    [
      'Channel Id,Channel Url,Channel Title',
      'UCHnyfMqiRRG1u-2MsSQLbXA,https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA,Veritasium',
      'UC_x5XG1OV2P6uZZ5FSM9Ttw,https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw,"Google, for Developers"',
    ].join('\n')
  );
  assert.deepEqual(rows, [
    {
      input: 'https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA',
      title: 'Veritasium',
    },
    {
      input: 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
      title: 'Google, for Developers',
    },
  ]);
});

test('parses localized Chinese Google Takeout subscription CSV', () => {
  const rows = helpers.parseImportText(
    [
      '频道 ID,频道网址,频道标题',
      'UC4VK4LX8hbTjgdAipl0cHhw,http://www.youtube.com/channel/UC4VK4LX8hbTjgdAipl0cHhw,Letters Live',
    ].join('\n')
  );
  assert.deepEqual(rows, [
    {
      input: 'http://www.youtube.com/channel/UC4VK4LX8hbTjgdAipl0cHhw',
      title: 'Letters Live',
    },
  ]);
});

test('normalizes handles and recognizes channel ids', () => {
  assert.equal(
    helpers.normalizeChannelInput('@veritasium'),
    'https://www.youtube.com/@veritasium'
  );
  assert.equal(
    helpers.channelIdFromInput(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA'
    ),
    'UCHnyfMqiRRG1u-2MsSQLbXA'
  );
});

test('normalizes groups without duplicates', () => {
  assert.deepEqual(helpers.normalizeGroups('AI, 产品, AI, '), ['AI', '产品']);
});

test('sanitizes note filenames', () => {
  assert.equal(helpers.sanitizeFilename('A/B: C?  D'), 'A B C D');
});

test('extracts channel id from page metadata', () => {
  assert.equal(
    helpers.extractPageMetadata(
      '<html><head><link rel="canonical" href="https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA"></head></html>'
    ).id,
    'UCHnyfMqiRRG1u-2MsSQLbXA'
  );
});

test('normalizes an OAuth client id without treating it as a secret', () => {
  assert.equal(
    helpers.normalizeOAuthClientId('  123-example.apps.googleusercontent.com  '),
    '123-example.apps.googleusercontent.com'
  );
});

test('maps authorized subscription items and removes duplicate channels', () => {
  const channelId = 'UCHnyfMqiRRG1u-2MsSQLbXA';
  const entries = helpers.subscriptionItemsToEntries([
    {
      snippet: {
        title: 'Veritasium',
        resourceId: { channelId },
        thumbnails: {
          default: { url: 'https://example.com/small.jpg' },
          high: { url: 'https://example.com/high.jpg' },
        },
      },
    },
    {
      snippet: {
        title: 'Duplicate',
        resourceId: { channelId },
      },
    },
    {
      snippet: {
        title: 'Missing channel id',
        resourceId: {},
      },
    },
  ]);

  assert.deepEqual(entries, [
    {
      id: channelId,
      title: 'Veritasium',
      thumbnail: 'https://example.com/high.jpg',
    },
  ]);
});

test('English and Chinese UI string tables define the same keys', () => {
  const en = Object.keys(helpers.STRINGS.en).sort();
  const zh = Object.keys(helpers.STRINGS.zh).sort();
  assert.deepEqual(zh, en);
});

test('translates UI strings with interpolation and plurals per locale', () => {
  try {
    helpers.setLocale('en');
    assert.equal(helpers.t('command.open'), 'Open YouTube subscriptions');
    assert.equal(helpers.t('notice.added', { count: 1 }), 'Added 1 channel');
    assert.equal(helpers.t('notice.added', { count: 3 }), 'Added 3 channels');
    assert.equal(helpers.formatRelativeTime(''), 'Never');
    assert.equal(
      helpers.formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000).toISOString()),
      '5 minutes ago'
    );
    assert.equal(helpers.formatViews(1), '1 view');

    helpers.setLocale('zh');
    assert.equal(helpers.t('command.open'), '打开 YouTube 订阅');
    assert.equal(helpers.t('notice.added', { count: 3 }), '已添加 3 个频道');
    assert.equal(helpers.formatRelativeTime(''), '从未');
    assert.equal(
      helpers.formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000).toISOString()),
      '5分钟前'
    );
    assert.equal(helpers.formatViews(12000), '1.2万次观看');
  } finally {
    helpers.setLocale('en');
  }
});
