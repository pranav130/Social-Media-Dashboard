$testDates = @(
    "20-10-2026",
    "Tue Oct 20 2026 12:30:00 GMT+0530 (India Standard Time)",
    "Wed Oct 21 2026 12:30:00 GMT+0530 (India Standard Time)",
    "21-10-2026",
    "19-10-2026",
    "18-10-2026"
)

foreach ($td in $testDates) {
    if ($td -match "^\d{2}-\d{2}-\d{4}$") {
        Write-Host "ALREADY VALID: $td"
    } else {
        $parsed = [DateTime]::Parse($td.Replace("GMT+0530 (India Standard Time)", "+05:30"))
        Write-Host "CONVERTED: $td -> $($parsed.ToString('dd-MM-yyyy'))"
    }
}
