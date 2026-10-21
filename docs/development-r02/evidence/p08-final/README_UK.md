# Незалежне читання експортів P08

1.40.0 / 20fd3cb17a71. [Протокол читачів](reader-report.json): 91 файл,
33 138 клітинок; openpyxl 3.1.5, xlrd 2.0.2, odfpy 1.4.1 та Python CSV.
[Сирий маніфест](manifest.json) зберігає документи, очікувані значення та SHA-256;
його первинні `file` вказують на локальну папку `.release/development-r02/p08-final`.
Для повторного читання архівної копії створіть тимчасовий manifest і замініть
`file` на шлях цієї папки з тим самим basename. Сирий manifest не переписуйте.
Генератор і читач: scripts/audit-steam97-p08.mjs та
scripts/reference/spreadsheet_readers.py у корені репозиторію.
