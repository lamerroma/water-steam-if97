import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagramQuantity} from '../src/diagram-units.js';
test('diagram Celsius offsets, entropy and energy labels match selected units',()=>{assert.deepEqual(diagramQuantity('T',0,'english'),[32,'°F']);assert.ok(Math.abs(diagramQuantity('s',4.1868,'english')[0]-1)<1e-14);assert.deepEqual(diagramQuantity('h',500,'si','J'),[500000,'Дж/кг']);assert.equal(diagramQuantity('T',null,'english')[0],null);});
