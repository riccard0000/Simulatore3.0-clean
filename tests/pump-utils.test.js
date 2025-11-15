const assert = require('assert');
const { detectPumpFlags } = require('../tools/pump-utils.js');

console.log('Running pump-utils tests...');

// fixed double duct should require COP and GWP
let flags = detectPumpFlags('aria/aria fixed double duct');
assert(flags.needsCop === true, 'fixed double duct should set needsCop true');
assert(flags.needsGwp === true, 'fixed double duct should set needsGwp true');

// split/multisplit requires GWP but not COP
flags = detectPumpFlags('aria/aria split/multisplit');
assert(flags.needsCop === false);
assert(flags.needsGwp === true);

// vrf/vrv neither
flags = detectPumpFlags('aria/aria VRF/VRV');
assert(flags.needsCop === false);
assert(flags.needsGwp === false);

// salamoia/aria needs GWP
flags = detectPumpFlags('salamoia/aria');
assert(flags.needsGwp === true);

console.log('pump-utils tests passed.');
