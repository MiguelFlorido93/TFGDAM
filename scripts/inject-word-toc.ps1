# Inyecta un campo TOC nativo de Word en MEMORIA.docx justo después
# del encabezado "Índice". Word lo rellenará al hacer Actualizar campos.
param(
    [string]$DocxPath = "docs\MEMORIA.docx"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$abs   = (Resolve-Path $DocxPath).Path
$tmp   = Join-Path $env:TEMP ("docx-toc-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($abs, $tmp)

$docXmlPath = Join-Path $tmp 'word\document.xml'
$xml = Get-Content $docXmlPath -Raw -Encoding UTF8

# Localizar el párrafo del encabezado "Índice" (Heading2)
# Se compone la palabra con codepoints para evitar problemas de encoding del .ps1
$indice = [char]0x00CD + 'ndice'  # "Índice"
$pattern = '<w:p[^>]*>(?:(?!</w:p>).){0,2000}' + [regex]::Escape($indice) + '(?:(?!</w:p>).){0,500}</w:p>'
$re = [regex]$pattern
$m  = $re.Match($xml)
if (-not $m.Success) { throw "No se encontro el parrafo de '$indice' en document.xml" }

$placeholder = 'Haz clic derecho aqu' + [char]0x00ED + ' y elige "Actualizar campos" para generar el ' + [char]0x00ED + 'ndice.'
$tocFieldXml = '<w:p><w:pPr><w:pStyle w:val="TOC1" /></w:pPr><w:r><w:fldChar w:fldCharType="begin" w:dirty="true" /></w:r><w:r><w:instrText xml:space="preserve"> TOC \o "1-3" \h \z \u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate" /></w:r><w:r><w:t xml:space="preserve">' + $placeholder + '</w:t></w:r><w:r><w:fldChar w:fldCharType="end" /></w:r></w:p>'

$insertAt = $m.Index + $m.Length
$newXml   = $xml.Substring(0, $insertAt) + $tocFieldXml + $xml.Substring($insertAt)

# Conservar encoding UTF-8 sin BOM
[System.IO.File]::WriteAllText($docXmlPath, $newXml, (New-Object System.Text.UTF8Encoding($false)))

# Re-empaquetar (borrar el destino, comprimir el directorio)
Remove-Item $abs -Force
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $abs)
Remove-Item $tmp -Recurse -Force

Write-Output "TOC inyectado en $abs"
