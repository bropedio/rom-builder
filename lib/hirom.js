"use strict";

/* Rom Reader */

class Rom {
  constructor (buffer) {
    this.buffer = buffer;
    this.index = 0;
    this.stack = [];
  }

  offset (offset) {
    if (offset == null) {
      return this.map_from(this.index);
    } else {
      this.index = this.map_to(offset);
    }
  }

  clone () {
    const clone = new Rom(this.buffer);
    clone.index = this.index;
    clone.stack = this.stack.slice();
    return clone;
  }

  read (type) {
    switch (type) {
    case 'sword':
      return this.read('word') + (this.read() << 16);
    case 'word':
      return this.read() + (this.read() << 8);
    default:
      return this.buffer[this.index++];
    }
  }
  
  read_at (offset, type) {
    return this.jsr(offset, () => {
      return this.read(type);
    });
  }
  
  write (value, type) {
    switch (type) {
    case 'sword':
      this.write(value & 255);
      this.write(value >> 8, 'word');
    case 'word':
      this.write(value & 255);
      this.write(value >> 8);
      break;
    default:
      //if (this.buffer[this.index] !== value) {
      //  console.log(this.offset().toString(16));
      //  throw new Error(`Mistake: ${this.buffer[this.index]} -> ${value}`);
      //}
      this.buffer[this.index++] = value;
      break;
    }
  
    return this.index;
  }
  
  write_at (offset, value, type) {
    return this.jsr(offset, () => {
      return this.write(value, type);
    });
  }
  
  jsr (offset, handler) {
    this.stack.push(this.index);
    this.offset(offset);
    const result = handler.call(this);
    this.rts();
    return result;
  }
  
  rts () {
    this.index = this.stack.pop();
  }
}

class LoRom extends Rom {
  constructor (buffer) {
    super(buffer);
    this.header_size = buffer.length >= 0x100200 ? 0x200 : 0x00;
  }

  map_to (offset) {
    const address = offset < 0xC00000 ? offset : offset - 0xC00000;
    const bank = address >> 16;
    return (bank << 15) + (address & 0x7FFF) + this.header_size;
  }

  map_from (index) {
    const fixed = index - this.header_size;
    const bank = fixed >> 15 << 16;
    const offset = fixed & 0x7FFF | 0x8000;
    return bank + offset + 0xC00000;
  }
}

class HiRom extends Rom {
  constructor (buffer) {
    super(buffer);
    this.header_size = buffer.length >= 0x300200 ? 0x200 : 0x00;
  }

  map_to (offset) {
    return offset - 0xC00000 + this.header_size;
  }

  map_from (index) {
    return index + 0xC00000 - this.header_size;
  }
}

module.exports = {
  LoRom,
  HiRom
}
