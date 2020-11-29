"use strict";

/* Helper to search (depth-first) through schema trees */

module.exports = { search, replace};

function search (node, init_path) {
  const path = init_path.slice();

  while (path.length) {
    if (node == null) {
      break;
    } else if (node.search) {
      node = node.search(path.shift());
    } else {
      node = node.type;
    }
  }

  if (node == null) {
    throw new Error(`Invalid search path: ${{ init_path, path }}`);
  }

  return node; 
};

function replace (node, init_path, new_type) {
  const wrapper = search(node, init_path);
  wrapper.type = new_type;
}
