"use strict";

function catreg (...regexes) {
  return new RegExp(regexes.reduce((sum, regex) => {
    return sum + regex.source;
  }, ''));
}

const modes = [{
  name: 'indirect_x',
  text: 'DP Indexed Indirect, X',
  pattern: '(dp,X)'
}, {
  name: 'stack',
  text: 'Stack Relative',
  pattern: 'sr,S'
}, {
  name: 'direct',
  text: 'Direct Page',
  pattern: 'dp'
}, {
  name: 'indirect_long',
  text: 'Indirect Long',
  pattern: '[dp]'
}, {
  name: 'absolute_indirect_long',
  text: 'Absolute Indirect Long',
  pattern: '[addr]'
}, {
  name: 'immediate',
  text: 'Immediate',
  pattern: '#const'
}, {
  name: 'absolute',
  text: 'Absolute',
  pattern: 'addr'
}, {
  name: 'absolute_long',
  text: 'Absolute Long',
  pattern: 'long'
}, {
  name: 'indirect_y',
  text: 'DP Indirect Indexed, Y',
  pattern: '(dp),Y'
}, {
  name: 'indirect',
  text: 'DP Indirect',
  pattern: '(dp)'
}, {
  name: 'stack_indirect_y',
  text: 'SR Indirect Indexed, Y',
  pattern: '(sr,S),Y'
}, {
  name: 'dp_x',
  text: 'DP Indexed, X',
  pattern: 'dp,X'
}, {
  name: 'indirect_long_y',
  text: 'DP Indirect Long Indexed, Y',
  pattern: '[dp],Y',
}, {
  name: 'absolute_y',
  text: 'Absolute Indexed, Y',
  pattern: 'addr,Y'
}, {
  name: 'absolute_x',
  text: 'Absolute Indexed, X'
  pattern: 'addr,X'
}, {
  name: 'absolute_long_x',
  text: 'Absolute Long Indexed, X',
  pattern: 'long,X'
}, {
  name: 'relative',
  text: 'Relative',
  pattern: 'relative''
}, {
  name: '',
  text: 'N/A',
  pattern: ''
}];

const ops = [{
  name: 'ADC',
  text: "Add with Carry",
  modes: {
    0x61: '(dp,X)',
    0x63: 'sr,S',
    0x65: 'dp',
    0x67: '[dp]',
    0x69: '#const',
    0x6D: 'addr',
    0x6F: 'long',
    0x71: '(dp),Y',
    0x72: '(dp)',
    0x73: '(sr,S),Y',
    0x75: 'dp,X',
    0x77: '[dp],Y',
    0x79: 'addr,Y,
    0x7D: 'addr,X',
    0x7F: 'long,X',
  }
}, {
  name: 'AND',
  text: 'Accumulator && Memory',
  modes: {
    0x21: '(dp,X)',
    0x23: 'sr,S',
    0x25: 'dp',
    0x27: '[dp]',
    0x29: '#const',
    0x2D: 'addr',
    0x2F: 'long',
    0x31: '(dp),Y',
    0x32: '(dp),
    0x33: '(sr,S),Y,
    0x35: 'dp,X,
    0x37: '[dp],Y',
    0x39: 'addr,Y,
    0x3D: 'addr,X,
    0x3F: 'long,X
  }
}, {
  name: 'ASL',
  text: 'Arithmetic Shift Left',
  modes: {
    0x06: 'dp',
    0x0A: 'A',
    0x0E: 'addr',
    0x16: 'dp,X',
    0x1E: 'addr,X'
  }
}, {
  name: 'BCC',
  text: 'Branch if Carry Clear',
  modes: {
    0x90: 'relative'
  }
}, {
  name: 'BCS',
  text: 'Branch if Carry Set',
  modes: {
    0xB0: 'relative'
  }
}, {
  name: 'BEQ',
  text: 'Branch if Equal',
  modes: {
    0xB0: 'relative'
  }
}, {
  name: 'BIT',
  text: 'Test Bits',
  modes: {
    0x24: 'dp',
    0x2C: 'addr',
    0x34: 'dp,X',
    0x3C: 'addr,X',
    0x89: '#const'
  }
}, {
  name: 'BMI',
  text: 'Branch if Minus',
  modes: {
    0x30: 'relative'
  }
}, {
  name: 'BNE',
  text: 'Branch if Not Equal',
  modes: {
    0xD0: 'relative'
  }
}, {
  name: 'BPL',
  text: 'Branch if Plus',
  modes: {
    0x10: 'relative'
  }
}, {
  name: 'BRA',
  text: 'Branch Always',
  modes: {
    0x80: 'relative'
  }
}, {
  name: 'BRK',
  text: 'Break',
  modes: {
    0x00: ''
  }
}, {
  name: 'BRL',
  text: 'Branch Long Always',
  modes: {
    0x82: 'relative-long'
  }
}, {
  name: 'BVC',
  text: 'Branch if Overflow Clear',
  modes: {
    0x50: 'relative'
  }
}, {
  name: 'BVS',
  text: 'Branch if Overflow Set',
  modes: {
    0x70: 'relative'
  }
}, {
  name: 'CLC',
  text: 'Clear Carry',
  modes: {
    0x18: ''
  }
}, {
  name: 'CLD',
  text: 'Clear Decimal Mode',
  modes: {
    0xD8: ''
  }
}, {
  name: 'CLI',
  text: 'Clear Interrupt DIsable Flag',
  modes: {
    0x58: ''
  }
}, {
  name: 'CLV',
  text: 'Clear Overflow Flag',
  modes: {
    0xB8: ''
  }
}, {
  name: 'CMP',
  text: 'Compare Accumulator with Memory',
  modes: {
    0xC1: '(dp,X)',
    0xC3: 'sr,S',
    0xC5: 'dp',
    0xC7: '[dp]',
    0xC9: '#const',
    0xCD: 'addr',
    0xCF: 'long',
    0xD1: '(dp),Y',
    0xD2: '(dp)',
    0xD3: '(sr,S),Y',
    0xD5: 'dp,X',
    0xD7: '[dp],Y',
    0xD9: 'addr,Y',
    0xDD: 'addr,X',
    0xDF: 'long,X
  }
}, {
  name: 'COP',
  text: 'Co-Processor Enable',
  modes: {
    0x02: '#const'
  }
}, {
  name: 'CPX',
  text: 'Compare Index Register X',
  modes: {
    0xE0: '#const',
    0xE4: 'dp',
    0xEC: 'addr'
  }
}, {
  name: 'CPY',
  text: 'Compare Index Register Y',
  modes: {
    0xC0: '#const'
    0xC4: 'dp'
    0xCC: 'addr'
  }
}, {
  name: 'DEC',
  text: 'Decrement A',
  modes: {
    0x3A: '',
    0xC6: 'dp',
    0xCE: 'addr',
    0xD6: 'dp,X',
    0xDE: 'addr,X'
  }
}, {
  name: 'DEX',
  text: 'Decrement X',
  modes: {
    0xCA: ''
  }
}, {
  name: 'DEY',
  text: 'Decrement Y',
  modes: {
    0x88: ''
  }
}, {
  name: 'EOR',
  text: 'Accumulator ^ Memory',
  modes: {
    0x41: '(dp,X)',
    0x43: 'sr,S',
    0x45: 'dp',
    0x47: '[dp]',
    0x49: '#const',
    0x4D: 'addr',
    0x4F: 'long',
    0x51: '(dp),Y',
    0x52: '(dp)',
    0x53: '(sr,S),Y',
    0x55: 'dp,X',
    0x57: '[dp],Y',
    0x59: 'addr,Y',
    0x5D: 'addr,X',
    0x5F: 'long,X'
  }
}, {
  name: 'INC',
  text: 'Increment',
  modes: {
    0x1A: '',
    0xE6: 'dp',
    0xEE: 'addr',
    0xF6: 'dp,X',
    0xFE: 'addr,X'
  }
}, {
  name: 'INX',
  text: 'Increment X',
  modes: {
    0xE8: ''
  }
}, {
  name: 'INY',
  text: 'Increment Y',
  modes: {
    0xC8: ''
  }
}, {
  name: 'JMP',
  text: 'Jump',
  modes: {
    0x4C: 'addr',
    0x5C: 'long',
    0x6C: '(addr)',
    0x7C: '(addr,X)',
    0xDC: '[addr]
  }
}, {
  name: 'JSR',
  text: 'Jump to Subroutine',
  modes: {
    0x20: 'addr',
    0x22: 'long',
    0xFC: '(addr,X)'
  }
}, {
  name: 'LDA',
  text: 'Load Accumulator from Memory',
  modes: {
    0xA1: '(dp,X)',
    0xA3: 'sr,S',
    0xA5: 'dp',
    0xA7: '[dp]',
    0xA9: '#const',
    0xAD: 'addr',
    0xAF: 'long',
    0xB1: '(dp),Y',
    0xB2: '(dp)',
    0xB3: '(sr,S),Y',
    0xB5: 'dp,X',
    0xB7: '[dp],Y',
    0xB9: 'addr,Y',
    0xBD: 'addr,X',
    0xBF: 'long,X'
  }
}, {
  name: 'LDX',
  text: 'Load X from Memory',
  modes: {
    0xA2: '#const',
    0xA6: 'dp',
    0xAE: 'addr',
    0xB6: 'dp,Y',
    0xBE: 'addr,Y'
  }
}, {
  name: 'LDY',
  text: 'Load Y from Memory',
  modes: {
    0xA0: '#const',
    0xA4: 'dp',
    0xAC: 'addr',
    0xB4: 'dp,X',
    0xBC: 'addr,X'
  }
}, {
  name: 'LSR',
  text: 'Shift Right',
  modes: {
    0x46: 'dp',
    0x4A: '',
    0x4E: 'addr',
    0x56: 'dp,X',
    0x5E: 'addr,X'
  }
}, {
  name: 'MVN',
  text: 'Block Move Negative',
  modes: {
    0x54: 'srcbank,destbank'
  }
}, {
  name: 'MVP',
  text: 'Block Move Positive',
  modes: {
    0x44: 'srcbank,destbank'
  }
}, {
  name: 'NOP',
  text: 'No Operation',
  modes: {
    0xEA: ''
  }
}, {
  name: 'ORA',
  text: 'Accumulator || Memory',
  modes: {
    0x01: '(dp,X)',
    0x03: 'sr,S',
    0x05: 'dp',
    0x07: '[dp]',
    0x09: '#const',
    0x0D: 'addr',
    0x0F: 'long',
    0x11: '(dp),Y',
    0x12: '(dp)',
    0x13: '(sr,S),Y',
    0x15: 'dp,X',
    0x17: '[dp],Y',
    0x19: 'addr,Y',
    0x1D: 'addr,X',
    0x1F: 'long,X'
  }
}, {
  name: 'PEA',
  text: 'Push Effective Absolute Address',
  modes: {
    0xF4: 'addr'
  }
}, {
  name: 'PEI',
  text: 'Push Effective Indirect Address',
  modes: {
    0xD4: '(dp)'
  }
}, {
  name: 'PER',
  text: 'Push Effective PC Relative Indirect Address',
  modes: {
    0x62: 'relative'
  }
}, {
  name: 'PHA',
  text: 'Push Accumulator',
  modes: {
    0x48: ''
  }
}, {
  name: 'PHB',
  text: 'Push Bank',
  modes: {
    0x8B: ''
  }
}, {
  name: 'PHD',
  text: 'Push Direct Page',
  modes: {
    0x0B: ''
  }
}, {
  name: 'PHK',
  text: 'Push Program Bank',
  modes: {
    0x4B: ''
  }
}, {
  name: 'PHP',
  text: 'Push Status Register',
  modes: {
    0x08: ''
  }
}, {
  name: 'PHX',
  text: 'Push X Index',
  modes: {
    0xDA: ''
  }
}, {
  name: 'PHY',
  text: 'Push Y Index',
  modes: {
    0x5A: ''
  }
}, {
  name: 'PLA',
  text: 'Pull Accumulator',
  modes: {
    0x68: ''
  }
}, {
  name: 'PLB',
  text: 'Pull Bank',
  modes: {
    0xAB: ''
  }
}, {
  name: 'PLD',
  text: 'Pull Direct Page',
  modes: {
    0x2B: ''
  }
}, {
  name: 'PLP',
  text: 'Pull Status Register',
  modes: {
    0x28: ''
  }
}, {
  name: 'PLX',
  text: 'Pull X Index',
  modes: {
    0xFA: ''
  }
}, {
  name: 'PLY',
  text: 'Pull Y Index',
  modes: {
    0x7A: ''
  {
}, {
  name: 'REP',
  text: 'Reset Processor Status Bits',
  modes: {
    0xC2: '#const'
  }
}, {
  name: 'ROL',
  text: 'Rotate Left',
  modes: {
    0x26: 'dp',
    0x2A: '',
    0x2E: 'addr',
    0x36: 'dp,X',
    0x3E: 'addr,X'
  }
}, {
  name: 'ROR',
  text: 'Rotate Right',
  modes: {
    0x66: 'dp',
    0x6A: '',
    0x6E: 'addr',
    0x76: 'dp,X',
    0x7E: 'addr,X'
  }
}, {
  name: 'RTI',
  text: 'Return from Interrupt',
  modes: {
    0x40: ''
  }
}, {
  name: 'RTL',
  text: 'Return from Subroutine Long',
  modes: {
    0x6B: ''
  }
}, {
  name: 'RTS',
  text: 'Return from Subroutine',
  modes: {
    0x60: ''
  }
}, {
  name: 'SBC',
  text: 'Return from Interrupt',
  modes: {
    0xE1: '(dp,X)',
    0xE3: 'sr,S',
    0xE5: 'dp',
    0xE7: '[dp]',
    0xE9: '#const',
    0xED: 'addr',
    0xEF: 'long',
    0xF1: '(dp),Y',
    0xF2: '(dp)',
    0xF3: '(sr,S),Y',
    0xF5: 'dp,X',
    0xF7: '[dp],Y',
    0xF9: 'addr,Y',
    0xFD: 'addr,X',
    0xFF: 'long,X'
  }
}, {
  name: 'SEC',
  text: 'Set Carry Flag',
  modes: {
    0x38: ''
  }
}, {
  name: 'SED',
  text: 'Set Decimal Flag',
  modes: {
    0xF8: ''
  }
}, {
  name: 'SEI',
  text: 'Set Interrupt Disable Flag',
  modes: {
    0x78: ''
  }
}, {
  name: 'SEP',
  text: 'Set Processor Status Bits',
  modes: {
    0xE2: '#const'
  }
}, {
  name: 'STA',
  text: 'Store Accumulator to Memory',
  modes: {
    0x81: '(dp,X)',
    0x83: 'sr,S',
    0x85: 'dp',
    0x87: '[dp]',
    0x8D: 'addr',
    0x8F: 'long',
    0x91: '(dp),Y',
    0x92: '(dp)',
    0x93: '(sr,S),Y',
    0x95: '_dp_X',
    0x97: '[dp],Y',
    0x99: 'addr,Y',
    0x9D: 'addr,X',
    0x9F: 'long,X'
  }
}, {
  name: 'STP',
  text: 'Stop Processor',
  modes: {
    0xDB: ''
  }
}, {
  name: 'STX',
  text: 'Store X to Memory',
  modes: {
    0x86: 'dp',
    0x8E: 'addr',
    0x96: 'dp,Y'
  }
}, {
  name: 'STY',
  text: 'Store Y to Memory',
  modes: {
    0x84: 'dp',
    0x8C: 'addr',
    0x94: 'dp,X'
  }
}, {
  name: 'STZ',
  text: 'Store Zero to Memory',
  modes: {
    0x64: 'dp',
    0x74: 'dp,X',
    0x9C: 'addr',
    0x9E: 'addr,X'
  }
}, {
  name: 'TAX',
  text: 'Transfer Accumulator to X',
  modes: {
    0xAA: ''
  }
}, {
  name: 'TAY',
  text: 'Transfer Accumulator to Y',
  modes: {
    0xA8: ''
  }
}, {
  name: 'TCD',
  text: 'Transfer 16-bit Accumulator to Direct Page',
  modes: {
    0x5B: ''
  }
}, {
  name: 'TCS',
  text: 'Transfer 16-bit Accumulator to Stack Pointer',
  modes: {
    0x1B: ''
  }
}, {
  name: 'TDC',
  text: 'Transfer Direct Page to 16-bit Accumulator',
  modes: {
    0x7B: ''
  }
}, {
  name: 'TRB',
  text: 'Test and Reset Memory Bits',
  modes: {
    0x14: 'dp',
    0x1C: 'addr'
  }
}, {
  name: 'TSB',
  text: 'Test and Set Memory Bits',
  modes: {
    0x04: 'dp',
    0x0C: 'addr'
  }
}, {
  name: 'TSC',
  text: 'Transfer Stack Pointer to 16-bit Accumulator',
  modes: {
    0x3B: ''
  }
}, {
  name: 'TSX',
  text: 'Transfer Stack Pointer to Index Register X',
  modes: {
    0xBA: ''
  }
}, {
  name: 'TXA',
  text: 'Transfer X to Accumulator',
  modes: {
    0x8A: ''
  }
}, {
  name: 'TXS',
  text: 'Transfer X to Stack Pointer',
  modes: {
    0x9A: ''
  }
}, {
  name: 'TXY',
  text: 'Transfer X to Y',
  modes: {
    0x9B: ''
  }
}, {
  name: 'TYA',
  text: 'Transfer Y to Accumulator',
  modes: {
    0x98: ''
  }
}, {
  name: 'TYX',
  text: 'Transfer Y to X',
  modes: {
    0xBB: ''
  }

}, {
  name: 'WAI',
  text: 'Wait for Interrupt',
  modes: {
    0xCB: ''
  }
}, {
  name: 'WDM',
  text: 'Reserved for Future Expansion',
  modes: {
    0x42: ''
  }
}, {
  name: 'XBA',
  text: 'Exchange B and A',
  modes: {
    0xEB: ''
  }
}, {
  name: 'XCE',
  text: 'Exchange Carry and Emulation Flags',
  modes: {
    0xFB: ''
  }
}];

module.exports = ops;
