$url = "https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=598922870"
$csv = Invoke-RestMethod -Uri $url
$lines = $csv -split "`n"
$counts = @{}
for ($i = 2; $i -lt $lines.Count; $i++) {
    $row = $lines[$i]
    if ([string]::IsNullOrWhiteSpace($row)) { continue }
    $cols = $row -split ","
    $val = $cols[0].Trim('"', " ")
    if ($counts.ContainsKey($val)) {
        $counts[$val]++
    } else {
        $counts[$val] = 1
    }
}
$counts.GetEnumerator() | Sort-Object Value -Descending | Format-Table -AutoSize
