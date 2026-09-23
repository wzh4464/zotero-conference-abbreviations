const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const errors = [];
  const windows = [];
  const scope = vm.createContext({
    Zotero: { getMainWindows: () => windows, logError: e => errors.push(e) },
    APP_SHUTDOWN: 2
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../bootstrap.js'), 'utf8'), scope);
  function tree(previous = () => undefined) {
    return {
      props: { getExtraField: previous, other: 42 },
      _rowCache: { stale: true },
      tree: { invalidate() {} },
      getSortFields: () => ['journalAbbreviation'],
      sortCount: 0,
      sort() { this.sortCount++; }
    };
  }
  const view = tree();
  const window = {
    closed: false, setTimeout, clearTimeout,
    ZoteroPane: { itemsView: view, async initItemsTree() { this.itemsView = tree(); } }
  };
  windows.push(window);
  return { scope, view, window, tree, errors };
}

function item(type, extra, native = '') {
  return Object.freeze({
    itemType: type,
    getField: field => field === 'extra' ? extra : field === 'journalAbbreviation' ? native : ''
  });
}

test('conference values, CSL aliases, legacy fallback, and native journal isolation', () => {
  const { scope } = setup();
  const get = (type, extra, native) => scope.ConferenceAbbreviations.getValue(item(type, extra, native), 'journalAbbreviation');
  assert.equal(get('conferencePaper', 'Other: Keep me\nContainer Title Short: ICML Workshop (MHF)'), 'ICML Workshop (MHF)');
  assert.equal(get('conferencePaper', 'container-title-short: NeurIPS\r\nJournal Abbreviation: old'), 'NeurIPS');
  assert.equal(get('conferencePaper', 'Journal Abbreviation: AAAI'), 'AAAI');
  assert.equal(get('conferencePaper', 'Container Title Short: \nJournal Abbreviation: CVPR'), 'CVPR');
  assert.equal(get('conferencePaper', 'Previous abbreviation: arXiv'), undefined);
  assert.equal(get('conferencePaper', 'Container Title Short: ICLR', 'Native'), undefined);
  assert.equal(get('journalArticle', 'Container Title Short: ICLR', 'VLDB J.'), undefined);
  assert.equal(get('preprint', 'Container Title Short: ICLR'), undefined);
});

test('shared display/sort callback survives React props reuse and reversible lifecycle', async () => {
  const { scope, view, window } = setup();
  const original = view.props.getExtraField;
  const reactProps = view.props;
  const init = window.ZoteroPane.initItemsTree;
  scope.startup();
  const callback = view.props.getExtraField;
  assert.equal(view.props, reactProps);
  view.props = reactProps; // React restores its props reference on refresh
  assert.equal(view.props.getExtraField, callback);
  assert.equal(callback(item('conferencePaper', 'Container Title Short: ICLR'), 'journalAbbreviation'), 'ICLR');
  assert.equal(callback(item('conferencePaper', 'Container Title Short: AAAI'), 'journalAbbreviation'), 'AAAI');
  assert.equal(callback(item('conferencePaper', 'Container Title Short: AAAI'), 'title'), undefined);
  assert.equal(view.props.other, 42);
  assert.deepEqual(Object.keys(view._rowCache), []);
  assert.equal(view.sortCount, 1);
  scope.onMainWindowLoad({ window });
  assert.equal(view.props.getExtraField, callback); // No duplicate wrappers
  await window.ZoteroPane.initItemsTree();
  assert.equal(window.ZoteroPane.itemsView.props.getExtraField(item('conferencePaper', 'Container Title Short: CVPR'), 'journalAbbreviation'), 'CVPR');
  scope.shutdown({}, 4);
  assert.equal(view.props.getExtraField, original);
  assert.equal(window.ZoteroPane.initItemsTree, init);
  assert.equal(callback(item('conferencePaper', 'Container Title Short: ICLR'), 'journalAbbreviation'), undefined);
  assert.equal(scope.ConferenceAbbreviations.windows.size, 0);
  scope.startup();
  assert.equal(window.ZoteroPane.itemsView.props.getExtraField(item('conferencePaper', 'Container Title Short: ICML'), 'journalAbbreviation'), 'ICML');
  scope.shutdown({}, 4);
});

test('coexists with callbacks installed before and after this plugin', () => {
  const { scope, view } = setup();
  view.props = { getExtraField: (i, f) => f === 'title' ? 'Other plugin title' : undefined };
  scope.startup();
  const ours = view.props.getExtraField;
  const later = function (...args) { return ours.apply(this, args); };
  view.props = { ...view.props, getExtraField: later };
  assert.equal(later(item('conferencePaper', 'Container Title Short: ICLR'), 'title'), 'Other plugin title');
  scope.shutdown({}, 4);
  assert.equal(view.props.getExtraField, later);
  assert.equal(later(item('conferencePaper', 'Container Title Short: ICLR'), 'journalAbbreviation'), undefined);
  assert.equal(later(item('conferencePaper', ''), 'title'), 'Other plugin title');
});

test('closing an uninitialized window cancels retries and releases references', () => {
  const { scope, window } = setup();
  window.ZoteroPane.itemsView = false;
  scope.startup();
  assert.notEqual(scope.ConferenceAbbreviations.windows.get(window).timer, null);
  scope.onMainWindowUnload({ window });
  assert.equal(scope.ConferenceAbbreviations.windows.size, 0);
  scope.shutdown({}, 4);
});

test('startup does not sort before the table and its columns are ready', () => {
  const { scope, view } = setup();
  view._getColumns = () => [];
  view.getSortFields = () => { throw new Error('Columns not mounted'); };
  scope.startup();
  assert.equal(view.sortCount, 0);
  assert.equal(view.props.getExtraField(item('conferencePaper', 'Container Title Short: ICLR'), 'journalAbbreviation'), 'ICLR');
  scope.shutdown({}, 4);
  view.tree = null;
  scope.startup();
  scope.shutdown({}, 4);
});
