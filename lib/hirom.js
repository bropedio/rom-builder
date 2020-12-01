"use strict";

module.exports = HiRom;

/* HiRom Reader */

function HiRom (buffer) {
  this.buffer = buffer;
  this.index = 0;
  this.stack = [];
  this.header_size = buffer.length >= 0x300200 ? 0x200 : 0x00;
}

HiRom.prototype.clone = function () {
  const clone = new HiRom(this.buffer);
  clone.index = this.index;
  clone.stack = this.stack.slice();
  return clone;
};

HiRom.prototype.offset = function (offset) {
  if (offset != null) {
    this.index = offset - 0xC00000 + this.header_size;
  }
  return this.index + 0xC00000 - this.header_size;
};

HiRom.prototype.read = function (type) {
  switch (type) {
  case 'sword':
    return this.read('word') + (this.read() << 16);
  case 'word':
    return this.read() + (this.read() << 8);
  default:
    return this.buffer[this.index++];
  }
};

HiRom.prototype.read_at = function (offset, type) {
  return this.jsr(offset, () => {
    return this.read(type);
  });
};

HiRom.prototype.write = function (value, type) {
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
};

HiRom.prototype.write_at = function (offset, value, type) {
  return this.jsr(offset, () => {
    return this.write(value, type);
  });
};

HiRom.prototype.jsr = function (offset, handler) {
  this.stack.push(this.index);
  this.offset(offset);
  const result = handler.call(this);
  this.rts();
  return result;
};

HiRom.prototype.rts = function () {
  this.index = this.stack.pop();
};
