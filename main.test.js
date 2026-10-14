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
