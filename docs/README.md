# Документація

Актуальна програма — багатофайлова PWA. Номер версії задає
[`package.json`](../package.json), запущену збірку видно внизу сторінки.
[Підтверджений стан публікації 1.39.0](RELEASE_STATUS_UK.md).

## Користування

| Завдання | Інструкція |
| --- | --- |
| Почати розрахунок, вибрати одиниці, зберегти проєкт | [Швидкий старт](QUICK_START_UK.md) |
| Установити програму, підготувати офлайн, оновити | [PWA](PWA_UK.md) |
| Відновити пошкоджений локальний проєкт | [Відновлення проєктів](PROJECT_RECOVERY_UK.md) |
| Підготувати ht / fluids і викликати Python API | [Бібліотеки](PYTHON_LIBRARIES_UK.md) |
| Порівняти втрати тиску та потужність із fluids | [Трубопровід](FLUIDS_PIPE_UK.md) |

## Моделі й межі

- [Газові таблиці BSW2003 / P03](STEAMTABLES_P03_UK.md).
- [Дослідна калорична поправка дисоціації / P04](STEAMTABLES_P04_UK.md)
  та [машиночитаний контракт](steam97-p04/contract.json).
- [Матриця Steam97Web](STEAMTABLES_PARITY_MATRIX.json),
  [план відповідності](STEAMTABLES_PARITY_SPRINTS_UK.md),
  [стратегія продукту](PRODUCT_STRATEGY_UK.md).
- [Перевірка реакторної комірки](REACTOR_CELL_VALIDATION_UK.md)
  та [розбір нейтронної моделі](REACTOR_MODEL_REVIEW_UK.md).
- [Ліцензії та атрибуція](../THIRD_PARTY_NOTICES.md).

## Розробка й актуальні перевірки

- [Структура репозиторію, команди й правила прибирання](DEVELOPMENT_UK.md).
- [Архітектура PWA](PWA_ARCHITECTURE_UK.md),
  [протокол обчислювальних модулів](CALCULATION_MODULES_UK.md).
- [План повного покриття ht / fluids](HT_FLUIDS_INTEGRATION_UK.md).
- [Числове приймання трубопроводу](FLUIDS_PIPE_ACCEPTANCE_UK.md),
  [приймання Python-інтеграції](PYTHON_LIBRARIES_ACCEPTANCE_UK.md),
  [вимірювання старту](STARTUP_OPTIMIZATION_UK.md).
- [GitHub Actions](https://github.com/lamerroma/water-steam-if97/actions)
  і [журнал змін](../CHANGELOG.md).
- [Протокол прибирання репозиторію](REPOSITORY_CLEANUP_UK.md).

## Історичні матеріали

Спринтові звіти, ACCEPTANCE JSON та каталоги доказів описують конкретні версії,
дати й середовища. Старі згадки standalone.html, file://, кількості тестів,
локальних шляхів і невдалих спроб не є інструкцією для поточного релізу.
Поточний запуск описано в PWA_UK.md, поточні команди — у DEVELOPMENT_UK.md.

[VALIDATION.md](VALIDATION.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
та [RELEASE_PLAN_UK.md](RELEASE_PLAN_UK.md) збережено як історію перевірок.
Повторні запуски та первинні відмови зберігаються разом: вони пояснюють межі
приймання. Генератори еталонів, вихідні дані та сторонні ліцензії також потрібні
для відтворення, навіть якщо не виконуються при звичайному запуску програми.

Попередній розгорнутий README доступний
[у Git-історії](https://github.com/lamerroma/water-steam-if97/blob/a5d8a0759c4a0c10c803679b7818fb33af31332c/README.md).
