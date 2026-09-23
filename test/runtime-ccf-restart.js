async function runCCFRestart({ isolatedDataDirectory, evidencePath } = {}) {
  const canonical = path => { const file = Zotero.File.pathToFile(path); file.normalize(); return file.path; };
  if (!isolatedDataDirectory || canonical(isolatedDataDirectory) !== canonical(Zotero.DataDirectory.dir)) {
    throw new Error('Pass the explicit isolatedDataDirectory of this test profile');
  }
  if (!evidencePath) throw new Error('Pass evidencePath from the preceding runtime test');
  const evidence = JSON.parse(await IOUtils.readUTF8(evidencePath));
  const items = evidence.itemKeys.map(key => Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, key));
  const ranks = evidence.expectedRanks;
  const checks = [], window = Zotero.getMainWindow();
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const check = (ok, text) => { if (!ok) throw new Error(text); checks.push(text); };
  const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addon = await AddonManager.getAddonByID('conference-abbreviations@zihanwu.local');
  check(addon.isActive && addon.version === '1.1.0', 'Cold start activates 1.1.0');
  const key = Zotero.ItemTreeManager.getCustomColumns().find(c => c.pluginID === 'greenfrog@redleafnew.me' && c.dataKey.endsWith('-CCF')).dataKey;
  async function validate(w, label) {
    await w.ZoteroPane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
    await w.ZoteroPane.itemsView.refreshAndMaintainSelection();
    const tree = w.ZoteroPane.itemsView;
    for (let i = 0; i < items.length; i++) check(tree.getCellText(tree.getRowIndexByID(items[i].id), key) === ranks[i], `${label}: CCF case ${i}`);
    check(tree.getCellText(tree.getRowIndexByID(items[1].id), 'journalAbbreviation') === 'ICLR', `${label}: native abbreviation`);
  }
  await validate(window, 'Cold start');
  Zotero.openMainWindow(); await wait(1500);
  const other = Zotero.getMainWindows().find(w => w !== window);
  check(!!other, 'Second main window opened');
  try { await validate(other, 'Second window'); }
  finally { other.close(); }
  await wait(300);
  await validate(window, 'First window after closing second');
  return { ok: true, zoteroVersion: Zotero.version, pluginVersion: addon.version, checks };
}
