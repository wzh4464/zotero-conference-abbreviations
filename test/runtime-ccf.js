// Run via loadSubScriptWithOptions({target:{Zotero,IOUtils,ChromeUtils},ignoreCache:true}).
// Explicitly isolated from a user's library; requires Green Frog 0.22.2 installed.
async function runCCF({ isolatedDataDirectory } = {}) {
  const canonical = path => { const file = Zotero.File.pathToFile(path); file.normalize(); return file.path; };
  if (!isolatedDataDirectory || canonical(isolatedDataDirectory) !== canonical(Zotero.DataDirectory.dir)) {
    throw new Error('Pass the explicit isolatedDataDirectory of this test profile');
  }
  const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addon = await AddonManager.getAddonByID('conference-abbreviations@zihanwu.local');
  const frog = await AddonManager.getAddonByID('greenfrog@redleafnew.me');
  const window = Zotero.getMainWindow(), pane = window.ZoteroPane;
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  check(Zotero.version === '10.0.4', 'Official Zotero 10.0.4');
  check(addon?.isActive && addon.version === '1.1.0', 'XPI 1.1.0 active');
  check(frog?.isActive && frog.version === '0.22.2', 'Real Green Frog 0.22.2 active');
  const columns = () => Zotero.ItemTreeManager.getCustomColumns().filter(c => c.pluginID === frog.id && c.dataKey.endsWith('-CCF'));
  check(columns().length === 1, 'Uses one existing Green Frog CCF column');
  const key = columns()[0].dataKey;
  const cases = [
    ['conferencePaper', { proceedingsTitle: 'The Fourteenth International Conference on Learning Representations' }, 'A'],
    ['conferencePaper', { conferenceName: 'ICLR 2026', extra: 'Container Title Short: ICLR' }, 'A'],
    ['conferencePaper', { extra: 'Container Title Short: ICLR' }, 'A'],
    ['conferencePaper', { conferenceName: 'IJCAI', extra: 'CCF: A' }, 'B'],
    ['conferencePaper', { proceedingsTitle: 'ICLR Workshop on Agents', extra: 'CCF: A\nContainer Title Short: ICLR' }, ''],
    ['conferencePaper', { conferenceName: 'Findings of ACL', extra: 'CCF: A' }, ''],
    ['journalArticle', { publicationTitle: 'IEEE Transactions on Multimedia', extra: 'CCF: B' }, 'A'],
    ['conferencePaper', { conferenceName: 'AISTATS' }, 'C'],
    ['conferencePaper', { conferenceName: 'Unknown conference', extra: 'CCF: Custom' }, 'Custom'],
    ['preprint', { extra: 'Container Title Short: ICLR' }, ''],
    ['conferencePaper', { conferenceName: 'FSE', proceedingsTitle: 'Fast Software Encryption', extra: 'CCF: Original' }, 'Original'],
    ['conferencePaper', { conferenceName: 'Unknown', proceedingsTitle: 'ICLR', extra: 'CCF: Original' }, 'Original'],
    ['conferencePaper', { conferenceName: 'ACM SIGPLAN International Conference on Functional Programming' }, 'B'],
    ['conferencePaper', { conferenceName: 'ACM/IEEE International Conference on Model-Driven Engineering Languages and Systems' }, 'B'],
    ['conferencePaper', { conferenceName: 'Pacific Conference on Computer Graphics and Applications' }, 'B'],
    ['journalArticle', { journalAbbreviation: 'JCOMPLEXITY' }, 'C'],
  ];
  const entries = [];
  for (const [type, fields, rank] of cases) {
    const item = new Zotero.Item(type);
    item.setField('title', 'CCF runtime ' + entries.length);
    for (const [field, value] of Object.entries(fields)) item.setField(field, value);
    await item.saveTx();
    entries.push({ item, rank, before: JSON.stringify(item.toJSON()) });
  }
  await pane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
  await pane.itemsView.refreshAndMaintainSelection();
  const cell = e => pane.itemsView.getCellText(pane.itemsView.getRowIndexByID(e.item.id), key);
  for (const [i, e] of entries.entries()) check(cell(e) === e.rank, `Green Frog native cell ${i}: ${e.rank || '(empty)'}`);
  const tree = pane.itemsView;
  const column = tree.tree._columns._columns.findIndex(c => c.dataKey === key);
  if (tree.tree._columns._columns[column].hidden) tree.tree._columns.toggleHidden(column);
  await tree._handleColumnSort(tree.getColumns().findIndex(c => c.dataKey === key), 1);
  tree.ensureRowsAreVisible([tree.getRowIndexByID(entries[0].item.id)]);
  await wait(250);
  check([...window.document.querySelectorAll('.cell')].some(e => e.textContent === 'A' && e.className.includes('-CCF')), 'CCF A rendered in actual table DOM');
  check(tree.getRowIndexByID(entries[0].item.id) < tree.getRowIndexByID(entries[3].item.id)
    && tree.getRowIndexByID(entries[3].item.id) < tree.getRowIndexByID(entries[7].item.id), 'Existing CCF column sorts A before B before C');
  for (const [i, e] of entries.entries()) check(JSON.stringify(e.item.toJSON()) === e.before, `No metadata writes ${i}`);
  await addon.disable(); await wait(200);
  check(cell(entries[0]) === '', 'Disable restores missing Green Frog value');
  check(cell(entries[3]) === 'A', 'Disable restores original Extra rank');
  check(cell(entries[4]) === 'A', 'Disable restores original workshop value');
  await addon.enable(); await wait(200);
  check(cell(entries[0]) === 'A' && cell(entries[3]) === 'B', 'Re-enable restores current ranks');
  entries[0].item.setField('proceedingsTitle', 'IJCAI'); await entries[0].item.saveTx(); await wait(200);
  check(cell(entries[0]) === 'B', 'Editing venue updates existing CCF cell');
  await frog.disable(); await wait(200);
  check(columns().length === 0, 'No duplicate CCF column while Green Frog disabled');
  await frog.enable(); await wait(1000);
  await pane.itemsView.refreshAndMaintainSelection();
  check(columns().length === 1 && cell(entries[1]) === 'A', 'Green Frog re-enable recreates its column with current ranks');
  return { ok: true, pluginVersion: addon.version, zoteroVersion: Zotero.version, greenFrogVersion: frog.version, checks, expectedRanks: entries.map((e, i) => i === 0 ? 'B' : e.rank), itemKeys: entries.map(e => e.item.key) };
}
