export function readDisplayDigits(value){if(value==null)return 8;if(![4,6,8].includes(value))throw Error('Кількість значущих цифр має бути 4, 6 або 8.');return value;}
export function formatProperty(value,digits=8){return Number.isFinite(value)?new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:readDisplayDigits(digits),notation:Math.abs(value)>0&&Math.abs(value)<1e-4?'scientific':'standard'}).format(value):'—';}
export function propertyUnavailableReason(key,state){
 if(!state)return '';
 if(key==='region'&&state.model==='IAPWS-95')return 'IAPWS-95 не поділяється на області IF97.';
 if(key==='x')return state.critical?'У критичній точці сухість невизначена.':'Сухість визначається для рівноваги рідина–пара.';
 if(key==='sigma')return 'Потрібна рівноважна межа рідина–пара на насиченні.';
 if(state.critical)return 'У критичній точці ця величина не наведена через сингулярність або невизначену похідну.';
 if(state.x>0&&state.x<1)return 'Для двофазної суміші ця величина не визначається усередненням властивостей фаз.';
 if(key==='dc')return 'Діелектрична проникність недоступна: потрібні допустимі температура (238…873 K) і густина.';
 if(['mu','nu','lambda','diffusivity','Pr'].includes(key))return state.model==='IAPWS-95'?'Поза реалізованим діапазоном транспортних властивостей IAPWS-95: T ≤ 1173 K, P ≤ 100 МПа.':'Поза реалізованим діапазоном транспортних властивостей або недоступна опорна величина.';
 return 'Для цього стану модель не наводить значення.';
}
export const INPUT_MODE_LABELS={pt:'Тиск + температура (P–T)',ph:'Тиск + ентальпія (P–h)',ps:'Тиск + ентропія (P–s)',pv:'Тиск + питомий об’єм (P–v)',pu:'Тиск + внутрішня енергія (P–u)',th:'Температура + ентальпія (T–h)',ts:'Температура + ентропія (T–s)',tv:'Температура + питомий об’єм (T–v)',tu:'Температура + внутрішня енергія (T–u)',hs:'Ентальпія + ентропія (h–s)',us:'Внутрішня енергія + ентропія (u–s)',vs:'Питомий об’єм + ентропія (v–s)',hv:'Ентальпія + питомий об’єм (h–v)',uv:'Внутрішня енергія + питомий об’єм (u–v)',satp:'Насичення за тиском',satt:'Насичення за температурою',px:'Тиск + сухість (P–x)',tx:'Температура + сухість (T–x)',prho:'Тиск + густина (P–ρ)',trho:'Температура + густина (T–ρ)'};
