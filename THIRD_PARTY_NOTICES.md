# Атрибуція та ліцензії

## SEUIF97 / RustSEUIF97

- Автор: Cheng Maohua, © 2023.
- Ліцензія: MIT. Повний текст: `vendor/SEUIF97-LICENSE`.
- Репозиторій: https://github.com/thermalogic/RustSEUIF97
- Локально включено npm `seuif97@2.3.8`: незмінені `seuif97.js`, `seuif97_bg.wasm`, `seuif97.d.ts`.
- Пакет: https://registry.npmjs.org/seuif97/-/seuif97-2.3.8.tgz
- SHA-512 npm tarball (base64): `t4BjRHAr8OZK/vFzEeyIjbwmib/O4DRl6L6sht1pn1zb+14/g2sXNoNlQ51NGxvFgV7Wih1vcyJGL2QCniLaMA==`.
- Джерело коефіцієнтів: commit `aa0e15c242d24d078ea1a71f49185a697c163b18`; файли `src/r1/region1_gfe.rs`, `src/r2/region2_gfe.rs`, `src/r3/region3_hfe.rs`, `src/r5/region5_gfe.rs`, `src/common/transport_further.rs`.
- Ліцензію перевірено в `LICENSE` цього commit. npm metadata також вказує MIT; сам tarball не містив LICENSE, тому повний текст додано з upstream.
- `src/coefficients.js` — транскрипція таблиць коефіцієнтів з атрибуцією. Власний JS-код обчислює основні рівняння та похідні. WASM використовується для початкових наближень густини області 3 та тиску h–s, після чого перевіряються й уточнюються корені основних рівнянь.
- Під час локального пакування ES module exports/imports перетворюються на одну замкнену область видимості; WASM включається як base64. Згенерований HTML містить повні MIT license notices.

MIT дозволяє використання, модифікацію та розповсюдження, зокрема комерційне, за умови збереження повідомлення про авторські права і тексту дозволу. Жодних copyleft-залежностей у runtime немає.

## IAPWS

Формуляції та контрольні таблиці: **International Association for the Properties of Water and Steam (IAPWS)**.

- [R7-97(2012), Revised Release on the IAPWS Industrial Formulation 1997](https://iapws.org/technical-guidance/release/IF97-Rev), © 2007 IAPWS (редакційні зміни 2012).
- [R12-08, Viscosity of Ordinary Water Substance](https://iapws.org/technical-guidance/release/viscosity), © 2008 IAPWS.
- [R15-11, Thermal Conductivity of Ordinary Water Substance](https://iapws.org/technical-guidance/release/ThCond), © 2011 IAPWS.

- [R1-76(2014), Revised Release on Surface Tension of Ordinary Water Substance](https://iapws.org/technical-guidance/release/Surf-H2O), © 2014 IAPWS.

На титульних сторінках Releases дозволено публікацію повністю або частково із зазначенням IAPWS. Формуляції не є MIT-програмним кодом; їхня атрибуція зберігається окремо. Сайт і тести містять посилання та атрибуцію. Назва IAPWS не означає сертифікацію або схвалення цього калькулятора.

Системні шрифти; зовнішні зображення, іконкові пакети й бібліотеки UI не використовуються.

- [IAPWS R8-97, Static Dielectric Constant](https://iapws.org/technical-guidance/release/Dielec), © 1997 IAPWS. Власна транскрипція рівнянь (3)–(5), (7) і таблиць 1–2; офіційні константи цієї редакції збережені. Дозвіл на публікацію з атрибуцією перевірено на сторінці 1 release.

## Незалежний інструмент перевірки

Python iapws 1.5.5 (Juan José Gómez Romera, GPL-3.0, https://github.com/jjgomera/iapws) використано лише в окремому тимчасовому Python-середовищі для числової звірки. Його код, SciPy та NumPy не включені до репозиторію або HTML. tests/fixtures/independent-iapws.json містить згенеровані числові результати з метаданими; scripts/reference-iapws.py — власна обгортка. Звичайна збірка та тести не потребують цього інструменту.
