
Add-Type -AssemblyName System.Windows.Forms
$col = New-Object System.Collections.Specialized.StringCollection
$col.Add('C:\Users\balee\Desktop\master lab app\temp\invoice_1787687608721.pdf')
[System.Windows.Forms.Clipboard]::SetFileDropList($col)
