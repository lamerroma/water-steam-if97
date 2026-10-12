export const TOOL_CATALOG={
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
  "exchanger": {
    "status": "educational",
    "aliases": "теплообмінник площа heat exchanger area lmtd",
    "legacy": 24
  },
  "tutorials": {
    "status": "educational",
    "aliases": "приклад контроль навчання example tutorial",
    "legacy": 18
  },
  "laboratory": {
    "status": "educational",
    "aliases": "лабораторна вимірювання похибка uncertainty measurements lab",
    "legacy": 26
  },
  "coursework": {
    "status": "mixed",
    "aliases": "контрольна курсова ступінь лопаткова потужність трикутники твел твз активна зона реактор coursework stage velocity triangles fuel rod reactor core",
    "legacy": 27
  },
  "npp": {
    "status": "educational",
    "aliases": "аес реактор ввер контур nuclear npp vver reactor",
    "legacy": 21
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
 if(action==='coursework'&&inputs.kind==='core')return 'provisional';
 if(action==='coursework'&&['rankine','stage'].includes(inputs.kind))return 'educational';
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
