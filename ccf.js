/* Exact venue matching against the packaged CCF catalog. No network or writes. */
var CCFMatcher = {
  indexes: null,
  normalize(value) {
    return String(value || '').normalize('NFKC').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  },
  clean(value) {
    return this.normalize(value)
      .replace(/\b(?:19|20)\d{2}\b/g, '')
      .replace(/\b\d+(?:st|nd|rd|th)\b/g, '')
      .replace(/\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\b/g, '')
      .replace(/^(?:proceedings of (?:the )?|the )/, '')
      .trim().replace(/\s+/g, ' ');
  },
  init() {
    this.indexes = { conferencePaper: new Map(), journalArticle: new Map() };
    const add = (map, name, entry) => {
      const key = this.clean(name);
      if (!key) return;
      if (!map.has(key)) map.set(key, entry);
      // Never choose between different venues sharing an abbreviation.
      else if (map.get(key)?.name !== entry.name || map.get(key)?.rank !== entry.rank) map.set(key, null);
    };
    for (const entry of CCF_DATA.entries) {
      const map = this.indexes[entry.type];
      add(map, entry.name, entry);
      if (entry.abbr) {
        add(map, entry.abbr, entry);
        add(map, `${entry.name} ${entry.abbr}`, entry);
        add(map, `${entry.abbr} ${entry.name}`, entry);
      }
    }
    const aliases = {
      'NIPS': 'NeurIPS',
      'Advances in Neural Information Processing Systems': 'NeurIPS',
      'International Conference on Learning Representation': 'ICLR',
      'IEEE Conference on Computer Vision and Pattern Recognition': 'CVPR',
      'IEEE/CVF Conference on Computer Vision and Pattern Recognition': 'CVPR'
    };
    for (const [alias, target] of Object.entries(aliases)) {
      const entry = this.indexes.conferencePaper.get(this.clean(target));
      if (entry) add(this.indexes.conferencePaper, alias, entry);
    }
  },
  match(item, abbreviation) {
    if (!this.indexes) this.init();
    const index = this.indexes[item?.itemType];
    if (!index) return { entry: null, excluded: false };
    const venues = item.itemType === 'conferencePaper'
      ? [item.getField('conferenceName'), item.getField('proceedingsTitle')]
      : [item.getField('publicationTitle')];
    const short = item.itemType === 'conferencePaper' ? abbreviation : item.getField('journalAbbreviation');
    const values = [...venues, short].filter(Boolean);
    // Listed conferences whose official name contains Workshop remain eligible.
    // A companion workshop/Findings/short-paper label must never inherit a main rank.
    for (const value of values) {
      const key = this.clean(value);
      if (/\b(?:findings|short papers?|demo(?:nstration)?s?|technical briefs?|summar(?:y|ies)|companion)\b/.test(key)
          || (/\bworkshops?\b/.test(key) && !index.get(key))) {
        return { entry: null, excluded: true };
      }
    }
    const matches = values.map(value => index.get(this.clean(value))).filter(Boolean);
    if (!matches.length || matches.some(entry => entry !== matches[0])) return { entry: null, excluded: false };
    return { entry: matches[0], excluded: false };
  }
};
