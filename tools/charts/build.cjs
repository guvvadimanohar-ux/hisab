const esbuild=require('esbuild');
esbuild.buildSync({entryPoints:[__dirname+'/entry.tsx'],bundle:true,minify:true,format:'iife',outfile:__dirname+'/../../frontend/js/hisabCharts.js',jsx:'automatic',alias:{'@/lib/utils':__dirname+'/utils.ts'},define:{'process.env.NODE_ENV':'"production"'},metafile:true,legalComments:'linked'});
