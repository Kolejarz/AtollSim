<#
.SYNOPSIS
    Generates printable animal fact-cards and a trivia quiz CSV for "The Ocean Rescue" camp game.

.DESCRIPTION
    Reads a CSV with animal names and interesting facts (both in Polish) and produces:

      1. An AI drawing of every animal (Pollinations.ai image API — free, no API key).
      2. A single printable HTML file (fact-cards.html) with one colorful, kid-friendly
         (8-14 y/o) card per animal: drawing + the fact restyled into a uniform
         "Czy wiesz, ze...?" tone (Pollinations.ai text API). A6 cards, 4 per A4 sheet.
      3. trivia.csv — one lighthearted multiple-choice question per animal. The wrong
         answers (distractors) are cross-referenced from the OTHER animals in the file.
         Columns: Zwierze;Pytanie;A;B;C;D;PoprawnaOdpowiedz

    No API keys or accounts are needed. Internet access is required.

.PARAMETER InputCsv
    Path to the input CSV. Expected columns: animal name + fact (Polish). The script
    auto-detects the delimiter (, or ;) and recognizes headers like Nazwa/Zwierze/Animal
    and Ciekawostka/Fakt/Fact; otherwise it uses the first two columns.

.PARAMETER OutputDir
    Output folder (default: ./fact-cards-output). Contains fact-cards.html, trivia.csv
    and images/.

.PARAMETER NameColumn
    Explicit name of the animal-name column (overrides auto-detection).

.PARAMETER FactColumn
    Explicit name of the fact column (overrides auto-detection).

.PARAMETER Seed
    Seed for image generation and answer shuffling, so reruns are reproducible (default 42).

.PARAMETER SkipImages
    Skip AI image generation (cards get a paw-print placeholder). Useful for fast dry runs.

.PARAMETER Force
    Regenerate images even if they already exist in the output folder. Without -Force,
    existing images are reused (so an interrupted run can be resumed cheaply).

.EXAMPLE
    ./New-AnimalFactCards.ps1 -InputCsv ./animals-sample.csv

.EXAMPLE
    ./New-AnimalFactCards.ps1 -InputCsv ./zwierzeta.csv -OutputDir ./karty -Seed 7
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InputCsv,

    [string]$OutputDir = './fact-cards-output',

    [string]$NameColumn,
    [string]$FactColumn,

    [int]$Seed = 42,

    [switch]$SkipImages,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$TextApiUrl  = 'https://text.pollinations.ai/'
$ImageApiUrl = 'https://image.pollinations.ai/prompt/'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Get-Slug {
    param([string]$Text)
    # PowerShell hashtable keys are case-insensitive, so lowercase keys cover Ą/ą etc.
    $map = @{
        'ą'='a';'ć'='c';'ę'='e';'ł'='l';'ń'='n';'ó'='o';'ś'='s';'ź'='z';'ż'='z'
    }
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $Text.ToLowerInvariant().ToCharArray()) {
        $s = [string]$ch
        if ($map.ContainsKey($s)) { [void]$sb.Append($map[$s]) }
        elseif ($s -match '[A-Za-z0-9]') { [void]$sb.Append($s.ToLower()) }
        else { [void]$sb.Append('-') }
    }
    return ($sb.ToString() -replace '-+', '-').Trim('-')
}

function ConvertTo-HtmlSafe {
    param([string]$Text)
    return $Text -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;'
}

function Invoke-WithRetry {
    param(
        [scriptblock]$Action,
        [int]$MaxAttempts = 4,
        [string]$What = 'request'
    )
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try { return & $Action }
        catch {
            if ($attempt -eq $MaxAttempts) { throw }
            $wait = [math]::Pow(2, $attempt)
            Write-Warning "Attempt $attempt/$MaxAttempts for $What failed ($($_.Exception.Message)). Retrying in ${wait}s..."
            Start-Sleep -Seconds $wait
        }
    }
}

function Invoke-PollinationsText {
    <# Calls the free Pollinations text API (OpenAI-compatible POST, no key). #>
    param(
        [string]$SystemPrompt,
        [string]$UserPrompt
    )
    $payload = @{
        model    = 'openai'
        messages = @(
            @{ role = 'system'; content = $SystemPrompt }
            @{ role = 'user';   content = $UserPrompt }
        )
        seed     = $Seed
    } | ConvertTo-Json -Depth 5

    Invoke-WithRetry -What 'text generation' -Action {
        $resp = Invoke-WebRequest -Uri $TextApiUrl -Method Post `
            -ContentType 'application/json; charset=utf-8' `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) `
            -TimeoutSec 120 -UseBasicParsing
        # Decode explicitly as UTF-8 — Windows PowerShell mis-decodes text/plain bodies.
        [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
    }
}

function ConvertFrom-AiJson {
    <# Parses JSON out of an AI reply, tolerating ```json fences and surrounding prose. #>
    param([string]$Text)
    $clean = $Text -replace '(?s)^.*?```(?:json)?\s*', '' -replace '(?s)```.*$', ''
    $clean = $clean.Trim()
    if ($clean -notmatch '^[\[{]') {
        $start = $clean.IndexOfAny(@('[', '{'))
        if ($start -ge 0) { $clean = $clean.Substring($start) }
    }
    return $clean | ConvertFrom-Json
}

function Save-AnimalImage {
    param(
        [string]$EnglishName,
        [string]$OutFile,
        [int]$ImageSeed
    )
    $prompt = "cute cartoon illustration of a $EnglishName, children's book style, bright cheerful colors, " +
              'friendly smiling animal, simple ocean or nature background, sticker art, no text'
    $url = $ImageApiUrl + [uri]::EscapeDataString($prompt) +
           "?width=768&height=768&nologo=true&seed=$ImageSeed"
    Invoke-WithRetry -What "image for '$EnglishName'" -Action {
        Invoke-WebRequest -Uri $url -OutFile $OutFile -TimeoutSec 300 -UseBasicParsing
    }
}

# ---------------------------------------------------------------------------
# 1. Read and validate the input CSV
# ---------------------------------------------------------------------------

$InputCsv = (Resolve-Path $InputCsv).Path
$firstLine = (Get-Content -Path $InputCsv -TotalCount 1 -Encoding UTF8)
$delimiter = if (($firstLine -split ';').Count -gt ($firstLine -split ',').Count) { ';' } else { ',' }
$rows = @(Import-Csv -Path $InputCsv -Delimiter $delimiter -Encoding UTF8)
if ($rows.Count -eq 0) { throw "Input CSV '$InputCsv' contains no data rows." }

$headers = $rows[0].PSObject.Properties.Name
if (-not $NameColumn) {
    $NameColumn = ($headers | Where-Object { $_ -match '(?i)nazwa|zwierz|animal|name' } | Select-Object -First 1)
    if (-not $NameColumn) { $NameColumn = $headers[0] }
}
if (-not $FactColumn) {
    $FactColumn = ($headers | Where-Object { $_ -ne $NameColumn -and $_ -match '(?i)ciekawostka|fakt|fact|trivia' } | Select-Object -First 1)
    if (-not $FactColumn) { $FactColumn = ($headers | Where-Object { $_ -ne $NameColumn } | Select-Object -First 1) }
}
if (-not $FactColumn) { throw "Could not find a fact column. Use -FactColumn to specify it. Headers: $($headers -join ', ')" }

$animals = foreach ($row in $rows) {
    $name = ([string]$row.$NameColumn).Trim()
    $fact = ([string]$row.$FactColumn).Trim()
    if ($name -and $fact) {
        [pscustomobject]@{ Name = $name; RawFact = $fact; Slug = Get-Slug $name
                           StyledFact = $null; EnglishName = $null; ImageFile = $null }
    }
}
$animals = @($animals)
if ($animals.Count -eq 0) { throw 'No usable rows (each row needs both a name and a fact).' }
if ($animals.Count -lt 4) {
    Write-Warning "Only $($animals.Count) animals — trivia needs at least 4 for A/B/C/D answers; distractor quality will suffer."
}

Write-Host "Read $($animals.Count) animals from '$InputCsv' (columns: '$NameColumn' / '$FactColumn', delimiter '$delimiter')." -ForegroundColor Cyan

$OutputDir = New-Item -ItemType Directory -Path $OutputDir -Force | Select-Object -ExpandProperty FullName
$imagesDir = New-Item -ItemType Directory -Path (Join-Path $OutputDir 'images') -Force | Select-Object -ExpandProperty FullName

# ---------------------------------------------------------------------------
# 2. Per animal: restyle the fact + translate the name, then draw it
# ---------------------------------------------------------------------------

$factSystemPrompt = @'
Jestes redaktorem materialow edukacyjnych dla dzieci w wieku 8-14 lat na letnim obozie.
Dostaniesz nazwe zwierzecia i ciekawostke o nim (po polsku). Twoje zadania:
1. Przeredaguj ciekawostke tak, aby KAZDA karta miala ten sam styl: zaczyna sie od
   "Czy wiesz, ze" i konczy znakiem zapytania, maksymalnie 2 zdania, lekki i radosny ton,
   prosty jezyk, zadnych emoji. Zachowaj fakty - niczego nie zmyslaj.
2. Podaj angielska nazwe tego zwierzecia (do wygenerowania rysunku).
Odpowiedz WYLACZNIE poprawnym JSON-em w formacie:
{"fakt": "...", "english_name": "..."}
'@

$counter = 0
foreach ($animal in $animals) {
    $counter++
    Write-Host "[$counter/$($animals.Count)] $($animal.Name): " -NoNewline

    try {
        $reply = Invoke-PollinationsText -SystemPrompt $factSystemPrompt `
            -UserPrompt "Zwierze: $($animal.Name)`nCiekawostka: $($animal.RawFact)"
        $parsed = ConvertFrom-AiJson $reply
        $animal.StyledFact  = ([string]$parsed.fakt).Trim()
        $animal.EnglishName = ([string]$parsed.english_name).Trim()
    } catch {
        Write-Warning "Text generation failed ($($_.Exception.Message)) — using the raw fact verbatim."
    }
    if (-not $animal.StyledFact)  { $animal.StyledFact  = $animal.RawFact }
    if (-not $animal.EnglishName) { $animal.EnglishName = $animal.Name }
    Write-Host 'fact OK' -NoNewline -ForegroundColor Green

    if (-not $SkipImages) {
        $imgPath = Join-Path $imagesDir "$($animal.Slug).jpg"
        if ((Test-Path $imgPath) -and -not $Force) {
            Write-Host ', image cached' -ForegroundColor Green
        } else {
            try {
                Save-AnimalImage -EnglishName $animal.EnglishName -OutFile $imgPath -ImageSeed ($Seed + $counter)
                Write-Host ', image OK' -ForegroundColor Green
            } catch {
                Write-Host ''
                Write-Warning "Image generation failed for '$($animal.Name)': $($_.Exception.Message)"
            }
        }
        if (Test-Path $imgPath) { $animal.ImageFile = "images/$($animal.Slug).jpg" }
    } else {
        Write-Host ', image skipped' -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# 3. Build the printable HTML fact-cards (A6, 4 per A4 sheet)
# ---------------------------------------------------------------------------

$palette = @(
    @{ Bg = '#FFE5B4'; Accent = '#FF8C42' }, @{ Bg = '#D4F1F9'; Accent = '#1E88C7' },
    @{ Bg = '#E8F5D0'; Accent = '#6AA84F' }, @{ Bg = '#FBE0E6'; Accent = '#E0567B' },
    @{ Bg = '#EDE3F7'; Accent = '#8E5FBF' }, @{ Bg = '#FFF3C4'; Accent = '#D9A404' }
)

$cardsHtml = New-Object System.Text.StringBuilder
for ($i = 0; $i -lt $animals.Count; $i++) {
    $a = $animals[$i]
    $c = $palette[$i % $palette.Count]
    $img = if ($a.ImageFile) {
        "<img class=""animal-img"" src=""$($a.ImageFile)"" alt=""$(ConvertTo-HtmlSafe $a.Name)"">"
    } else {
        '<div class="animal-img placeholder">&#128062;</div>'
    }
    [void]$cardsHtml.AppendLine(@"
    <div class="card" style="--bg:$($c.Bg);--accent:$($c.Accent)">
      <div class="card-inner">
        $img
        <div class="name-banner">$(ConvertTo-HtmlSafe $a.Name)</div>
        <div class="fact-bubble">$(ConvertTo-HtmlSafe $a.StyledFact)</div>
        <div class="card-footer">&#127754; Ocean Rescue &middot; Ciekawostka przyrodnicza</div>
      </div>
    </div>
"@)
}

$html = @"
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Karty ciekawostek o zwierzętach — Ocean Rescue</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, sans-serif;
    background: #f0f7ff;
    padding: 8mm;
  }
  .cards { display: flex; flex-wrap: wrap; }
  .card {
    width: 100mm; height: 141mm;
    padding: 2mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .card-inner {
    width: 100%; height: 100%;
    background: var(--bg);
    border: 2.5mm solid var(--accent);
    border-radius: 8mm;
    display: flex; flex-direction: column; align-items: center;
    padding: 5mm; overflow: hidden;
  }
  .animal-img {
    width: 70mm; height: 70mm;
    object-fit: cover;
    border-radius: 6mm;
    border: 1.5mm solid #fff;
    box-shadow: 0 1mm 3mm rgba(0,0,0,.25);
  }
  .placeholder {
    display: flex; align-items: center; justify-content: center;
    font-size: 30mm; background: #fff;
  }
  .name-banner {
    margin-top: 4mm;
    background: var(--accent); color: #fff;
    padding: 1.5mm 8mm;
    border-radius: 10mm;
    font-size: 16pt; font-weight: bold;
    text-align: center;
    max-width: 88mm;
  }
  .fact-bubble {
    margin-top: 4mm;
    background: #fff;
    border-radius: 5mm;
    padding: 3.5mm 4.5mm;
    font-size: 11.5pt; line-height: 1.35;
    text-align: center;
    flex: 1; display: flex; align-items: center;
    box-shadow: 0 1mm 2mm rgba(0,0,0,.12);
  }
  .card-footer {
    margin-top: 2.5mm;
    font-size: 7.5pt; color: var(--accent); font-weight: bold;
  }
  @media print {
    body { background: #fff; padding: 0; }
    @page { size: A4; margin: 6mm; }
  }
</style>
</head>
<body>
  <div class="cards">
$($cardsHtml.ToString())
  </div>
</body>
</html>
"@

$htmlPath = Join-Path $OutputDir 'fact-cards.html'
[System.IO.File]::WriteAllText($htmlPath, $html, (New-Object System.Text.UTF8Encoding $true))
Write-Host "Fact-cards written to $htmlPath" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 4. Trivia quiz CSV (cross-referenced answers from the full animal list)
# ---------------------------------------------------------------------------

Write-Host 'Generating trivia questions...' -ForegroundColor Cyan

$allNames = $animals | ForEach-Object { $_.Name }
$triviaSystemPrompt = @"
Tworzysz wesoly quiz przyrodniczy dla dzieci w wieku 8-14 lat na letnim obozie.
Dla kazdego zwierzecia z listy uloz JEDNO lekkie, zabawne pytanie po polsku oparte na
jego ciekawostce. Pytanie NIE moze zawierac nazwy tego zwierzecia (to jest odpowiedz!).
Przyklad stylu: "Ktore zwierze spi z jednym okiem otwartym?".
Do kazdego pytania wybierz 3 bledne odpowiedzi (inne zwierzeta) WYLACZNIE z tej listy:
$($allNames -join ', ').
Bledne odpowiedzi nie moga byc poprawna odpowiedzia. Ton lekki i przyjazny.
Odpowiedz WYLACZNIE poprawnym JSON-em - tablica obiektow w formacie:
[{"zwierze": "...", "pytanie": "...", "dystraktory": ["...", "...", "..."]}]
"@

$rand = New-Object System.Random($Seed)
$triviaRows = New-Object System.Collections.Generic.List[object]
$batchSize = 6

for ($offset = 0; $offset -lt $animals.Count; $offset += $batchSize) {
    $batch = $animals[$offset..([math]::Min($offset + $batchSize, $animals.Count) - 1)]
    $batchPrompt = ($batch | ForEach-Object { "- $($_.Name): $($_.StyledFact)" }) -join "`n"

    $items = $null
    try {
        $reply = Invoke-PollinationsText -SystemPrompt $triviaSystemPrompt -UserPrompt $batchPrompt
        $items = @(ConvertFrom-AiJson $reply)
    } catch {
        Write-Warning "Trivia generation failed for batch starting at '$($batch[0].Name)': $($_.Exception.Message)"
    }

    foreach ($animal in $batch) {
        $item = $items | Where-Object { ([string]$_.zwierze).Trim() -ieq $animal.Name } | Select-Object -First 1
        if (-not $item -and $items) {
            $item = $items[[array]::IndexOf(@($batch.Name), $animal.Name)]
        }

        if ($item -and $item.pytanie -and @($item.dystraktory).Count -ge 3) {
            $question    = ([string]$item.pytanie).Trim()
            $distractors = @($item.dystraktory | ForEach-Object { ([string]$_).Trim() } |
                             Where-Object { $_ -and $_ -ine $animal.Name }) | Select-Object -First 3
        } else {
            # Fallback: template question + random distractors, so the quiz is never missing a row.
            # Mask the animal name (including inflected forms, via word stems) so the fact
            # doesn't give away the answer.
            $maskedFact = $animal.StyledFact
            foreach ($word in ($animal.Name -split '\s+')) {
                if ($word.Length -lt 4) { continue }
                $stem = $word.Substring(0, [math]::Max(4, $word.Length - 2))
                $maskedFact = $maskedFact -replace "(?i)\b$([regex]::Escape($stem))\w*", 'to zwierzę'
            }
            $maskedFact = $maskedFact -replace '(to zwierzę\s*)+', 'to zwierzę '
            $question    = "Które zwierzę kryje się za tą ciekawostką: $maskedFact"
            $distractors = @()
        }
        while (@($distractors).Count -lt 3) {
            $pool = @($allNames | Where-Object { $_ -ine $animal.Name -and $_ -notin $distractors })
            if ($pool.Count -eq 0) { $distractors += '???'; continue }
            $distractors += $pool[$rand.Next($pool.Count)]
        }

        $options = @($animal.Name) + @($distractors | Select-Object -First 3)
        $shuffled = $options | Sort-Object { $rand.Next() }
        $letters = 'A', 'B', 'C', 'D'
        $correctLetter = $letters[[array]::IndexOf(@($shuffled), $animal.Name)]

        $triviaRows.Add([pscustomobject]@{
            Zwierze           = $animal.Name
            Pytanie           = $question
            A                 = $shuffled[0]
            B                 = $shuffled[1]
            C                 = $shuffled[2]
            D                 = $shuffled[3]
            PoprawnaOdpowiedz = $correctLetter
        })
    }
}

$triviaPath = Join-Path $OutputDir 'trivia.csv'
$csvLines = New-Object System.Collections.Generic.List[string]
$csvLines.Add('Zwierze;Pytanie;A;B;C;D;PoprawnaOdpowiedz')
foreach ($r in $triviaRows) {
    $fields = $r.Zwierze, $r.Pytanie, $r.A, $r.B, $r.C, $r.D, $r.PoprawnaOdpowiedz |
        ForEach-Object { '"' + ($_ -replace '"', '""') + '"' }
    $csvLines.Add($fields -join ';')
}
# UTF-8 with BOM + semicolon delimiter so Polish Excel opens it correctly out of the box.
[System.IO.File]::WriteAllLines($triviaPath, $csvLines, (New-Object System.Text.UTF8Encoding $true))

# ---------------------------------------------------------------------------
# 5. Summary
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host '=== Done ===' -ForegroundColor Green
Write-Host "  Fact-cards : $htmlPath  (open in a browser, print on A4 — 4 cards per sheet)"
Write-Host "  Trivia quiz: $triviaPath  ($($triviaRows.Count) questions)"
Write-Host "  Images     : $imagesDir"
