const fs = require('fs');
const code = fs.readFileSync('src/WebContainer.tsx', 'utf8');
const lines = code.split('\n');

const startIdx = 3483;
const endIdx = 3580;

const extractedLines = lines.slice(startIdx + 1, endIdx); // Skip the const renderEditorPanel = () => ( line

const componentCode = `import React, { Suspense, lazy } from 'react';
import { Play, RefreshCw, X, FolderOpen, Save, Settings, Maximize2, Minimize2 } from 'lucide-react';

const EditorLazy = lazy(() => import('@monaco-editor/react'));
const Editor = (props: any) => <Suspense fallback={<div className="p-4 text-center text-gray-500 text-xs">Loading Code Editor...</div>}><EditorLazy {...props} /></Suspense>;

export const PineEditorPanel = ({
  className = '',
  onClose = null,
  t,
  darkMode,
  loading,
  runBacktest,
  editorRef,
  editorContent,
  setEditorContent,
  monacoEditorRef,
  consoleOutput,
  compileError,
  renderTriangleRIcon
}: any) => {
  return (
${extractedLines.join('\n')}
`;

fs.writeFileSync('src/components/layout/PineEditorPanel.tsx', componentCode);

const newWebContainerLines = [
  ...lines.slice(0, startIdx),
  `  const renderEditorPanel = (className = '', onClose = null) => (
    <PineEditorPanel 
      className={className} 
      onClose={onClose} 
      t={t}
      darkMode={darkMode}
      loading={loading}
      runBacktest={runBacktest}
      editorRef={editorRef}
      editorContent={editorContent}
      setEditorContent={setEditorContent}
      monacoEditorRef={monacoEditorRef}
      consoleOutput={consoleOutput}
      compileError={compileError}
      renderTriangleRIcon={renderTriangleRIcon}
    />
  );`,
  ...lines.slice(endIdx + 1)
];

let newCode = newWebContainerLines.join('\n');
if (!newCode.includes("import { PineEditorPanel }")) {
  newCode = newCode.replace("import { BottomPanel }", "import { PineEditorPanel } from './components/layout/PineEditorPanel';\nimport { BottomPanel }");
}

fs.writeFileSync('src/WebContainer.tsx', newCode);
console.log('Successfully extracted PineEditorPanel');
