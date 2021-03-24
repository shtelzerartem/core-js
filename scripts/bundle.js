'use strict';
const { cyan, green } = require('chalk');
const builder = require('@core-js/builder');
const actual = require('@core-js/compat/entries')['core-js/actual'];

const PATH = './packages/core-js-bundle/';

function log(kind, name, code) {
  const size = (code.length / 1024).toFixed(2);
  // eslint-disable-next-line no-console -- output
  console.log(green(`${ kind }: ${ cyan(`${ PATH }${ name }.js`) }, size: ${ cyan(`${ size }KB`) }`));
}

async function bundle({ name, ...options }) {
  const source = await builder({ filename: `${ PATH }${ name }.js`, ...options });
  log('bundling', name, source);
}

bundle({ name: 'full', minify: false });
bundle({ name: 'full.min' });
bundle({ name: 'actual', modules: actual, minify: false });
bundle({ name: 'actual.min', modules: actual });
