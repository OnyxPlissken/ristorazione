# CSV Pinterest da SharePoint

Lo script [scripts/sharepoint-to-pinterest-csv.mjs](/C:/Users/mmartone/OneDrive%20-%20ISAIA%20e%20ISAIA%20S.p.A/Documenti/New%20project/scripts/sharepoint-to-pinterest-csv.mjs) legge una cartella SharePoint via Microsoft Graph, seleziona una sola immagine per ogni `LOOK`, e genera un CSV con intestazioni:

`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`

## Regole implementate

- `Title`: `Isaia Napoli` + cartella livello 4 + cartella livello 5
- `Pinterest board`: livello 4 + ` | ` + livello 6
- `Thumbnail`: livello 5, oppure vuoto se usi `--thumbnail-mode blank`
- `Description`: `ISAIA Napoli` + stagione estesa (`SS26` -> `Spring Summer 26`, `FW26` -> `Fall Winter 26`) + ` | ` + livello 6 + livello 5 + ` | ` + livello 6 + ` | ` + `Look N`
- `Link`: `https://www.isaia.it/`
- `Publish date`, `Keywords`: vuoti
- Deduplica per look: se esistono piu file come `LOOK1_050` e `LOOK1_055`, viene tenuto solo quello col numero finale piu basso

## Prerequisiti Microsoft Graph

Servono credenziali applicative:

- `M365_TENANT_ID`
- `M365_CLIENT_ID`
- `M365_CLIENT_SECRET`

L'app Entra ID deve avere permessi Microsoft Graph sufficienti per:

- leggere sito, libreria e file
- creare link di condivisione (`createLink`)

In pratica, per il flusso attuale servono permessi applicativi che coprano almeno lettura e creazione link nella document library. Se usi `media-mode=sharepoint-anyone-link`, il tenant SharePoint deve consentire i link `Anyone`.

## Esecuzione minima

```powershell
npm run pinterest:csv -- `
  --folder-url "https://isaia.sharepoint.com/sites/branding/Documenti%20condivisi/Forms/AllItems.aspx?id=%2Fsites%2Fbranding%2FDocumenti%20condivisi%2FShared%20Folder%2F02%5FCollezioni&viewid=075e5df6%2Dd679%2D4356%2Dad2c%2D53955efa3dbe&view=0" `
  --tenant-id "<tenant-id>" `
  --client-id "<client-id>" `
  --client-secret "<client-secret>" `
  --out "outputs/pinterest-sharepoint.csv"
```

## Modalita `Media URL`

### 1. `sharepoint-anyone-link`

Default. Per ogni immagine crea un link SharePoint `Anyone/View` e lo scrive nel CSV.

```powershell
npm run pinterest:csv -- --folder-url "<url>" --tenant-id "<tenant>" --client-id "<client>" --client-secret "<secret>"
```

Nota: Pinterest dichiara di preferire un URL pubblico al file immagine stesso. I link SharePoint `Anyone` sono link di sharing; possono funzionare, ma non sono il formato piu pulito possibile.

### 2. `public-base-url`

Scarica localmente le immagini selezionate e genera `Media URL` basate su una tua base URL pubblica.

```powershell
npm run pinterest:csv -- `
  --folder-url "<url>" `
  --tenant-id "<tenant>" `
  --client-id "<client>" `
  --client-secret "<secret>" `
  --media-mode public-base-url `
  --public-base-url "https://media.example.com/pinterest" `
  --download-dir "public/pinterest-media"
```

In questo caso dovrai pubblicare la cartella scaricata in modo che l'URL sia realmente pubblico.

## Thumbnail

Per tua richiesta il default e `level5`, quindi per immagini come `SS26/Lookbook/...` il campo `Thumbnail` diventa `Lookbook`.

Se Pinterest dovesse contestare il campo `Thumbnail` per upload immagine, riesegui con:

```powershell
npm run pinterest:csv -- ... --thumbnail-mode blank
```
