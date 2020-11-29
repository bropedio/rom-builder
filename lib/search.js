"use strict";

/* Helper to search (depth-first) through schema trees */

module.exports = { search, replace};

function search (node, init_path) {
  const path = init_path.slice();

  while (path.length) {
    if (node == null) {
      throw new Error(`Invalid search path: ${{ init_path, path }}`);
    }
    if (node.search) {
      node = node.search(path.shift());
    } else {
      node = node.type;
    }
  }

  return node; 
};

function replace (node, init_path, new_type) {
  const wrapper = search(node, init_path);
  wrapper.type = new_type;
}
