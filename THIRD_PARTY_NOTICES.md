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
- `src/coefficients.js` — транскрипція таблиць коефіцієнтів з атрибуцією. Власний JS-код обчислює основні рівняння та похідні. WASM використовується для початкових наближень густини області 3, T(p,h), T(p,s) та тиску h–s, після чого перевіряються й уточнюються корені основних рівнянь.
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
- [IAPWS R10-06(2009), Revised Release on the Equation of State 2006 for H2O Ice Ih](https://iapws.org/public/documents/S1atB/Ice-Rev2009.pdf), © 2009 IAPWS. Власна транскрипція рівняння (1) і коефіцієнтів Table 2; звірено з усіма 16 контрольними величинами Table 6 у трьох точках (потрійна точка, точка плавлення при p₀, 100 K/100 МПа), відхилення в межах 1×10⁻⁶ відносно. Дозвіл на публікацію з атрибуцією на титульній сторінці release.
- [IAPWS R16-17(2018), Revised Release on the IAPWS Formulation 2017 for the Thermodynamic Properties of Heavy Water](https://iapws.org/relguide/Heavy.pdf), © 2018 IAPWS. Власна транскрипція рівнянь (6)-(7) і коефіцієнтів Tables 1-2; звірено з контрольними величинами офіційних Tables 6-8 (похідні енергії Гельмгольца, однофазні p/cv/w/s та насичення p/ρ/h/s через критерій Максвелла) — 44 значення в 6 точках від 280 K до 643,8 K, відхилення в межах 1×10⁻⁶ відносно. Дозвіл на публікацію з атрибуцією на титульній сторінці release.

## Незалежний інструмент перевірки

Python iapws 1.5.5 (Juan José Gómez Romera, GPL-3.0, https://github.com/jjgomera/iapws) використано лише в окремому тимчасовому Python-середовищі для числової звірки. Його код, SciPy та NumPy не включені до репозиторію або HTML. tests/fixtures/independent-iapws.json містить згенеровані числові результати з метаданими; scripts/reference-iapws.py — власна обгортка. Звичайна збірка та тести не потребують цього інструменту.

## Власне ядро IAPWS-95

[IAPWS R6-95(2018)](https://iapws.org/technical-guidance/release/IAPWS-95), © 2018 IAPWS: власна транскрипція рівнянь (4)–(6) та таблиць 1–3. Дозвіл на публікацію з атрибуцією зазначений на першій сторінці release. Нових runtime-бібліотек немає. [SR1-86(1992)](https://iapws.org/technical-guidance/supplementary-release/SatProp) — початкові наближення густин насичення, не кінцеві результати. [R14-08(2011)](https://iapws.org/technical-guidance/release/MeltSub) — перевірка межі плавлення за рівняннями (3)–(4).

Python iapws 1.5.5 / IAPWS95 використано лише для зовнішньої числової звірки 21 стану; код бібліотеки не скопійовано та не включено.


## NASA7 / Cantera data

11 наборів коефіцієнтів з `data/nasa_gas.yaml` Cantera, commit **e906c2f9341413412ab4d455d1e3977a5d2f3102**:
https://raw.githubusercontent.com/Cantera/cantera/e906c2f9341413412ab4d455d1e3977a5d2f3102/data/nasa_gas.yaml

SHA-256 джерела: `4de6199d65d2d3db782e30573720c723130953707336add59713b02d8667e4db`. Header посилається на McBride, Gordon, Reno, NASA TM-4513 (1993), https://ntrs.nasa.gov/citations/19940013151. Відібрано лише погоджені 11 компонентів; значення коефіцієнтів збережені. Молярні маси — Cantera 3.2.0. Алгоритм NASA7: https://cantera.org/stable/reference/thermo/species-thermo.html.

Cantera: BSD-3-Clause; повний notice `vendor/CANTERA-LICENSE` включено також у готовий HTML. Авторські права Caltech, Sandia National Laboratories, Cantera Developers. Власна реалізація рівнянь у `src/gases.js`; Cantera, PyYAML та NumPy у runtime не входять. Відтворення даних/контролів — власний `scripts/reference-cantera.py`, який перевіряє SHA-256 перед читанням зовнішнього YAML. Дані описують ідеальні гази, не рівняння стану реальних газів.

## CoolProp audit

CoolProp 8.0.0, MIT (https://github.com/CoolProp/CoolProp/blob/master/LICENSE), використаний лише зовнішнім оракулом. Його код не скопійовано до репозиторію чи HTML. `scripts/reference-coolprop.py` — власна обгортка; `tests/fixtures/coolprop.json` — отримані числові значення. Це другий інструмент водяної перевірки поряд із Python iapws, а не друге runtime-ядро.

Наукові транспортні поправки: власна транскрипція R12-08 Eqs. (14)–(21), R15-11 Eqs. (18)–(23), з опорною похідною IAPWS-95. Офіційні контрольні значення таблиць 5 обох Releases використано з атрибуцією IAPWS.
