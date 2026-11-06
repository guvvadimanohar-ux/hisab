const assert=require('node:assert/strict');
const{normalise}=require('../tools/charts/data.cjs');
assert.deepEqual(normalise({periods:[{period:'2026-10',inflow:'256967',outflow:176087}]}),[{month:'2026-10',inflow:256967,outflow:176087}]);
assert.equal(normalise([{period:'x',inflow:0,outflow:0}])[0].inflow,0);
assert.deepEqual(normalise({periods:'invalid'}),[]);
assert.deepEqual(normalise([{inflow:Infinity,outflow:NaN}]),[{month:'',inflow:0,outflow:0}]);
const months=Array.from({length:12},(_,i)=>({month:String(i),inflow:i+0.5,outflow:1}));
assert.equal(normalise(months).length,6);assert.equal(normalise(months)[0].month,'6');assert.equal(normalise(months)[0].inflow,6.5);
console.log('PASS: real chart amounts, empty/malformed data, non-finite values and latest-six-month selection.');
