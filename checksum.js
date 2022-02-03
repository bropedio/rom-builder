'use strict';

var fs = require('fs');
var path = process.argv[2];

var buffer = fs.readFileSync(path);
var sum = 0;
var i;

for (i = 0; i < 0x200000; i++) {
  sum += buffer[i];
}
for (i = 0x200000; i < 0x300000; i++) {
  sum += buffer[i] + buffer[i];
}

var checksum = sum & 0xFFFF;

console.log('Checksum', checksum.toString(16));
console.log('Inverse', (checksum ^ 0xFFFF).toString(16));
