const fs = require('fs');
let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

const badStart = `const WebGLChartEngine = lazy(() => import('./components/WebGLChartEngine'));
  MousePointer,`;

const goodStart = `const WebGLChartEngine = lazy(() => import('./components/WebGLChartEngine'));
const WebGPUChartEngine = lazy(() => import('./components/WebGPUChartEngine'));
import { captureViewportSnapshot, generateDrawingId } from './utils/drawingStore';
import { loadDrawingsFromDB, saveDrawingsToDB } from './utils/drawingPersistence';
import Editor from '@monaco-editor/react';
import logo from './assets/logo.png';
import { createChart } from 'lightweight-charts';
import {
  Rocket, Clock, Sliders, Radio, Activity, TrendingUp, Search, Percent, ListFilter,
  Database, RefreshCw, ChevronUp, ChevronDown, Play, Undo, Redo, Bell,
  History, Settings, Camera, Maximize2, Layers, Upload, FileDiff, X, Shapes,
  ChevronRight, ChevronDown as ChevronDownIcon, Download, Sun, Moon,
  Crosshair, Square, Type, Eraser, Menu, Sparkles, Send, Bot, Code2, FileCode,
  Brush, Ruler, Trash2, Eye, EyeOff, Calendar, ArrowLeft, AlignJustify, GitMerge,
  MousePointer,`;

if (code.includes(badStart)) {
  code = code.replace(badStart, goodStart);
  fs.writeFileSync('src_demo/App.jsx', code, 'utf8');
  console.log('Fixed imports!');
} else {
  console.log('Could not find badStart');
}
