$testCases = @(
    "20-10-2026",
    "Tue Oct 20 2026 12:30:00 GMT+0530 (India Standard Time)",
    "Wed Oct 21 2026 12:30:00 GMT+0530 (India Standard Time)",
    "21-10-2026",
    "19-10-2026",
    "18-10-2026",
    "7-1-1900",
    "1",
    "2026-10-20"
)

foreach ($c in $testCases) {
    $res = $null
    if ($c -match "^\d{2}-\d{2}-\d{4}$") {
        $res = $c
    } elseif ($c -match "GMT" -or $c -match "India Standard Time") {
        $clean = $c.Replace("GMT+0530 (India Standard Time)", "+05:30")
        $res = ([DateTime]::Parse($clean)).ToString("dd-MM-yyyy")
    } elseif ($c -match "^(\d{4})-(\d{2})-(\d{2})") {
        $res = "$($Matches[3])-$($Matches[2])-$($Matches[1])"
    } else {
        $res = "NEEDS_SNOWFLAKE"
    }
    Write-Host "$c -> $res"
}
