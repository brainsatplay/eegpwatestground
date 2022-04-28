
//import globalExternals from '@fal-works/esbuild-plugin-global-externals'


console.time('es');
console.log('esbuild starting!')

const entryPoints = ['index_bundle.ts'];
const outfile = 'dist/index';

const esbuild = require('esbuild');
const {dtsPlugin} = require('esbuild-plugin-d.ts');
//import esbuild from 'esbuild'
//import { dtsPlugin } from 'esbuild-plugin-d.ts'


esbuild.build({ //commonjs
  entryPoints,
  bundle:true,
  outfile:outfile+'.js',
  //platform:'node',
  external:['node-fetch']
  //format:'cjs'
  
}).then(()=>{
  esbuild.build({ //esmodules
    entryPoints,
    bundle:true,
    outfile:outfile+'.esm.js',
    format:'esm',
    //platform:'node',
    external:['node-fetch'],
    minify:true
  }).then(()=>{
    esbuild.build({ //generates types correctly
      entryPoints,
      bundle:true,
      outfile:outfile+'.iife.js',
      format:'iife',
      //platform:'node',
      external:['node-fetch'],
      minify:true,
      plugins:[ 
        dtsPlugin() 
      ]
    }).then(() => {
      console.log('esbuild completed!')
      console.timeEnd('es');
    });
  });
  
});
