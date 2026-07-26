const { Project, SyntaxKind } = require('ts-morph');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/WebContainer.tsx');

const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
const renderEditorPanel = varDecls.find(d => d.getName() === 'renderEditorPanel');

if (renderEditorPanel) {
    console.log("Found renderEditorPanel");
    const initializer = renderEditorPanel.getInitializerIfKind(SyntaxKind.ArrowFunction);
    if (initializer) {
        initializer.replaceWithText(`(className = '', onClose = null) => (
    <PineEditorPanel
      className={className}
      onClose={onClose}
      darkMode={darkMode}
      themeConfig={t}
      scripts={scripts}
      setScripts={setScripts}
      activeScript={activeScript}
      setActiveScript={setActiveScript}
      editorContent={editorContent}
      setEditorContent={setEditorContent}
      compileStatus={compileStatus}
      setCompileStatus={setCompileStatus}
      isCompiling={isCompiling}
      setIsCompiling={setIsCompiling}
      compilerLogs={compilerLogs}
      setCompilerLogs={setCompilerLogs}
      monaco={monaco}
      showAIScriptAssistant={showAIScriptAssistant}
      setShowAIScriptAssistant={setShowAIScriptAssistant}
      showStrategyTester={showStrategyTester}
      setShowStrategyTester={setShowStrategyTester}
    />
  )`);
        console.log("Replaced PineEditorPanel body");
    } else {
        console.log("Could not find ArrowFunction initializer");
    }
} else {
    console.log("Could not find renderEditorPanel");
}

// Add import
sourceFile.addImportDeclaration({
    namedImports: ['PineEditorPanel'],
    moduleSpecifier: './components/layout/PineEditorPanel'
});

sourceFile.saveSync();
console.log("Saved WebContainer.tsx");
