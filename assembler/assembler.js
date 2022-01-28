"use strict";

const fs = require('fs');
const ops = require('./ops');
const { tokenize } = require('./lexer');
const instructions = require('./instructions');

class Label {
  constructor () {

  }
}

class Assembler {
  constructor (real_rom) {
    this.real_rom = real_rom;
    this.rom = new real_rom.constructor([]);
    this.variables = new Map();
    this.labels = new Map();
    this.padbyte = 0xFF;
  }

  load (path) {
    const asm = fs.readFileSync(path);
    const parsed = this.parse(asm);
  }

  parse (asm) {
    const lines = tokenize(asm);
    const refs = {};
    const defs = {};

    lines.forEach(line => {
      let i = 0;
      let length = line.length;

      const look = (n=1) => line[i + n] || {};
      const next = (n=1) => i += n && look(n);

      for (; i < length; ++i) {
        const curr = line[i];

        switch (curr.type) {
        case 'variable':
          if (look().type === 'assign') {
            this.variables.set(curr.value, next(2));
          } else if (this.variables.has(curr.value)) {
            let defined = this.variables.get(curr.value);
          } else {
            error(`Variable ${curr.value} not defined`); 
          }
          break;
        case 'label':
          this.labels.set(curr.value, []);
          break;
        case 'word':
          if (ops.has(curr.value)) {
            const op = ops.get(curr.value);
            op.validate(curr, line, i);
          } else if (instructions.has(curr.value)) {

          } else if (this.labels.has(curr.value)) {
            this.labels.get(curr.value).push(curr);
          } {

          }
        }
      }
    });
  }
}












module.exports = Assembler;
