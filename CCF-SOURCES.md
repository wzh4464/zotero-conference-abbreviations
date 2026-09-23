# CCF 2026 catalog provenance

This package contains factual venue names, abbreviations, categories and ranks
from the seventh edition of 中国计算机学会推荐国际学术会议和期刊目录.
The catalog is published by 中国计算机学会 (CCF); its copyright remains with CCF.
The plugin's MIT license does not relicense the source catalog.

- Official announcement and authoritative download: https://www.ccf.org.cn/Academic_Evaluation/By_category/
- Published 2026-03-31; the announcement notes an erratum update on 2026-04-09.
- Formal PDF mirror used for verification (the official site requires access verification): https://github.com/LovenSar/CCF_RANK/blob/55ca5eae67c26d518c6a8b71ee5827a053086f20/第七版中国计算机学会推荐国际学术会议和期刊目录（正式版）-CCF-ABC.pdf
- Structured transcription: https://github.com/haozhou-wong/ccf-recommended-list-2026-markdown/blob/dcf1a02335fb44dcaf785997d5c535ab41628a16/data/ccf-2026.json
- The packaged catalog contains 681 records across 10 subject categories.

This is the current 2026 venue classification, not a historical classification
by paper publication year, and not proof that a paper is a full/regular paper.
CCF excludes companion workshops, Findings, short/demo papers and technical
briefs. The matcher rejects these labels when present in venue metadata; it
cannot detect paper types absent from metadata. An independently listed
conference whose official name contains “Workshop” can still match its own rank.

Names are matched exactly after case, punctuation, year, ordinal and proceedings
prefix normalization. A small explicit alias list handles common CVPR, NeurIPS
and ICLR naming variants. Conflicting recognized venues and ambiguous names are
left to Green Frog's original provider. Every supplied venue or abbreviation
must be recognized and unambiguous; an unknown value also causes fallback. Unrecognized entries retain its existing
value; that fallback is not a claim that this plugin verified the entry.

PDF SHA-256: `271b630b576bf8a4f802e767f5694caded93680e22b3a19bef7902591c45c1d3`.

The formal PDF was re-extracted locally using the transcription project’s table
extractor; all 681 records matched its JSON, including venue names and ranks.

## Transcription corrections

Ranks and catalog membership are unchanged. The packaged spelling corrects four
source/PDF extraction defects (conference source spellings also remain aliases):

- ICFP: Function → Functional Programming ([conference](https://icfp26.sigplan.org/)).
- MoDELS: EngineeringLanguages → Engineering Languages ([conference](https://conf.researchr.org/home/models-2026)).
- PG: onComputer → on Computer ([DBLP proceedings](https://dblp.org/db/conf/pg/)).
- Journal of Complexity: the PDF abbreviation wraps JCOMPLEXI + TY; join it to JCOMPLEXITY.

Independent unit assertions cover these corrected names rather than deriving
all test inputs from the packaged catalog.
