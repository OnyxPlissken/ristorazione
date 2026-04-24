import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CSV_HEADERS = [
  "Title",
  "Media URL",
  "Pinterest board",
  "Thumbnail",
  "Description",
  "Link",
  "Publish date",
  "Keywords"
];

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_OUTPUT_FILE = "outputs/pinterest-sharepoint.csv";
const DEFAULT_TITLE_PREFIX = "Isaia Napoli";
const DEFAULT_DESCRIPTION_PREFIX = "ISAIA Napoli";
const DEFAULT_DESTINATION_LINK = "https://www.isaia.it/";
const DEFAULT_THUMBNAIL_MODE = "level5";
const DEFAULT_MEDIA_MODE = "sharepoint-anyone-link";
const DEFAULT_LINK_SCOPE = "anonymous";
const DEFAULT_LINK_TYPE = "view";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const HELP_TEXT = `
Uso:
  npm run pinterest:csv -- --folder-url "<url-sharepoint>" --tenant-id "<tenant>" --client-id "<client>" --client-secret "<secret>"

Parametri principali:
  --folder-url         URL della cartella SharePoint (puo usare direttamente l'URL AllItems.aspx)
  --out                Percorso file CSV di output (default: ${DEFAULT_OUTPUT_FILE})
  --media-mode         sharepoint-anyone-link | public-base-url
  --public-base-url    Base URL pubblica da usare quando media-mode=public-base-url
  --download-dir       Cartella locale dove scaricare le immagini quando media-mode=public-base-url
  --thumbnail-mode     level5 | blank
  --verbose            Stampa anche l'elenco dei file scartati

Variabili ambiente supportate:
  M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET
  SHAREPOINT_FOLDER_URL, SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH, SHAREPOINT_DRIVE_NAME, SHAREPOINT_BASE_FOLDER
  PINTEREST_CSV_OUTPUT, PINTEREST_MEDIA_MODE, PINTEREST_PUBLIC_BASE_URL, PINTEREST_DOWNLOAD_DIR
  PINTEREST_THUMBNAIL_MODE, PINTEREST_TITLE_PREFIX, PINTEREST_DESCRIPTION_PREFIX, PINTEREST_LINK_URL
`.trim();

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.trim();

    if (!key) {
      continue;
    }

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = nextToken;
    index += 1;
  }

  return args;
}

function getConfig(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const folderUrl = args["folder-url"] ?? env.SHAREPOINT_FOLDER_URL;
  const parsedFolderUrl = folderUrl ? parseSharePointFolderUrl(folderUrl) : null;

  const hostname = args["hostname"] ?? env.SHAREPOINT_HOSTNAME ?? parsedFolderUrl?.hostname;
  const sitePath = args["site-path"] ?? env.SHAREPOINT_SITE_PATH ?? parsedFolderUrl?.sitePath;
  const driveName = args["drive-name"] ?? env.SHAREPOINT_DRIVE_NAME ?? parsedFolderUrl?.driveName;
  const baseFolderPath =
    args["base-folder"] ?? env.SHAREPOINT_BASE_FOLDER ?? parsedFolderUrl?.baseFolderPath;

  const config = {
    folderUrl,
    hostname,
    sitePath,
    driveName,
    baseFolderPath,
    tenantId: args["tenant-id"] ?? env.M365_TENANT_ID,
    clientId: args["client-id"] ?? env.M365_CLIENT_ID,
    clientSecret: args["client-secret"] ?? env.M365_CLIENT_SECRET,
    outputFile: args.out ?? env.PINTEREST_CSV_OUTPUT ?? DEFAULT_OUTPUT_FILE,
    titlePrefix: args["title-prefix"] ?? env.PINTEREST_TITLE_PREFIX ?? DEFAULT_TITLE_PREFIX,
    descriptionPrefix:
      args["description-prefix"] ??
      env.PINTEREST_DESCRIPTION_PREFIX ??
      DEFAULT_DESCRIPTION_PREFIX,
    linkUrl: args["link-url"] ?? env.PINTEREST_LINK_URL ?? DEFAULT_DESTINATION_LINK,
    thumbnailMode:
      args["thumbnail-mode"] ?? env.PINTEREST_THUMBNAIL_MODE ?? DEFAULT_THUMBNAIL_MODE,
    mediaMode: args["media-mode"] ?? env.PINTEREST_MEDIA_MODE ?? DEFAULT_MEDIA_MODE,
    publicBaseUrl: args["public-base-url"] ?? env.PINTEREST_PUBLIC_BASE_URL,
    downloadDir: args["download-dir"] ?? env.PINTEREST_DOWNLOAD_DIR,
    sharingScope: args["sharing-scope"] ?? env.SHAREPOINT_LINK_SCOPE ?? DEFAULT_LINK_SCOPE,
    sharingType: args["sharing-type"] ?? env.SHAREPOINT_LINK_TYPE ?? DEFAULT_LINK_TYPE,
    verbose: Boolean(args.verbose ?? false)
  };

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  const missing = [];

  for (const [label, value] of [
    ["hostname", config.hostname],
    ["sitePath", config.sitePath],
    ["driveName", config.driveName],
    ["baseFolderPath", config.baseFolderPath],
    ["tenantId", config.tenantId],
    ["clientId", config.clientId],
    ["clientSecret", config.clientSecret]
  ]) {
    if (!value) {
      missing.push(label);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      [
        `Configurazione incompleta: mancano ${missing.join(", ")}.`,
        "Passa i parametri CLI oppure imposta le variabili M365_* e SHAREPOINT_*."
      ].join(" ")
    );
  }

  if (!["blank", "level5"].includes(config.thumbnailMode)) {
    throw new Error("thumbnail-mode deve essere 'blank' oppure 'level5'.");
  }

  if (!["sharepoint-anyone-link", "public-base-url"].includes(config.mediaMode)) {
    throw new Error("media-mode deve essere 'sharepoint-anyone-link' oppure 'public-base-url'.");
  }

  if (config.mediaMode === "public-base-url" && !config.publicBaseUrl) {
    throw new Error("Con media-mode=public-base-url devi specificare public-base-url.");
  }
}

export function parseSharePointFolderUrl(folderUrl) {
  const url = new URL(folderUrl);
  const rawPath = decodeURIComponent(url.searchParams.get("id") ?? url.pathname);
  const segments = rawPath.split("/").filter(Boolean);

  if (segments.length < 4) {
    throw new Error(`URL SharePoint non riconosciuto: ${folderUrl}`);
  }

  const siteKind = segments[0];
  if (siteKind !== "sites" && siteKind !== "teams") {
    throw new Error(`Percorso SharePoint non supportato: ${rawPath}`);
  }

  const sitePath = `/${siteKind}/${segments[1]}`;
  const driveName = segments[2];
  const baseFolderPath = segments.slice(3).join("/");

  return {
    hostname: url.hostname,
    sitePath,
    driveName,
    baseFolderPath
  };
}

async function getAccessToken({ tenantId, clientId, clientSecret }) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Token Microsoft Graph non ottenuto (${response.status}): ${payload.error_description ?? payload.error ?? "errore sconosciuto"}`
    );
  }

  return payload.access_token;
}

async function graphRequest(token, endpoint, options = {}) {
  const response = await fetch(`${GRAPH_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Errore Graph ${response.status} su ${endpoint}: ${payload}`);
  }

  return response;
}

async function graphJson(token, endpoint, options = {}) {
  const response = await graphRequest(token, endpoint, options);
  return response.json();
}

async function resolveSite(token, { hostname, sitePath }) {
  return graphJson(
    token,
    `/sites/${encodeURIComponent(hostname)}:${encodeGraphPath(sitePath)}?$select=id,displayName,webUrl`
  );
}

async function resolveDrive(token, siteId, driveName) {
  const payload = await graphJson(token, `/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,webUrl`);
  const normalizedTarget = normalizeDriveName(driveName);
  const drive = (payload.value ?? []).find((candidate) => normalizeDriveName(candidate.name) === normalizedTarget);

  if (!drive) {
    const availableDrives = (payload.value ?? []).map((candidate) => candidate.name).join(", ");
    throw new Error(`Libreria SharePoint '${driveName}' non trovata. Disponibili: ${availableDrives}`);
  }

  return drive;
}

function normalizeDriveName(value) {
  return String(value).trim().toLowerCase();
}

async function resolveFolder(token, driveId, folderPath) {
  return graphJson(
    token,
    `/drives/${encodeURIComponent(driveId)}/root:${encodeGraphPath(folderPath)}:?$select=id,name,folder,webUrl`
  );
}

async function listChildren(token, driveId, itemId) {
  const results = [];
  let nextUrl = `${GRAPH_BASE_URL}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children?$select=id,name,file,folder,size,webUrl`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Errore Graph ${response.status} su children: ${payload}`);
    }

    const page = await response.json();
    results.push(...(page.value ?? []));
    nextUrl = page["@odata.nextLink"] ?? null;
  }

  return results;
}

async function collectFiles(token, driveId, folderId, relativeSegments = []) {
  const children = await listChildren(token, driveId, folderId);
  const files = [];

  for (const child of children) {
    if (child.folder) {
      const nestedFiles = await collectFiles(token, driveId, child.id, [...relativeSegments, child.name]);
      files.push(...nestedFiles);
      continue;
    }

    if (!child.file || !isImageFile(child.name)) {
      continue;
    }

    files.push({
      ...child,
      relativePath: [...relativeSegments, child.name].join("/"),
      relativeSegments
    });
  }

  return files;
}

function isImageFile(filename) {
  return IMAGE_EXTENSIONS.has(path.posix.extname(filename).toLowerCase());
}

export function parseLookInfo(filename) {
  const extension = path.posix.extname(filename);
  const basename = path.posix.basename(filename, extension);
  const match = basename.match(/LOOK[_\-\s]?0*(\d+)(?:[_\-\s]+0*(\d+))?/i);

  if (!match) {
    return null;
  }

  return {
    lookNumber: Number.parseInt(match[1], 10),
    frameNumber: match[2] ? Number.parseInt(match[2], 10) : Number.MAX_SAFE_INTEGER
  };
}

export function formatSeasonLabel(rawSeason) {
  const compactSeason = String(rawSeason).replace(/[^a-z0-9]/gi, "").toUpperCase();
  const match = compactSeason.match(/^(SS|FW)(\d{2,4})$/);

  if (!match) {
    return rawSeason;
  }

  return `${match[1] === "SS" ? "Spring Summer" : "Fall Winter"} ${match[2]}`;
}

function formatLookLabel(lookNumber) {
  return `Look ${lookNumber}`;
}

function selectPreferredFiles(files) {
  const selected = new Map();
  const skipped = [];

  for (const file of files) {
    const [season, assetType, collection] = file.relativeSegments;

    if (!season || !assetType || !collection) {
      skipped.push({
        reason: "Percorso troppo corto",
        file: file.relativePath
      });
      continue;
    }

    const lookInfo = parseLookInfo(file.name);
    if (!lookInfo) {
      skipped.push({
        reason: "LOOK non riconosciuto nel nome file",
        file: file.relativePath
      });
      continue;
    }

    const groupKey = [season, assetType, collection, lookInfo.lookNumber].join("||");
    const current = selected.get(groupKey);

    if (!current || lookInfo.frameNumber < current.lookInfo.frameNumber) {
      if (current) {
        skipped.push({
          reason: "Scartata variante con numero piu alto",
          file: current.file.relativePath
        });
      }

      selected.set(groupKey, {
        file,
        lookInfo,
        season,
        assetType,
        collection
      });
      continue;
    }

    skipped.push({
      reason: "Scartata variante con numero piu alto",
      file: file.relativePath
    });
  }

  return {
    selectedItems: Array.from(selected.values()).sort((left, right) =>
      left.file.relativePath.localeCompare(right.file.relativePath, "it")
    ),
    skipped
  };
}

export function buildPinterestRows(files, config) {
  const { selectedItems, skipped } = selectPreferredFiles(files);

  const rows = selectedItems.map(({ file, lookInfo, season, assetType, collection }) => ({
    file,
    csv: {
      Title: `${config.titlePrefix} ${season} ${assetType}`.trim(),
      "Media URL": "",
      "Pinterest board": `${season} | ${collection}`,
      Thumbnail: config.thumbnailMode === "level5" ? assetType : "",
      Description: [
        `${config.descriptionPrefix} ${formatSeasonLabel(season)}`.trim(),
        `${collection} ${assetType}`.trim(),
        collection,
        formatLookLabel(lookInfo.lookNumber)
      ].join(" | "),
      Link: config.linkUrl,
      "Publish date": "",
      Keywords: ""
    }
  }));

  return { rows, skipped };
}

async function createAnyoneLink(token, driveId, itemId, { sharingScope, sharingType }) {
  const payload = await graphJson(token, `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/createLink`, {
    method: "POST",
    body: JSON.stringify({
      scope: sharingScope,
      type: sharingType
    })
  });

  const webUrl = payload?.link?.webUrl;
  if (!webUrl) {
    throw new Error(`createLink non ha restituito un webUrl per item ${itemId}`);
  }

  return appendDownloadQuery(webUrl);
}

function appendDownloadQuery(url) {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("download")) {
    parsed.searchParams.set("download", "1");
  }

  return parsed.toString();
}

async function downloadFile(token, driveId, itemId, destinationFile) {
  const response = await graphRequest(token, `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`);
  const arrayBuffer = await response.arrayBuffer();
  await fs.mkdir(path.dirname(destinationFile), { recursive: true });
  await fs.writeFile(destinationFile, Buffer.from(arrayBuffer));
}

function toPublicAssetUrl(baseUrl, relativePath) {
  const sanitizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${sanitizedBaseUrl}/${encodedPath}`;
}

async function enrichRowsWithMediaUrls(token, driveId, rows, config) {
  const downloadDir =
    config.downloadDir ?? path.join(path.dirname(config.outputFile), "pinterest-media");

  for (const row of rows) {
    if (config.mediaMode === "sharepoint-anyone-link") {
      row.csv["Media URL"] = await createAnyoneLink(token, driveId, row.file.id, config);
      continue;
    }

    const destinationFile = path.join(downloadDir, ...row.file.relativeSegments, row.file.name);
    await downloadFile(token, driveId, row.file.id, destinationFile);
    row.csv["Media URL"] = toPublicAssetUrl(config.publicBaseUrl, row.file.relativePath);
  }
}

function serializeCsv(rows) {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => CSV_HEADERS.map((header) => escapeCsvValue(row.csv[header] ?? "")).join(","))
  ];

  return lines.join("\n");
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function encodeGraphPath(value) {
  const normalized = String(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/${normalized}`;
}

async function main() {
  const config = getConfig();
  const token = await getAccessToken(config);
  const site = await resolveSite(token, config);
  const drive = await resolveDrive(token, site.id, config.driveName);
  const folder = await resolveFolder(token, drive.id, config.baseFolderPath);

  if (!folder.folder) {
    throw new Error(`Il percorso '${config.baseFolderPath}' non punta a una cartella.`);
  }

  const files = await collectFiles(token, drive.id, folder.id);
  const { rows, skipped } = buildPinterestRows(files, config);

  if (rows.length === 0) {
    throw new Error("Nessuna immagine valida trovata per costruire il CSV.");
  }

  await enrichRowsWithMediaUrls(token, drive.id, rows, config);

  const csv = serializeCsv(rows);
  await fs.mkdir(path.dirname(config.outputFile), { recursive: true });
  await fs.writeFile(config.outputFile, csv, "utf8");

  const summary = {
    outputFile: path.resolve(config.outputFile),
    totalImagesScanned: files.length,
    totalPinsGenerated: rows.length,
    skippedFiles: skipped.length,
    mediaMode: config.mediaMode,
    sharePointSite: site.webUrl,
    driveName: drive.name
  };

  console.log(JSON.stringify(summary, null, 2));

  if (config.verbose && skipped.length > 0) {
    console.log(JSON.stringify({ skipped }, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
