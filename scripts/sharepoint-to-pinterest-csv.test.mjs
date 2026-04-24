import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPinterestRows,
  formatSeasonLabel,
  parseLookInfo,
  parseSharePointFolderUrl
} from "./sharepoint-to-pinterest-csv.mjs";

test("parseSharePointFolderUrl estrae hostname, site, libreria e cartella", () => {
  const parsed = parseSharePointFolderUrl(
    "https://isaia.sharepoint.com/sites/branding/Documenti%20condivisi/Forms/AllItems.aspx?id=%2Fsites%2Fbranding%2FDocumenti%20condivisi%2FShared%20Folder%2F02%5FCollezioni&viewid=abc"
  );

  assert.deepEqual(parsed, {
    hostname: "isaia.sharepoint.com",
    sitePath: "/sites/branding",
    driveName: "Documenti condivisi",
    baseFolderPath: "Shared Folder/02_Collezioni"
  });
});

test("parseLookInfo riconosce look e frame", () => {
  assert.deepEqual(parseLookInfo("ISAIA_LOOKBOOK_SS26_LOOK1_050.jpg"), {
    lookNumber: 1,
    frameNumber: 50
  });
});

test("formatSeasonLabel traduce SS e FW", () => {
  assert.equal(formatSeasonLabel("SS26"), "Spring Summer 26");
  assert.equal(formatSeasonLabel("FW26"), "Fall Winter 26");
});

test("buildPinterestRows sceglie solo il frame piu basso per ogni look", () => {
  const config = {
    titlePrefix: "Isaia Napoli",
    descriptionPrefix: "ISAIA Napoli",
    linkUrl: "https://www.isaia.it/",
    thumbnailMode: "level5"
  };

  const files = [
    {
      id: "1",
      name: "ISAIA_LOOKBOOK_SS26_LOOK1_055.jpg",
      relativePath: "SS26/Lookbook/ISAIA Contemporanea/Final JPEG/ISAIA_LOOKBOOK_SS26_LOOK1_055.jpg",
      relativeSegments: ["SS26", "Lookbook", "ISAIA Contemporanea", "Final JPEG"]
    },
    {
      id: "2",
      name: "ISAIA_LOOKBOOK_SS26_LOOK1_050.jpg",
      relativePath: "SS26/Lookbook/ISAIA Contemporanea/Final JPEG/ISAIA_LOOKBOOK_SS26_LOOK1_050.jpg",
      relativeSegments: ["SS26", "Lookbook", "ISAIA Contemporanea", "Final JPEG"]
    },
    {
      id: "3",
      name: "ISAIA_LOOKBOOK_SS26_LOOK2_010.jpg",
      relativePath: "SS26/Lookbook/ISAIA Contemporanea/Final JPEG/ISAIA_LOOKBOOK_SS26_LOOK2_010.jpg",
      relativeSegments: ["SS26", "Lookbook", "ISAIA Contemporanea", "Final JPEG"]
    }
  ];

  const { rows, skipped } = buildPinterestRows(files, config);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].file.id, "2");
  assert.equal(rows[0].csv.Title, "Isaia Napoli SS26 Lookbook");
  assert.equal(rows[0].csv["Pinterest board"], "SS26 | ISAIA Contemporanea");
  assert.equal(
    rows[0].csv.Description,
    "ISAIA Napoli Spring Summer 26 | ISAIA Contemporanea Lookbook | ISAIA Contemporanea | Look 1"
  );
  assert.equal(rows[0].csv.Thumbnail, "Lookbook");
  assert.equal(skipped.length, 1);
});
