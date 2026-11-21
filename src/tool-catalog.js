export const TOOL_CATALOG={
  libraries:{status:'experimental',aliases:'CoolProp HEOS IAPWS water вода ht fluids python scipy numpy тепловіддача гідравліка кореляції бібліотеки heat transfer hydraulics correlations libraries'},
  'custom-cycle':{status:'educational',aliases:'довільний цикл редактор замикання баланс ККД Карно точки процеси custom cycle editor closure balance efficiency Carnot'},
  'water-process':{status:'educational',aliases:'ізобарний ізохорний ізотермічний ізоентропний ізоентальпійний політропний газ повітря NASA7 тепло робота isenthalpic polytropic ideal gas water process heat work isobaric isochoric isothermal isentropic'},
  "general": {
    "status": "reference",
    "aliases": "температура тиск ентальпія густина теплоємність волога пара pressure temperature density enthalpy",
    "legacy": 1
  },
  "saturation": {
    "status": "reference",
    "aliases": "кипіння сухість boiling quality wet steam",
    "legacy": 2
  },
  "satgrid": {
    "status": "reference",
    "aliases": "таблиця довідник saturation table",
    "legacy": 19
  },
  "functions": {
    "status": "reference",
    "aliases": "функції формули формула вираз таблиця функцій розширення ккд похідні pkw заломлення functions formula expression wsp watersteampro excel series range expansion efficiency derivative",
    "legacy": null
  },
  "gases": {
    "status": "mixed",
    "aliases": "повітря азот кисень газ carbon dioxide nitrogen oxygen air",
    "legacy": 9
  },
  "humid": {
    "status": "reference",
    "aliases": "психрометрія вологість точка роси psychrometric humidity dew point",
    "legacy": 10
  },
  "ice": {
    "status": "reference",
    "aliases": "замерзання крига ice freezing",
    "legacy": 12
  },
  "d2o": {
    "status": "reference",
    "aliases": "дейтерій deuterium d2o",
    "legacy": 13
  },
  "seawater": {
    "status": "reference",
    "aliases": "солоність сіль seawater salinity salt",
    "legacy": 14
  },
  "boundaries": {
    "status": "reference",
    "aliases": "плавлення сублімація замерзання melting sublimation",
    "legacy": 15
  },
  "comparison": {
    "status": "reference",
    "aliases": "точність похибка if97 iapws accuracy difference",
    "legacy": 16
  },
  "turbine": {
    "status": "educational",
    "aliases": "потужність турбіни ккд витрата турбіна steam turbine efficiency power",
    "legacy": 3
  },
  "flash": {
    "status": "educational",
    "aliases": "випаровування дроселювання flash evaporation",
    "legacy": 4
  },
  "engineering": {
    "status": "educational",
    "aliases": "насос компресор теплообмінник pump compressor heat exchanger",
    "legacy": 8
  },
  "cycles": {
    "status": "educational",
    "aliases": "ренкін брайтон цикл ккд циклу rankine brayton cycle reheat regeneration",
    "legacy": 11
  },
  "ts": {
    "status": "visual",
    "aliases": "графік ентропія diagram chart entropy",
    "legacy": 5
  },
  "hsdiagram": {
    "status": "visual",
    "aliases": "графік ентальпії мольє молльє ентальпія mollier enthalpy diagram",
    "legacy": 6
  },
  "phdiagram": {
    "status": "visual",
    "aliases": "тиск ентальпія pressure enthalpy chart",
    "legacy": 20
  },
  "flow": {
    "status": "educational",
    "aliases": "reynolds рейнольдс втрати тиску тертя діаметр pipe pressure drop friction",
    "legacy": 17
  },
  "steam-system": {
    "status": "provisional",
    "aliases": "пара паропровід конденсат конденсатовідвідник клапан kv cv діафрагма сопло витікання сепаратор сухість повітря котел ккд вартість пари окупність steam pipe sizing condensate trap valve orifice leak separator dryness boiler efficiency cost payback tlv",
    "legacy": null
  },
  "power-plant": {
    "status": "provisional",
    "aliases": "турбіна сопло лаваля критичний тиск ступінь трикутники швидкостей u/cf лопатки ккд вологість баумана енергоблок тес аес пгу парогазова котел-утилізатор піч-точка t-q парогенератор ввер тец теплофікація температурний графік тепломережа конденсатор вакуум градирня меркеля теплова схема регенерація підігрівачі пвд пнд деаератор спп к-1000 к-300 turbine nozzle laval critical pressure stage velocity triangles blade efficiency moisture baumann power plant combined cycle hrsg pinch steam generator chp district heating condenser cooling tower merkel thermal scheme feedwater heaters deaerator",
    "legacy": null
  },
  "channel": {
    "status": "provisional",
    "aliases": "двофазний потік паровміст об'ємний паровміст втрати тиску локхарт мартінеллі фрідель кипіння чен том єнс лоттес криза теплообміну ктп dnbr запас реактор твел канал парогенератор two-phase void fraction pressure drop lockhart martinelli friedel boiling chen thom jens lottes critical heat flux chf biasi zuber reactor channel",
    "legacy": null
  },
  "exchanger": {
    "status": "educational",
    "aliases": "теплообмінник площа heat exchanger area lmtd",
    "legacy": 24
  },
  "research": {
    "status": "educational",
    "aliases": "залежність оптимізація дослідження sensitivity parameter study",
    "legacy": 23
  },
  "help": {
    "status": "workflow",
    "aliases": "довідка інструкція джерела documentation help sources",
    "legacy": null
  },
  "projects": {
    "status": "workflow",
    "aliases": "зберегти імпорт файл json save backup import project",
    "legacy": 25
  },
  "study": {
    "status": "workflow",
    "aliases": "звіт друк pdf результати report print export",
    "legacy": 22
  },
  "batch": {
    "status": "reference",
    "aliases": "пакет таблиця csv серія batch table series",
    "legacy": 7
  }
};

export function toolStatus(action,inputs={}){
 if(action==='gases'&&inputs.model==='real')return 'reference';
 if(action==='gases'&&inputs.model==='mixture')return 'experimental';
 if(action==='gases'&&inputs.model==='ideal')return 'educational';
 return TOOL_CATALOG[action]?.status||'workflow';
}
export function toolMatches(query,action,label=''){
 if(!Object.hasOwn(TOOL_CATALOG,action))return false;const meta=TOOL_CATALOG[action];
 const normal=v=>String(v).normalize('NFKC').toLocaleLowerCase().replace(/[’'ʼ]/g,'');
 const text=normal([label,action,meta.aliases,meta.legacy==null?'':meta.legacy+'.'].join(' '));
 return normal(query).trim().split(/\s+/).filter(Boolean).every(word=>text.includes(word));
}
