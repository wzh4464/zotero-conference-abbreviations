"""Build a reproducible XPI and Zotero update manifest. No dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent
manifest = json.loads((root / "manifest.json").read_text())
version = manifest["version"]
application = manifest["applications"]["zotero"]
repo_url = manifest["homepage_url"].rstrip("/")
assert application["update_url"] == repo_url + "/releases/latest/download/updates.json"
dist = root / "dist"
dist.mkdir(exist_ok=True)
xpi = dist / f"conference-abbreviations-{version}.xpi"
with ZipFile(xpi, "w", ZIP_DEFLATED) as archive:
    for name in ["manifest.json", "bootstrap.js", "README.md", "LICENSE"]:
        info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (root / name).read_bytes())

digest = hashlib.sha256(xpi.read_bytes()).hexdigest()
update = {
    "version": version,
    "update_link": f"{repo_url}/releases/download/v{version}/{xpi.name}",
    "update_hash": f"sha256:{digest}",
    "applications": {"zotero": {
        "strict_min_version": application["strict_min_version"],
        "strict_max_version": application["strict_max_version"],
    }},
}
updates = dist / "updates.json"
updates.write_text(json.dumps({"addons": {application["id"]: {"updates": [update]}}}, indent=2) + "\n")
(dist / "SHA256SUMS").write_text("".join(
    f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n"
    for path in [xpi, updates]
))
print(xpi)
