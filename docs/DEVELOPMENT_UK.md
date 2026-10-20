# Розробка та чистота репозиторію

## Структура

| Шлях | Призначення |
| --- | --- |
| src/ | Вихідні модулі, шаблон, стилі, Service Worker та іконки |
| vendor/ | Зафіксовані сторонні джерела, WASM, wheels і ліцензії |
| scripts/ | Збірка, пакетування, перевірки та відтворення еталонів |
| tests/ | Модульні тести й контрольні фікстури |
| assets/, index.html, manifest.webmanifest, service-worker.js | Згенерована PWA в корені |
| dist/ | Згенерована копія PWA для публікації Pages |
| docs/ | Інструкції, контракти, датовані звіти та докази |
| .release/ | Ігноровані локальні журнали, тимчасові профілі й архіви перевірок |

Копії ресурсів у vendor/, assets/ і dist/ мають різне призначення. Це поточні
залежності та результати збірки, а не старі файли. У цій структурі готові PWA
артефакти відстежуються Git; CI перевіряє їхню відповідність вихідним файлам.
Редагуйте src/ і виконуйте build, а не правте згенерований JavaScript вручну.

## Збірка й запуск

Для приймання CI використовує Node.js 22 та Python 3.12. Звичайні build і
модульні тести не потребують встановлення npm-залежностей.

```sh
npm run build
npm test
npm run check:docs
npm run serve
```

Локальна адреса: http://localhost:8080/. Сервер лише віддає статичні файли.
Для повного локального офлайн-комплекту після build виконайте npm run package.
Згенерований dist/water-steam-calculator.zip не відстежується Git.

## Повне приймання

```sh
npm install --no-save --package-lock=false playwright@1.64.1
npx playwright install --with-deps chromium firefox
python -m pip install -r scripts/reference/requirements-p08.txt
npm run verify:release
```

Звіт створюється в .release/ДАТА/report.json. core-режим виконує
verify:release:core; браузерний режим — npm run verify:release -- --browser-only.
Ці часткові режими не замінюють повного приймання.

Якщо потрібний інтерпретатор доступний як python, а python3 у Windows є
лише системним псевдонімом, перед запуском у PowerShell задайте:

```powershell
$env:REACTOR_PYTHON = (Get-Command python).Source
```

Для незалежних аудиторів можна також задати P03_PYTHON, P04_PYTHON,
P08_PYTHON і P09_PYTHON шляхом до того самого підготовленого Python.
Нестандартний шлях Playwright передається через PLAYWRIGHT_MODULE_PATH.
Канонічні команди CI містяться в
[release-checks.yml](../.github/workflows/release-checks.yml).

## Що прибирати

- Разові журнали, профілі браузера й тимчасові архіви зберігайте в .release/.
- Старі кореневі test-results.txt та docs/test-results.txt вилучено:
  вони містили 546 і 259 тестів та не описували поточне приймання.
- standalone.html і dist/standalone.html — застарілі артефакти; build прибирає
  їх після оновлення старого checkout, а package-тест перевіряє їх відсутність.
- Датовані докази, еталонні фікстури, генератори та ліцензії залишайте:
  невдала первинна спроба може бути частиною пояснення остаточного результату.

npm run check:docs перевіряє локальні Markdown-посилання в кореневих
документах та docs/. Зовнішні вебсторінки й якорі всередині файлів ця команда
не перевіряє. Повне приймання включає цей самий контроль.
