会议论文的简称现在可以直接显示在 Zotero 原生「刊名简称 / Journal Abbr」列，并按简称排序。

- 优先读取 Extra 中的 `Container Title Short: ICLR`，兼容 `Journal Abbreviation`。
- 保留期刊原生简称；不修改条目、附件或数据库结构。
- 支持分类刷新、多窗口、冷启动，以及停用和重新启用。
- 支持通过本仓库 Release 更新，提供 SHA-256 校验。

已在官方 Zotero 10.0.4 和 8.0.4 隔离测试库验证。Zotero 10.0.4 的检查包括实际表格渲染、排序、Extra 更新、重启、多窗口和停用恢复，记录在仓库 `test/` 下。

安装：下载 `.xpi`，在 Zotero 中打开「工具 → 插件 → 齿轮 → 从文件安装插件」。
如使用过 `.invalid` 更新地址的本地试用包，请手动安装一次本 Release。
