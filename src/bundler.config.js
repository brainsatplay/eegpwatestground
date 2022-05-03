
//const globalExternals = require('@fal-works/esbuild-plugin-global-externals');



console.time('esbuild');
console.log('esbuild starting!');

const cwd = process.cwd()
import esbuild from 'esbuild'
import {dtsPlugin} from 'esbuild-plugin-d.ts'
import fs from 'fs'

const defaultConfig = {
  createBrowser:true,
  createESM:true,
  createNode:false,
  createIIFE:false,
  createTypes:true,
  allowOverwrite:true,
  entryPoints:['index.ts'],
  outfile:'dist/index',
  //outdir:[]
  bundle:true,
  platform: 'browser', //createNodeJS will use 'node' mode by default
  minify: true,
  sourcemap: false,
  external: ['node-fetch'], // [];
  loader: {
    '.html': 'text', //not always necessary but it doesn't hurt
    '.png' : 'file',
    '.jpg' : 'file',
    '.gif' : 'file',
    '.svg': 'file',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
    '.eot': 'file',
    '.mp3': 'file',
    '.mp4': 'file',
    '.json': 'text',
  },
  outputs:{
    node:{ 
      external:[] //externals for node environment builds
    }
  }
}


export default async function bundle(configs) {

  if (!Array.isArray(configs)) configs = [configs]
  const tempDir = `.temp`

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

  await Promise.all(configs.map(async (config, i) => {

    config = Object.assign(defaultConfig, config)
    // ------------------ START PROVISIONAL CODE ------------------
    // NOTE: This object works for all Brains@Play bundles. 
    // To save time, I've just conformed some early syntax to this model.
    // TODO: In the future, we should use this format (similar to Rollup) for the bundle() function
    if(!config.entryPoints) {
      console.error('define config.entryPoints!!');
      return undefined;
    }
    let split = config.entryPoints[0].split('.'); //our 'main' file will be the first entryPoint
    split.pop();

    // ------------------ END PROVISIONAL CODE ------------------
    if(config.input)
      config.entryPoints = Array.isArray(config.index) ? config.input : [config.input]
    
    let entryPoints = config.entryPoints;
    config.entryPoints = config.entryPoints.map(v => cwd+'/'+v.split('/').slice(1).join('/')) // Remove first folder
    // TODO: Make sure that relative references are fully maintained

    let temp_files = [...config.entryPoints];

    if(config.createESM) {
      console.time('\n Built .esm.js file(s)')
      let cfg = Object.assign({},config);
      if(config.outputs?.esm) {
        if(config.outputs.esm.entryPoints) {
          cfg.entryPoints = config.outputs.esm.entryPoints.map(v => `${cwd}/${v}`);
        }
        Object.assign(cfg,config.outputs.esm);
      }
      
      cfg.format = 'esm';
      if(cfg.outfile) {
        cfg.outfile += '.esm.js';
      }
      else if (cfg.outdir) {
        if(cfg.outfile) delete cfg.outfile;
        cfg.outdir = cfg.outdir.map(v => v+'.esm.js');
      }

      cleanupConfig(cfg);

      await esbuild.build(cfg).then(()=>{
        console.timeEnd('\n Built .esm.js file(s)');
      });
    }
    
    if(config.createBrowser){ // kinda UMD
      console.time('\n Built UMD-like .js file(s) for browser');
      
      let cfg = Object.assign({},config);
      if(config.outputs?.browser) {
        Object.assign(cfg,config.outputs.browser);
        if(config.outputs.browser.entryPoints) {
          cfg.entryPoints = config.outputs.browser.entryPoints.map(v => `${cwd}/${v}`);
        }
      }
      cfg.logLevel = 'error';
      if(cfg.format) delete cfg.format;
      if(cfg.outfile) {
        cfg.outfile += '.js';
      }
      else if (cfg.outdir) {
        if(cfg.outfile) delete cfg.outfile;
        cfg.outdir = cfg.outdir.map(v => v+'.js');
      }

      cleanupConfig(cfg);
      
      // Globals
      if(config.browser?.entryPoints) entryPoints = config.browser.entryPoints;
      entryPoints.forEach((f,i)=>{  
        if(config.globalThis || config.init || config.globals) {
    
          let ext = f.split('.')[f.split('.').length-1];
          let subpath = f.substring(0,f.indexOf('.'+ext));
    
          let propname = config.globalThis;
      
          let bundleWrapper = `
    
          //we can't circularly export a namespace for index.ts so this is the intermediary
          //import * as bundle from './x' then set globalThis[key] = bundle; The only other option is dynamic importing or a bigger bundler with more of these features built in
          
          export * from '../${subpath}' //still works in esm, getting out of .temp
          
          //this takes all of the re-exported modules in index.ts and contains them in an object
          import * as bundle from '../${subpath}' // getting out of .temp
          
          //webpack? i.e. set the bundled index.ts modules to be globally available? 
          // You can set many modules and assign more functions etc. to the same globals without error
          
          //globals are not declared by default in browser scripts, these files are function scopes!
    
        
          ` //we could do more with this with other settings! It just builds this file instead of the original one then deletes the temp file.
    
          if(propname) {    
            bundleWrapper += `   
              if(typeof globalThis['${propname}'] !== 'undefined') Object.assign(globalThis['${propname}'],bundle); //we can keep assigning the same namespaces more module objects without error!
              else globalThis['${propname}'] = bundle;
            `
          }

          //declare any keys in the bundle as globals
          if(typeof config.globals === 'object') {
            if(config.globals[f]) { //e.g. {globals:{entryPoints[0]:['Graph','Router','AcyclicGraph']}
              bundleWrapper += `
              (${JSON.stringify(otherkeys)}).forEach((key) => {
                if(bundle[key]) {
                  globalThis[key] = bundle[key];
                }
              });
              `
            }
          }

          /** init scripts per entry point
          e.g. {[entryPoints[0]]:function index(bundle) {
                  console.log('this is a prebundled script to provide some initial values! bundle:', bundle);
                }}
          */
          if(typeof config.init === 'object') {
            if(config.init[f]) { 
              bundleWrapper += `eval(${o.inif[f].toString()})(bundle)`;
            }
          }
    
          if(propname) {
    
            const tempName = cwd + '/' + tempDir + '/temp_'+f
            fs.writeFileSync( //lets make temp files to bundle our bundles (a wrapper) into globalThis properties (still import-friendly in esm!)
              tempName,
              bundleWrapper
            );
    
            temp_files[i] = tempName;  
          }
    
        }
      });


      await esbuild.build(cfg).then(()=>{
        console.timeEnd('\n Built UMD-like .js file(s) for browser');

        if(config.html) { //bundle the outfile into a boilerplate html

          let htmlurl = split.join('.')+'.html';

          fs.writeFileSync(htmlurl,
            `
              <!DOCTYPE html>
              <head>
              </head>
              <body>  
                <script>
                  ${fs.readFileSync(outfile).toString()}
                </script>
              </body>
            `
            );

        }


      });
    }
    
    if(config.createNode) {
      console.time('\n Built node .js file(s)');
      
      let cfg = Object.assign({},config);
      cfg.external = config.node_external;
      if(config.outputs?.node) {
        Object.assign(cfg,config.outputs.node);
        if(config.outputs.node.entryPoints) {
          cfg.entryPoints = config.outputs.node.entryPoints.map(v => `${cwd}/${v}`);
        }
      }
      cfg.platform = 'node';
      cfg.logLevel = 'error';
      if(cfg.format) delete cfg.format;
      if(cfg.outfile) {
        cfg.outfile += '.node.js';
      }
      else if (cfg.outdir) {
        if(cfg.outfile) delete cfg.outfile;
        cfg.outdir = cfg.outdir.map(v => v+'.node.js');
      }

      cleanupConfig(cfg);

      await esbuild.build(cfg).then(()=>{
        console.timeEnd('\n Built node .js file(s)');
      });
    }
    
    if(config.createCommonJS) {
      console.time('\n Built .cjs.js');

      let cfg = Object.assign({},config);
      if(config.outputs?.commonjs) {
        Object.assign(cfg,config.outputs.commonjs);
        if(config.outputs.commonjs.entryPoints) {
          cfg.entryPoints = config.outputs.commonjs.entryPoints.map(v => `${cwd}/${v}`);
        }
      }
      cfg.logLevel = 'error';
      cfg.format = 'cjs';
      if(cfg.outfile) {
        cfg.outfile += '.cjs.js';
      }
      else if (cfg.outdir) {
        if(cfg.outfile) delete cfg.outfile;
        cfg.outdir = cfg.outdir.map(v => v+'.cjs.js');
      }

      cleanupConfig(cfg);

      await esbuild.build(cfg).then(()=>{
        console.timeEnd('\n Built .cjs.js');
      });
    }

    // Create Types Once
    if(config.createTypes) {
      console.time(`\n Built .d.ts files (${i})`);
      let cfg = Object.assign({},config);
      if(config.outputs?.iife) {
        Object.assign(cfg,config.outputs.iife);
        if(config.outputs.iife.entryPoints) {
          cfg.entryPoints = config.outputs.iife.entryPoints.map(v => `${cwd}/${v}`);
        }
      }
      cfg.logLevel = 'error';
      cfg.format = 'iife';
      if(cfg.outfile) {
        cfg.outfile += '.cjs.js';
      }
      else if (cfg.outdir) {
        if(cfg.outfile) delete cfg.outfile;
        cfg.outdir = cfg.outdir.map(v => v+'.cjs.js');
      }
      cfg.plugins = [
        dtsPlugin()
      ];

      cleanupConfig(cfg);

      //generates types correctly
      await esbuild.build(cfg).then(()=>{
        if(!(config.createIIFE)) { 
          if(cfg.outfile) {
            fs.unlink(cfg.outfile, () => {}); //remove the extraneous iife file
          }
          else if (cfg.outdir) {
            cfg.outdir.map(v => fs.unlink(v,()=>{}));
          }
        }
        console.timeEnd(`\n Built .d.ts files (${i})`);
      });
    }

  }))

  //clean temp files we wrote extra code to
  fs.rm(tempDir,{ recursive: true }, () => {})

  console.log('esbuild completed!')
  console.timeEnd('esbuild');
}


//deletes any optional keys we use to customize configs
function cleanupConfig(cfg={}) {
  delete cfg.createBrowser;
  delete cfg.createCommonJS;
  delete cfg.createESM;
  delete cfg.createIIFE;
  delete cfg.createNode;
  delete cfg.createTypes;
  delete cfg.outputs;
  delete cfg.globalThis;
  delete cfg.globals;
  delete cfg.init;
  delete cfg.html;
}