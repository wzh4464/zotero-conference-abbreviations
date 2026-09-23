/* Display-only integration. Never alter Item.getField or write library data. */
var ConferenceAbbreviations = {
  active: false,
  windows: new Map(),
  ccfHook: null,

  attachCCF() {
    const manager = Zotero.ItemTreeManager;
    if (!manager?.getCustomCellData || typeof CCFMatcher === "undefined" || this.ccfHook) return;
    const previous = manager.getCustomCellData;
    const record = { active: true, previous };
    const owner = this;
    record.wrapper = function (item, dataKey, ...args) {
      // Zotero escapes punctuation in registered data keys. Check ownership too.
      if (record.active && String(dataKey).replace(/\\/g, '') === 'greenfrog@redleafnew.me-CCF'
          && this.getCustomColumns().some(c => c.dataKey === dataKey && c.pluginID === 'greenfrog@redleafnew.me')) {
        const result = CCFMatcher.match(item, owner.parseExtra(item.getField('extra')));
        if (result.excluded) return '';
        if (result.entry) return result.entry.rank;
      }
      return previous.call(this, item, dataKey, ...args);
    };
    this.ccfHook = record;
    manager.getCustomCellData = record.wrapper;
  },

  detachCCF() {
    const record = this.ccfHook;
    if (!record) return;
    record.active = false;
    if (Zotero.ItemTreeManager.getCustomCellData === record.wrapper) {
      Zotero.ItemTreeManager.getCustomCellData = record.previous;
    }
    this.ccfHook = null;
  },

  parseExtra(extra) {
    const fields = new Map();
    for (const line of String(extra || "").split(/\r?\n/)) {
      const match = line.match(/^\s*([^:]+):\s*(.*?)\s*$/);
      if (!match || !match[2]) continue;
      const key = match[1].toLowerCase().replace(/[\s_-]/g, "");
      if (!fields.has(key)) fields.set(key, match[2]);
    }
    return fields.get("containertitleshort")
      || fields.get("journalabbreviation") || "";
  },

  getValue(item, field) {
    if (field !== "journalAbbreviation" || item?.itemType !== "conferencePaper") {
      return undefined;
    }
    // Preserve native values if a future schema adds conference support.
    if (item.getField(field)) return undefined;
    return this.parseExtra(item.getField("extra")) || undefined;
  },

  redraw(tree) {
    // Zotero 10 exposes the cache invalidator; Zotero 8 uses _rowCache directly.
    if (typeof tree.invalidateRowCache === "function") tree.invalidateRowCache(true);
    else tree._rowCache = {};
    // Window hooks can fire before the table has mounted or built its columns.
    // Initial rendering will use the callback without an explicit redraw.
    if (!tree.tree) return;
    tree.tree.invalidate();
    if (typeof tree._getColumns === "function") {
      const columns = tree._getColumns();
      if (!columns.length || (!tree._sortedColumn && !columns.some(c => !c.hidden))) return;
    }
    // Re-sort immediately when enabled/disabled with this column already sorted.
    if (tree.getSortFields?.().some(key => key === "journalAbbreviation"
        || String(key).replace(/\\/g, '') === 'greenfrog@redleafnew.me-CCF')) {
      Promise.resolve(tree.sort()).then(() => tree.tree?.invalidate()).catch(Zotero.logError);
    }
  },

  attachTree(record, tree) {
    if (!tree?.props || record.trees.has(tree)) return;
    const owner = this;
    const previous = tree.props.getExtraField;
    function getExtraField(...args) {
      const value = previous?.apply(this, args);
      if (value !== undefined || !owner.active || !record.active) return value;
      return owner.getValue(...args);
    }
    // Keep the original props object: React reuses it on subsequent renders.
    // Replacing tree.props makes the hook disappear after a collection refresh.
    if (Object.isFrozen(tree.props)) {
      Zotero.logError(new Error("Conference Abbreviations: unsupported frozen item-tree props"));
      return;
    }
    tree.props.getExtraField = getExtraField;
    record.trees.set(tree, { previous, getExtraField });
    this.redraw(tree);
  },

  attachWindow(window) {
    if (!this.active || this.windows.has(window)) return;
    const owner = this;
    const record = { active: true, trees: new Map(), timer: null, attempts: 0 };
    this.windows.set(window, record);
    const attach = () => {
      record.timer = null;
      if (!this.active || !record.active || window.closed) return;
      const pane = window.ZoteroPane;
      if (pane?.initItemsTree && !record.pane) {
        record.pane = pane;
        record.originalInit = pane.initItemsTree;
        record.wrappedInit = async function (...args) {
          const result = await record.originalInit.apply(this, args);
          if (owner.active && record.active) owner.attachTree(record, pane.itemsView);
          return result;
        };
        pane.initItemsTree = record.wrappedInit;
      }
      if (pane?.itemsView) this.attachTree(record, pane.itemsView);
      // Initial tree creation can already be in flight at the window-load hook.
      else if (++record.attempts < 300) record.timer = window.setTimeout(attach, 100);
      else Zotero.logError(new Error("Conference Abbreviations: item tree did not initialize"));
    };
    attach();
  },

  detachWindow(window, redraw = true) {
    const record = this.windows.get(window);
    if (!record) return;
    record.active = false;
    if (record.timer !== null) window.clearTimeout(record.timer);
    if (record.pane?.initItemsTree === record.wrappedInit) {
      record.pane.initItemsTree = record.originalInit;
    }
    for (const [tree, entry] of record.trees) {
      if (tree.props.getExtraField === entry.getExtraField) {
        tree.props.getExtraField = entry.previous;
      }
      // A later plugin may wrap our callback. Its wrapper remains intact and
      // our callback becomes a passthrough after record.active turns false.
      if (redraw && !window.closed) this.redraw(tree);
    }
    record.trees.clear();
    this.windows.delete(window);
  }
};

function startup(data) {
  if (typeof CCFMatcher === "undefined") {
    try {
      for (const file of ['ccf-data.js', 'ccf.js']) {
        Services.scriptloader.loadSubScript(data.rootURI + file, globalThis);
      }
      CCFMatcher.init();
    } catch (error) { Zotero.logError(error); }
  }
  ConferenceAbbreviations.attachCCF();
  ConferenceAbbreviations.active = true;
  for (const window of Zotero.getMainWindows()) ConferenceAbbreviations.attachWindow(window);
}

function shutdown(data, reason) {
  ConferenceAbbreviations.active = false;
  ConferenceAbbreviations.detachCCF();
  for (const window of ConferenceAbbreviations.windows.keys()) {
    ConferenceAbbreviations.detachWindow(window, reason !== APP_SHUTDOWN);
  }
}

function onMainWindowLoad({ window }) {
  ConferenceAbbreviations.attachWindow(window);
}

function onMainWindowUnload({ window }) {
  ConferenceAbbreviations.detachWindow(window, false);
}

function install() {}
function uninstall() {}
