# Runtime checks

Unit tests run with `node --test test/plugin.test.cjs`. Desktop CCF tests use the
actual Zotero 10.0.4 and Green Frog 0.22.2 XPI. They create synthetic records and
change plugin enablement, so run them only in a fresh, unsigned-in test profile.

1. Create separate empty profile and data directories. In the profile's `user.js`,
   set `extensions.zotero.useDataDir` to `true`, `extensions.zotero.dataDir` to the
   absolute test data path, and `extensions.zotero.sync.autoSync` to `false`.
   Start the chosen Zotero executable with `-no-remote -profile /absolute/test/profile`.
2. Install Green Frog 0.22.2 and this project's built XPI in that profile. Enable
   Green Frog's CCF preference. Do not sign in to a Zotero account.
3. In the test profile's privileged JavaScript context (e.g. Tools → Developer →
   Run JavaScript, async mode), set the three paths below to your own paths and run:

```js
const root = 'file:///absolute/path/to/zotero-conference-abbreviations/';
const isolatedDataDirectory = '/absolute/test/data';
const evidencePath = '/absolute/test/ccf-runtime.json';
const scope = { Zotero, IOUtils, ChromeUtils };
Services.scriptloader.loadSubScriptWithOptions(root + 'test/runtime-ccf.js', {
  target: scope, ignoreCache: true
});
const result = await scope.runCCF({ isolatedDataDirectory });
await IOUtils.writeUTF8(evidencePath, JSON.stringify(result, null, 2));
return result;
```

4. Quit that Zotero process completely and launch the same isolated profile again.
   In its privileged JavaScript context, use the same three path values, load
   `test/runtime-ccf-restart.js` into `scope`, then run:

```js
const result = await scope.runCCFRestart({ isolatedDataDirectory, evidencePath });
return result;
```

Both functions reject missing/mismatched data paths. The restart test consumes
the keys and expected ranks from your own preceding run, rather than assuming
that the example keys committed to this repository exist in your test library.
The restart check opens and closes a second main window. Successful results have
`ok: true`; a thrown assertion means the check failed.

The older `runtime-bootstrap.js` is the historical, fixed-directory v1.0 native
abbreviation harness. Its committed results distinguish that baseline from the
v1.1 CCF runtime and restart evidence.
