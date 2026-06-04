param(
  [string]$WorkbookPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "Downloads\book-2.xlsx"),
  [string]$OutputPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "Downloads\book-2-import.json")
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryText {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$Name
  )

  $entry = $Zip.Entries | Where-Object { $_.FullName -eq $Name } | Select-Object -First 1
  if (-not $entry) {
    return $null
  }

  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Close()
  }
}

function Get-ColLetters {
  param([string]$Ref)
  return ([regex]::Match($Ref, "^[A-Z]+")).Value
}

function Clean-CellValue {
  param([string]$Value)
  if ($null -eq $Value) {
    return $null
  }

  $clean = ($Value -replace "`r", "`n") -replace "`n+", "`n"
  $clean = $clean.Trim()
  if (
    $clean -eq "" -or
    $clean -eq "x" -or
    $clean -eq ([string][char]0x0445) -or
    $clean -eq "#ЗНАЧ!" -or
    $clean -eq "#VALUE!" -or
    $clean -eq "#REF!" -or
    $clean -eq "#N/A"
  ) {
    return $null
  }

  return $clean
}

function Convert-FromUtf8Base64 {
  param([string]$Value)
  return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

function Get-MapValue {
  param(
    [hashtable]$Map,
    [string]$Key
  )

  if ($Map.ContainsKey($Key)) {
    return $Map[$Key]
  }
  return $null
}

function Get-CellValue {
  param(
    [System.Xml.XmlElement]$Cell,
    [System.Xml.XmlNamespaceManager]$Ns,
    [object[]]$SharedStrings
  )

  $vNode = $Cell.SelectSingleNode("m:v", $Ns)
  $cellType = $Cell.GetAttribute("t")
  if ($cellType -eq "s" -and $vNode) {
    return [string]$SharedStrings[[int]$vNode.InnerText]
  }
  if ($cellType -eq "inlineStr") {
    return [string](($Cell.SelectNodes(".//m:t", $Ns) | ForEach-Object { $_.InnerText }) -join "")
  }
  if ($vNode) {
    return [string]$vNode.InnerText
  }
  return ""
}

function Convert-ToNumber {
  param([string]$Value)
  $clean = Clean-CellValue $Value
  if ($null -eq $clean) {
    return $null
  }

  $normalized = ($clean -replace ",", ".") -replace "[^\d\.\-]", ""
  $number = 0.0
  if ([double]::TryParse($normalized, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return $number
  }
  return $null
}

function Convert-ToInt {
  param([string]$Value)
  $number = Convert-ToNumber $Value
  if ($null -eq $number) {
    return $null
  }
  return [int][Math]::Round($number)
}

function Convert-ToDateIso {
  param([string]$Value)
  $clean = Clean-CellValue $Value
  if ($null -eq $clean) {
    return $null
  }

  $date = [DateTime]::MinValue
  [string[]]$formats = @("yyyy.MM.dd", "yyyy-MM-dd", "dd.MM.yyyy", "M/d/yyyy")
  if ([DateTime]::TryParseExact($clean, $formats, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeLocal, [ref]$date)) {
    return $date.ToString("o")
  }

  $number = 0.0
  if ([double]::TryParse($clean, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    try {
      $oaDate = [DateTime]::FromOADate($number)
      if ($oaDate.Year -lt 2020) {
        return $null
      }
      return $oaDate.ToString("o")
    } catch {
      return $null
    }
  }

  return $null
}

function Looks-LikeParcelNumber {
  param([string]$Value)
  $clean = Clean-CellValue $Value
  if ($null -eq $clean) {
    return $false
  }

  $lower = $clean.ToLowerInvariant()
  $nonTrackingWords = @(
    "0L/QtdGA0LXQsNC00YDQtdGB0LDRhtC40Y8=",
    "0L3QtSDQv9C+INC90LDRiNC10LzRgyDQsNC00YDQtdGB0YM=",
    "0L3QtdGC0YM=",
    "0L3QtdGCINGN0YLQuNGF",
    "0L7QsdGK0LXQtNC10L3QtdC9",
    "0L7QsdGK0LXQtNC40L3QtdC9",
    "0YPRgtC40LvQuNC30LjRgNC+0LLQsNC90L4=",
    "0L7RgtC80LXQvdC10L0=",
    "0L7RgtC80LXQvdGR0L0=",
    "0LXRidC1INC90LUg0LLQtdGA0L3Rg9C70YHRjw==",
    "0LXRidGRINC90LUg0LLQtdGA0L3Rg9C70YHRjw=="
  ) | ForEach-Object { Convert-FromUtf8Base64 $_ }

  foreach ($word in $nonTrackingWords) {
    if ($lower.Contains($word)) {
      return $false
    }
  }

  $upper = $clean.ToUpperInvariant()
  if ($upper -match "\b[A-Z]{1,8}\d{6,}[A-Z0-9]{0,8}\b") {
    return $true
  }
  if ($upper -match "\b[A-Z0-9]{8,}\b") {
    return $true
  }
  if ($upper -match "\b\d{10,}\b") {
    return $true
  }
  $digitCount = ([regex]::Matches($upper, "\d")).Count
  if ($digitCount -ge 6) {
    return $true
  }
  return $false
}

function Get-ParcelNumberFromText {
  param([string]$Value)
  $clean = Clean-CellValue $Value
  if ($null -eq $clean) {
    return $null
  }

  $upper = $clean.ToUpperInvariant()
  $patterns = @(
    "\b[A-Z]{1,8}\d{6,}[A-Z0-9]{0,8}\b",
    "\b(?=[A-Z0-9]*\d)[A-Z0-9]{8,}\b",
    "\b\d{10,}\b",
    "\b[A-Z]{2,}\d+[A-Z]{1,4}\b",
    "\b\d+(?:[\.,]\d+)?E\+\d+\b",
    "\b\d{4,}\b"
  )

  foreach ($pattern in $patterns) {
    $match = [regex]::Match($upper, $pattern)
    if ($match.Success) {
      return $match.Value.Trim()
    }
  }

  return $null
}

function Get-FillColor {
  param(
    [System.Xml.XmlElement]$Cell,
    [object[]]$CellFillIds,
    [object[]]$Fills
  )

  $style = 0
  if ($Cell.HasAttribute("s")) {
    $style = [int]$Cell.GetAttribute("s")
  }

  if ($style -ge $CellFillIds.Count) {
    return ""
  }

  $fillId = $CellFillIds[$style]
  if ($fillId -ge $Fills.Count) {
    return ""
  }

  $fill = $Fills[$fillId]
  if ($fill.Rgb) {
    return [string]$fill.Rgb
  }
  if ($fill.Indexed) {
    return "indexed:$($fill.Indexed)"
  }
  if ($fill.Theme) {
    return "theme:$($fill.Theme)"
  }
  return ""
}

function Read-SheetRows {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$SheetEntry,
    [object[]]$SharedStrings,
    [object[]]$CellFillIds,
    [object[]]$Fills
  )

  [xml]$sheetXml = Read-ZipEntryText $Zip $SheetEntry
  $ns = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
  $ns.AddNamespace("m", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $rows = @()
  foreach ($row in $sheetXml.SelectNodes("//m:sheetData/m:row", $ns)) {
    $cells = @{}
    $colors = @{}
    foreach ($cell in $row.SelectNodes("m:c", $ns)) {
      $col = Get-ColLetters $cell.r
      $cells[$col] = Get-CellValue $cell $ns $SharedStrings
      $colors[$col] = Get-FillColor $cell $CellFillIds $Fills
    }
    $rows += [pscustomobject]@{
      row = [int]$row.r
      cells = $cells
      colors = $colors
    }
  }
  return $rows
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($WorkbookPath)
try {
  [xml]$sharedXml = Read-ZipEntryText $zip "xl/sharedStrings.xml"
  $sharedNs = New-Object System.Xml.XmlNamespaceManager($sharedXml.NameTable)
  $sharedNs.AddNamespace("m", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  $sharedStrings = @()
  foreach ($si in $sharedXml.SelectNodes("//m:si", $sharedNs)) {
    $sharedStrings += [string](($si.SelectNodes(".//m:t", $sharedNs) | ForEach-Object { $_.InnerText }) -join "")
  }

  [xml]$stylesXml = Read-ZipEntryText $zip "xl/styles.xml"
  $styleNs = New-Object System.Xml.XmlNamespaceManager($stylesXml.NameTable)
  $styleNs.AddNamespace("m", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  $fills = @()
  foreach ($fill in $stylesXml.SelectNodes("//m:fills/m:fill", $styleNs)) {
    $fg = $fill.SelectSingleNode(".//m:fgColor", $styleNs)
    $fills += [pscustomobject]@{
      Rgb = if ($fg) { [string]$fg.GetAttribute("rgb") } else { "" }
      Indexed = if ($fg) { [string]$fg.GetAttribute("indexed") } else { "" }
      Theme = if ($fg) { [string]$fg.GetAttribute("theme") } else { "" }
    }
  }

  $cellFillIds = @()
  foreach ($xf in $stylesXml.SelectNodes("//m:cellXfs/m:xf", $styleNs)) {
    $cellFillIds += [int]$xf.fillId
  }

  $clientRows = Read-SheetRows $zip "xl/worksheets/sheet3.xml" $sharedStrings $cellFillIds $fills
  $orderRows = Read-SheetRows $zip "xl/worksheets/sheet4.xml" $sharedStrings $cellFillIds $fills

  $customers = @()
  foreach ($row in $clientRows) {
    if ($row.row -eq 1) {
      continue
    }

    $code = Clean-CellValue (Get-MapValue $row.cells "A")
    $lastName = Clean-CellValue (Get-MapValue $row.cells "B")
    $firstName = Clean-CellValue (Get-MapValue $row.cells "C")
    $middleName = Clean-CellValue (Get-MapValue $row.cells "D")
    $name = (@($lastName, $firstName, $middleName) | Where-Object { $_ }) -join " "
    if (-not $name -and -not $code) {
      continue
    }

    $customers += [pscustomobject]@{
      sourceRow = $row.row
      code = $code
      name = if ($name) { $name } else { $code }
      phone = Clean-CellValue (Get-MapValue $row.cells "E")
      username = Clean-CellValue (Get-MapValue $row.cells "F")
      email = Clean-CellValue (Get-MapValue $row.cells "G")
      country = Clean-CellValue (Get-MapValue $row.cells "H")
      city = Clean-CellValue (Get-MapValue $row.cells "I")
    }
  }

  $orders = @()
  foreach ($row in $orderRows) {
    if ($row.row -eq 1) {
      continue
    }

    $number = Clean-CellValue (Get-MapValue $row.cells "B")
    if (-not $number) {
      continue
    }

    $orangeYellowPair = $false
    $orangePair = $false
    $cols = @("A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG")
    for ($i = 0; $i -lt ($cols.Count - 1); $i++) {
      $left = [string](Get-MapValue $row.colors $cols[$i])
      $right = [string](Get-MapValue $row.colors $cols[$i + 1])
      if ($left -eq "FFFFC000" -and $right -eq "FFFFC000") {
        $orangePair = $true
      }
      if (($left -eq "FFFFC000" -and $right -eq "FFFFFF00") -or ($left -eq "FFFFFF00" -and $right -eq "FFFFC000")) {
        $orangeYellowPair = $true
      }
    }

    $parcelRaw = Clean-CellValue (Get-MapValue $row.cells "S")
    $parcelNumber = Get-ParcelNumberFromText $parcelRaw
    $paymentMark = Clean-CellValue (Get-MapValue $row.cells "R")
    $paymentFill = [string](Get-MapValue $row.colors "R")
    $isPaid = $paymentMark -eq "+"
    $parcelLooksValid = $null -ne $parcelNumber

    $saleDateRaw = Clean-CellValue (Get-MapValue $row.cells "W")

    $orders += [pscustomobject]@{
      sourceRow = $row.row
      orderNumber = $number
      lr = Clean-CellValue (Get-MapValue $row.cells "C")
      sourceInfo = Clean-CellValue (Get-MapValue $row.cells "D")
      itemName = Clean-CellValue (Get-MapValue $row.cells "E")
      packageCount = Convert-ToInt (Get-MapValue $row.cells "F")
      insuranceUsd = Convert-ToNumber (Get-MapValue $row.cells "G")
      weightKg = Convert-ToNumber (Get-MapValue $row.cells "H")
      consolidationUsd = Convert-ToNumber (Get-MapValue $row.cells "J")
      packagingUsd = Convert-ToNumber (Get-MapValue $row.cells "K")
      totalUsd = Convert-ToNumber (Get-MapValue $row.cells "L")
      calculationUsd = Convert-ToNumber (Get-MapValue $row.cells "M")
      exchangeRateCnyPerUsd = Convert-ToNumber (Get-MapValue $row.cells "N")
      localDeliveryCny = Convert-ToNumber (Get-MapValue $row.cells "O")
      discountCny = Convert-ToNumber (Get-MapValue $row.cells "P")
      totalCny = Convert-ToNumber (Get-MapValue $row.cells "Q")
      paymentMark = $paymentMark
      paymentFill = $paymentFill
      isPaid = $isPaid
      parcelNumber = $parcelNumber
      parcelRaw = $parcelRaw
      parcelNumberLooksValid = $parcelLooksValid
      supplierCostCny = Convert-ToNumber (Get-MapValue $row.cells "T")
      profitCny = Convert-ToNumber (Get-MapValue $row.cells "U")
      saleDate = Convert-ToDateIso $saleDateRaw
      saleDateRaw = $saleDateRaw
      recipientName = Clean-CellValue (Get-MapValue $row.cells "X")
      recipientAddress = Clean-CellValue (Get-MapValue $row.cells "Y")
      recipientPhone = Clean-CellValue (Get-MapValue $row.cells "Z")
      site = Clean-CellValue (Get-MapValue $row.cells "AA")
      routePrefix = Clean-CellValue (Get-MapValue $row.cells "AE")
      routeNumber = Clean-CellValue (Get-MapValue $row.cells "AF")
      routeCountry = Clean-CellValue (Get-MapValue $row.cells "AG")
      orangePair = $orangePair
      orangeYellowPair = $orangeYellowPair
    }
  }

  $payload = [pscustomobject]@{
    source = [pscustomobject]@{
      workbook = $WorkbookPath
      generatedAt = (Get-Date).ToString("o")
      customersSheet = Convert-FromUtf8Base64 "0JrQu9C40LXQvdGC0Ys="
      ordersSheet = "ALL 6"
    }
    customers = $customers
    orders = $orders
  }

  $outputDir = Split-Path $OutputPath -Parent
  if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
  }

  $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Host "Extracted $($customers.Count) customers and $($orders.Count) orders to $OutputPath"
} finally {
  $zip.Dispose()
}
