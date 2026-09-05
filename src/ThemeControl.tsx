import React,{useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export function ThemeControl(){
 const [theme,setTheme]=useState<'system'|'light'|'dark'>('system'),[dark,setDark]=useState(matchMedia('(prefers-color-scheme: dark)').matches);
 useEffect(()=>{window.grocery.appearance().then(p=>setTheme(p.theme)).catch(()=>{})},[]);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const update=()=>{const isDark=theme==='dark'||theme==='system'&&media.matches;document.documentElement.dataset.theme=isDark?'dark':'light';setDark(isDark)};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[theme]);
 return <button className="theme-toggle icon-button" aria-label={dark?'Use light mode':'Use dark mode'} onClick={()=>{const next=dark?'light':'dark';window.grocery.setAppearance(next).then(()=>setTheme(next)).catch(()=>{})}}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>;
}
