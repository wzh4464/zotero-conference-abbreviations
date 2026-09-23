# Conference Abbreviations / 会议简称

在 Zotero 原生「刊名简称 / Journal Abbr」列显示会议简称，并按简称排序。

## 安装与使用

1. 从 [最新 Release](https://github.com/wzh4464/zotero-conference-abbreviations/releases/latest) 下载 `.xpi`，在存放文献库的那台 Zotero 中打开「工具 → 插件」（Tools → Plugins）。
2. 点击齿轮菜单，选择「从文件安装插件」，选中 `conference-abbreviations-1.0.0.xpi`。
3. 右键点击文献表格列标题，勾选「刊名简称」。已经显示该列时无需再添加。

会议论文的 Extra 中填写一行，例如：

```text
Container Title Short: ICLR
```

支持 `AAAI`、`CVPR`、`ICLR`、`NeurIPS`、`ICML` 等任意已确认的简称，以及
`ICML Workshop (MHF)` 这样的 workshop 标注。插件显示填写的原文，不猜测录用会议。
也兼容旧的 `Journal Abbreviation: ...`，优先使用 `Container Title Short`。
推荐将 `Container Title Short` 放在 Extra 第一行，以便 CSL 引用处理。

期刊论文继续使用原生字段。插件不更改任何条目、附件、引用数据或数据库结构，
也不覆盖 `Item.getField()`。它仅连接主窗口表格的显示与排序回调。
停用或卸载后会议简称会从表格中消失，Extra 的原文保留。
其他设备需要单独安装插件；Extra 本身随 Zotero 条目同步。
通过 GitHub Release 的 `updates.json` 检查更新，更新文件带有 SHA-256 校验。
如之前安装过使用 `.invalid` 更新地址的本地试用包，需要先手动安装一次本 Release。

## 兼容性与开发

目标版本：Zotero 8–10。`getExtraField` 是内部接口；升级 Zotero 后需重新核验。
已在官方 Zotero 10.0.4 与 Zotero 8.0.4 隔离文献库实测 XPI 安装、
原生单元格、列排序、刷新、Extra 修改、停用与重新启用。
Zotero 10.0.4 还检查了原生表格实际渲染、冷启动、分类刷新，以及多窗口打开和关闭。
显示和排序共用同一回调，支持多个主窗口、条目修改、重新创建表格以及热停用。
插件保留已有回调，后安装插件包装它时也能安全停用。

构建：`python3 build.py`。单元检查：`node --test test/plugin.test.cjs`。
`test/runtime-bootstrap.js` 是仅供隔离库使用的运行时测试，不打包进插件。
测试记录保存在 `test/runtime-result-zotero-10.0.4.json` 等文件。

遵循 Zotero 的 [bootstrapped 插件格式](https://www.zotero.org/support/dev/zotero_7_for_developers)。

## 发布

运行测试并执行 `python3 build.py`，会生成 XPI、`updates.json` 和 `SHA256SUMS`。
推送与清单版本对应的 `v*` 标签后，GitHub Actions 会重新检查、构建并发布这些文件。
每次更改表格接口或提升 Zotero 支持范围时，都应重新执行桌面端回归测试。

## License

MIT
