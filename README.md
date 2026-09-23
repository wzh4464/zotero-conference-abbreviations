# Conference Abbreviations / 会议简称

在 Zotero 原生「刊名简称 / Journal Abbr」列显示会议简称，并按简称排序。

## 安装与使用

1. 从 [最新 Release](https://github.com/wzh4464/zotero-conference-abbreviations/releases/latest) 下载 `.xpi`，在存放文献库的那台 Zotero 中打开「工具 → 插件」（Tools → Plugins）。
2. 点击齿轮菜单，选择「从文件安装插件」，选中 `conference-abbreviations-1.1.0.xpi`。
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

## 新版 CCF 与绿青蛙（1.1.0）

已安装绿青蛙时，本插件直接补充它现有的 **CCF** 列。请在绿青蛙设置中开启
CCF 列，并在表格列标题菜单勾选 CCF。无需 easyScholar 密钥或在线查询。
不会新建另一列，也不会把计算结果写回 Extra；停用本插件恢复绿青蛙原来的值。

内置 CCF 第七版（2026）正式目录的 681 条会议与期刊记录。
例如 ICLR → A、IJCAI → B、HPDC → A、IEEE Transactions on Multimedia → A。
识别会议名称、论文集标题、Extra 中的会议简称，以及期刊名称和原生简称。
ICLR、ICLR 2026、The Fourteenth International Conference on Learning Representations
均可匹配，不要求重新整理条目。原生「刊名简称」列仍显示 Extra 填写的原文。

名称只做大小写、标点、年份和届次等规范化，不做任意子串猜测。
Workshop、Findings、Short/Demo 等元数据标记会阻止继承主会等级；
目录中独立列出的 Workshop 则按自身条目匹配。元数据未标明论文类型时，
插件无法判定其是否符合 CCF 对 full/regular paper 的要求。
无法识别或名称冲突时保留绿青蛙原值，因此旧的手填等级仍可能存在。
等级按 **2026 版目录** 展示，不按论文发表年份回溯历史等级。
完整出处、正式 PDF 校验值及匹配限制见 [CCF-SOURCES.md](CCF-SOURCES.md)。

## 兼容性与开发

目标版本：Zotero 8–10。`getExtraField` 和 CCF 单元格包装涉及内部接口；升级 Zotero 或绿青蛙后需重新核验。
1.1.0 的 CCF 集成使用官方 Zotero 10.0.4 与绿青蛙 0.22.2 的真实 XPI 实测。
下述 Zotero 8.0.4 记录来自 1.0.0 的会议简称功能测试。
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

代码使用 MIT；CCF 目录数据版权归中国计算机学会，见 [CCF-SOURCES.md](CCF-SOURCES.md)。
