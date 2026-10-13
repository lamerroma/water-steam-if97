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
