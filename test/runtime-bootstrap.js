function startup() {
  run().catch(async error => {
    await IOUtils.writeUTF8('/tmp/zotero-conference-plugin-test-20260923/result.json', JSON.stringify({ok:false,error:String(error),stack:error.stack},null,2));
  });
}
async function run() {
  if (Zotero.DataDirectory.dir !== '/tmp/zotero-conference-plugin-test-20260923/data'
      && Zotero.DataDirectory.dir !== '/private/tmp/zotero-conference-plugin-test-20260923/data') {
    throw new Error('Runtime test requires its isolated data directory');
  }
  await Zotero.uiReadyPromise;
  const window = Zotero.getMainWindow(), pane = window.ZoteroPane;
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  await wait(1000);
  const checks=[];
  function check(c,label) { if (!c) throw new Error(label); checks.push(label); }
  const {AddonManager} = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addon = await AddonManager.getAddonByID('conference-abbreviations@zihanwu.local');
  check(addon?.isActive,'Installed and enabled');
  const entries=[];
  for (const [type,title,abbr] of [['conferencePaper','Z: ICLR','ICLR'],['conferencePaper','Y: AAAI','AAAI'],['conferencePaper','X: CVPR','CVPR'],['conferencePaper','W: Workshop','ICML Workshop (MHF)'],['journalArticle','V: Journal','VLDB J.'],['preprint','U: Unpublished','']]) {
    const item=new Zotero.Item(type);item.setField('title',title);
    if(type==='journalArticle')item.setField('journalAbbreviation',abbr);
    else item.setField('extra','Container Title Short: '+(abbr||'Should not display'));
    await item.saveTx();entries.push({item,abbr,before:JSON.stringify(item.toJSON())});
  }
  await pane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
  await pane.itemsView.refreshAndMaintainSelection();
  const tree=pane.itemsView;
  const displayed = e => tree.getCellText(tree.getRowIndexByID(e.item.id),'journalAbbreviation');
  for(const e of entries)check(displayed(e)===e.abbr,'Native cell: '+e.item.getField('title'));
  const col=tree.getColumns().findIndex(x=>x.dataKey==='journalAbbreviation');
  check(col>=0,'Native column exists');
  const visibleColumnIndex=tree.tree._columns._columns.findIndex(x=>x.dataKey==='journalAbbreviation');
  if(tree.tree._columns._columns[visibleColumnIndex].hidden)tree.tree._columns.toggleHidden(visibleColumnIndex);
  await wait(200);
  await tree._handleColumnSort(col,1);
  tree.ensureRowsAreVisible([tree.getRowIndexByID(entries[1].item.id)]);
  await wait(200);
  check([...window.document.querySelectorAll('.cell.journalAbbreviation')].some(e=>e.textContent==='AAAI'),'Native column renders AAAI in an actual table cell');
  const order=entries.filter(x=>x.abbr).sort((a,b)=>tree.getRowIndexByID(a.item.id)-tree.getRowIndexByID(b.item.id)).map(x=>x.abbr);
  check(JSON.stringify(order)===JSON.stringify(['AAAI','CVPR','ICLR','ICML Workshop (MHF)','VLDB J.']),'Native sort order');
  for(const e of entries)check(JSON.stringify(e.item.toJSON())===e.before,'No writes: '+e.item.getField('title'));
  await addon.disable();await wait(200);
  check(displayed(entries[0])==='','Disable restores conference cell');
  check(displayed(entries[4])==='VLDB J.','Disable preserves journal cell');
  await addon.enable();await wait(200);check(displayed(entries[0])==='ICLR','Re-enable restores conference cell');
  entries[0].item.setField('extra','Container Title Short: NeurIPS');await entries[0].item.saveTx();await wait(200);
  check(displayed(entries[0])==='NeurIPS','Editing Extra updates native cell');
  await IOUtils.writeUTF8('/tmp/zotero-conference-plugin-test-20260923/result.json',JSON.stringify({ok:true,version:Zotero.version,checks,order},null,2));
}
function shutdown() {}
function install() {}
function uninstall() {}
function onMainWindowLoad() {}
function onMainWindowUnload() {}
