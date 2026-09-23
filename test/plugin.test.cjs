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
  for (const file of ['ccf-data.js', 'ccf.js', 'bootstrap.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), scope);
  }
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

function venue(type, fields) {
  return Object.freeze({ itemType: type, getField: name => fields[name] || '' });
}

test('2026 catalog includes newly ranked and reclassified venues', () => {
  const { scope } = setup();
  const match = (type, fields, abbr = '') => scope.CCFMatcher.match(venue(type, fields), abbr);
  assert.equal(scope.CCF_DATA.entries.length, 681);
  for (const name of ['ICLR', 'ICLR 2026', '2026 The Fourteenth International Conference on Learning Representations', 'The Fourteenth International Conference on Learning Representations',
    'Proceedings of the 14th International Conference on Learning Representations (ICLR 2026)']) {
    assert.equal(match('conferencePaper', { proceedingsTitle: name }).entry?.rank, 'A', name);
  }
  for (const [abbr, rank] of [['IJCAI', 'B'], ['HPDC', 'A'], ['ICML', 'A'], ['AAAI', 'A'], ['NIPS', 'A']]) {
    assert.equal(match('conferencePaper', {}, abbr).entry?.rank, rank, abbr);
  }
  assert.equal(match('journalArticle', { publicationTitle: 'IEEE Transactions on Multimedia' }).entry?.rank, 'A');
  assert.equal(match('preprint', { proceedingsTitle: 'ICLR' }, 'ICLR').entry, null);
  assert.equal(match('journalArticle', { publicationTitle: 'ICLR' }).entry, null);
});

test('venue matcher rejects tracks, conflicts and substring guesses', () => {
  const { scope } = setup();
  for (const name of ['ICLR 2026 Workshop on Agents', 'ICLR Workshops', 'Findings of ACL', 'ICML Short Papers', 'CVPR Companion', 'AAAI Demo Papers']) {
    const result = scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: name }), 'ICLR');
    assert.equal(result.entry, null, name);
    assert.equal(result.excluded, true, name);
  }
  for (const name of ['ICLRA', 'Not ICLR', 'Unknown Conference']) {
    assert.equal(scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: name }), '').entry, null);
  }
  assert.equal(scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: 'ICLR', proceedingsTitle: 'ICML' }), '').entry, null);
  const listedWorkshop = scope.CCF_DATA.entries.find(e => e.type === 'conferencePaper' && /Workshop/.test(e.name));
  assert.ok(listedWorkshop);
  assert.equal(scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: listedWorkshop.name }), '').entry?.rank, listedWorkshop.rank);
});

test('Green Frog existing column overlay is reversible and respects ownership', () => {
  const { scope, view } = setup();
  const key = 'greenfrog\\@redleafnew\\.me-CCF';
  let columns = [{ dataKey: key, pluginID: 'greenfrog@redleafnew.me' }];
  const original = (item, field) => field === key ? 'Old rank' : 'Other column';
  const manager = scope.Zotero.ItemTreeManager = { getCustomCellData: original, getCustomColumns: () => columns };
  view.getSortFields = () => [key];
  scope.startup();
  const iclr = venue('conferencePaper', { proceedingsTitle: 'ICLR 2026' });
  const wrapper = manager.getCustomCellData;
  assert.equal(manager.getCustomCellData(iclr, key), 'A');
  assert.equal(manager.getCustomCellData(venue('conferencePaper', { conferenceName: 'IJCAI', extra: 'CCF: A' }), key), 'B');
  assert.equal(manager.getCustomCellData(venue('conferencePaper', { conferenceName: 'ICLR Workshops' }), key), '');
  assert.equal(manager.getCustomCellData(venue('conferencePaper', { conferenceName: 'Unknown' }), key), 'Old rank');
  assert.equal(manager.getCustomCellData(iclr, 'other-CCF'), 'Other column');
  assert.equal(view.sortCount, 1);
  columns = [];
  assert.equal(manager.getCustomCellData(iclr, key), 'Old rank');
  columns = [{ dataKey: key, pluginID: 'other-plugin' }];
  assert.equal(manager.getCustomCellData(iclr, key), 'Old rank');
  columns = [{ dataKey: key, pluginID: 'greenfrog@redleafnew.me' }];
  scope.shutdown({}, 4);
  assert.equal(manager.getCustomCellData, original);
  assert.equal(wrapper.call(manager, iclr, key), 'Old rank');
  scope.startup();
  const ours = manager.getCustomCellData;
  const later = function (...args) { return ours.apply(this, args); };
  manager.getCustomCellData = later;
  scope.shutdown({}, 4);
  assert.equal(manager.getCustomCellData, later);
  assert.equal(manager.getCustomCellData(iclr, key), 'Old rank');
  scope.startup();
  assert.equal(manager.getCustomCellData(iclr, key), 'A');
  // An old wrapper retained by a different plugin never reactivates.
  assert.equal(ours.call(manager, iclr, key), 'Old rank');
  scope.shutdown({}, 4);
});

test('every catalog full name resolves to its published rank', () => {
  const { scope } = setup();
  for (const entry of scope.CCF_DATA.entries) {
    const field = entry.type === 'conferencePaper' ? 'conferenceName' : 'publicationTitle';
    assert.equal(scope.CCFMatcher.match(venue(entry.type, { [field]: entry.name }), '').entry?.rank, entry.rank, entry.name);
  }
});

test('bootstrap loads packaged scripts using Zotero rootURI', () => {
  const { scope } = setup();
  vm.runInContext('CCFMatcher = undefined; CCF_DATA = undefined;', scope);
  const loaded = [];
  scope.Services = { scriptloader: { loadSubScript(url, target) {
    const file = url.replace('jar:test!/', '');
    loaded.push(file);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), scope);
  } } };
  scope.startup({ rootURI: 'jar:test!/' });
  assert.deepEqual(loaded, ['ccf-data.js', 'ccf.js']);
  assert.equal(scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: 'ICLR' }), '').entry?.rank, 'A');
  scope.shutdown({}, 4);
});

test('ambiguous and unknown supplied fields cannot be hidden by a recognized field', () => {
  const { scope } = setup();
  for (const fields of [
    { conferenceName: 'FSE', proceedingsTitle: 'Fast Software Encryption' },
    { conferenceName: 'Unknown', proceedingsTitle: 'ICLR' },
    { conferenceName: 'ICLR', proceedingsTitle: 'Unknown' },
  ]) assert.equal(scope.CCFMatcher.match(venue('conferencePaper', fields), '').entry, null);
  assert.equal(scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: 'ICLR' }), 'Unknown').entry, null);
});

test('published venue spellings and corrected line-wrapped abbreviation match independently', () => {
  const { scope } = setup();
  for (const name of [
    'ACM SIGPLAN International Conference on Functional Programming',
    'ACM/IEEE International Conference on Model-Driven Engineering Languages and Systems',
    'Pacific Conference on Computer Graphics and Applications'
  ]) assert.equal(scope.CCFMatcher.match(venue('conferencePaper', { conferenceName: name }), '').entry?.rank, 'B', name);
  assert.equal(scope.CCFMatcher.match(venue('journalArticle', { journalAbbreviation: 'JCOMPLEXITY' }), '').entry?.rank, 'C');
});
