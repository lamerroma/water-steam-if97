export function reactorCoverage(q){
 const a=q.input,neutron=!!q.neutronics;
 return [
 ['3.1–3.2','Входи, геометрія та розміри','Inputs, geometry and dimensions','computed'],
 ['3.3','Однофазний тепловий профіль і паливо','Single-phase thermal profile and fuel','computed'],
 ['3.3 boiling','Поверхневе кипіння','Subcooled boiling',a.boilingMethod==='off'?'disabled':q.profile.some(r=>r.boilingOutside)?'outside':'interpretation'],
 ['3.4','Запас до кризи теплообміну','Critical heat flux margin',a.chfMethod==='off'?'disabled':a.chfMethod==='candidate'?'interpretation':'correlation'],
 ['3.5','Гідравлічний опір','Hydraulic resistance','computed'],
 ['3.6','Середні температури','Mean temperatures','computed'],
 ['4.1–4.3','Збагачення, комірка, нейтронна температура','Enrichment, cell, neutron temperature',neutron?'approximation':'disabled'],
 ['4.4 resonance','Резонансний інтеграл і поправки','Resonance integral and corrections',!neutron?'disabled':a.resonanceMethod==='gp'?'approximation':'given'],
 ['4.4 boundary','Гранична поправка решітки','Lattice boundary correction',!neutron?'disabled':a.lattice==='square'?'given':'approximation'],
 ['4.4–4.5','k∞, витік і kеф','k∞, leakage and k_eff',neutron?'approximation':'disabled'],
 ['4.6','Кампанія, Pu та отруєння','Campaign, Pu and poisoning',neutron?'approximation':'disabled'],
 ['6','Стрижні та їх розташування','Rods and their layout',!neutron?'disabled':a.rodLayout==='effective'?'effective':'layout'],
 ['7','Елементний бор і H₃BO₃','Elemental boron and H₃BO₃',neutron?'approximation':'disabled']
 ];
}
export function reactorCoverageLabel(status,en=false){return ({computed:['Обчислено за обраними входами','Computed from selected inputs'],disabled:['Вимкнено','Disabled'],outside:['Поза областю кореляції','Outside correlation domain'],interpretation:['Явна інтерпретація; потрібна звірка','Explicit interpretation; verification required'],correlation:['Опублікована кореляція; застосовність потребує звірки','Published correlation; applicability needs verification'],approximation:['Навчальне наближення; потрібна звірка','Course approximation; verification required'],given:['Величина задана вручну','Manually supplied quantity'],effective:['Один ефективний радіус; задайте картограму','One effective radius; supply a layout'],layout:['Розрахунок заданої картограми; без моделі інтерференції','Specified layout calculated; no interference model']}[status]||[status,status])[en?1:0];}

// A tabulated data span is evidence of data coverage, not a validated fit domain.
export function reactorThermalEvidence(q,en=false){
 const t=(uk,eng)=>en?eng:uk,a=q.input,rows=[],N=x=>Number(x.toPrecision(7));
 for(const [material,method,low,high,outer,inner] of [
  ['clad',a.cladMethod,20,500,'cladOuter','cladInner'],
  ['gap',a.gapMethod,98.85,1198.9,'cladInner','fuelSurface'],
  ['fuel',a.fuelMethod,627,2427,'fuelSurface','fuelCenter']]){
  const means=q.profile.concat(q.meanProfile).map(r=>(r[outer]+r[inner])/2),min=Math.min(...means),max=Math.max(...means);
  rows.push([material,method,`${N(min)}…${N(max)} °C`,method==='guide'?t(`Табличні дані ${low}…${high} °C; це не підтверджені межі полінома. ${min<low||max>high?'Є вихід за табличні дані.':'Середні температури всередині табличних даних.'}`,`Tabulated data ${low}…${high} °C; not a validated polynomial domain. ${min<low||max>high?'Some values exceed tabulated data.':'Mean temperatures within tabulated data.'}`):t('Задана стала або контактна модель; не поліном методички.','Specified constant or contact model; not the guide polynomial.'),t('Надана методичка, §3.3, таблиці 3.6–3.8','Supplied guide §3.3, Tables 3.6–3.8')]);
 }
 rows.push([t('Паливо','Fuel'),q.geometry.hole>0?'annular':'solid',`r in/out = ${N(q.geometry.hole/q.geometry.df)}`,t('Рівномірне об’ємне джерело; адіабатичний отвір. Формула перевіряється незалежним інтегруванням радіального потоку.','Uniform volumetric source; adiabatic bore. Formula checked by independent radial heat-flow integration.'),t('Стаціонарне рівняння теплопровідності циліндра','Steady cylindrical heat equation')]);
 rows.push([t('Контакт / зазор','Contact / gap'),a.gapMethod,a.gapMethod==='contact'?`${a.contactConductance} W/(m² K)`:a.gapMethod==='perfect'?'ΔT = 0':`${a.gap} mm`,t('Задана модель; тепломеханіка, температурний стрибок газу й випромінювання не включені.','Specified model; thermomechanics, gas temperature jump and radiation omitted.'),'https://www.pnnl.gov/main/publications/external/technical_reports/PNNL-17644.pdf (§2.1.3)']);
 const p=q.profile.map(r=>r.p);
 rows.push([t('Кипіння','Boiling'),a.boilingMethod,`${N(Math.min(...p))}…${N(Math.max(...p))} MPa`,a.boilingMethod==='off'?t('Вимкнено','Disabled'):t('Базовий закон: 8…20 MPa, p у bar; у статті q^0,67, у методичці q^(2/3). Комбінований закон та початок кипіння — навчальна інтерпретація.','Base law: 8…20 MPa, p in bar; paper uses q^0.67, guide uses q^(2/3). Combined law and boiling onset remain a course interpretation.'),'https://journals.pan.pl/Content/84718?format_id=1 (Eq. 1)']);
 rows.push(['CHF',a.chfMethod,'fF = 1',a.chfMethod==='off'?t('Вимкнено','Disabled'):t('Гідропрес: запис формули звірено; числові межі та фізична точність не встановлені. Рівномірний нагрів кореляції відрізняється від косинусного профілю; кандидат 1.15.0 не підтверджений.','Gidropress: transcription checked; numerical validity bounds and physical accuracy not established. Uniform correlation heating differs from the cosine profile; the 1.15.0 candidate is unverified.'),'https://arxiv.org/html/2203.15048 (§4.2.4, Eq. 53); https://vant.kipt.kharkov.ua/ARTICLE/VANT_2021_5/article_2021_5_88.pdf (Eq. 15–16)']);
 const labels={clad:['Оболонка','Cladding'],gap:['Зазор','Gap'],fuel:['Паливо','Fuel']},methods={guide:['За методичкою','Guide'],constant:['Задана теплопровідність','Specified conductivity'],contact:['Заданий контакт','Specified contact'],perfect:['Ідеальний контакт','Perfect contact'],annular:['Кільцеве','Annular'],solid:['Суцільне','Solid'],off:['Вимкнено','Disabled'],gidropress:['Гідропрес','Gidropress'],candidate:['Непідтверджений кандидат','Unverified candidate']};
 return rows.map(([topic,method,...rest])=>[(labels[topic]||[topic,topic])[en?1:0],(methods[method]||[method,method])[en?1:0],...rest]);
}
