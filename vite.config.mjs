import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],build:{outDir:'dist',commonjsOptions:{include:[/node_modules/,/electron\/(model|browse|products|matching).cjs/]}}});
