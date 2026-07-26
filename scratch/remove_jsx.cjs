const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipAddingFilesFromTsConfig: true
});

const sourceFile = project.addSourceFileAtPath('src/WebContainer.tsx');

let modified = false;

// We need to find the JSX expressions: {subView === 'strategy' && (...)}
sourceFile.forEachDescendant(node => {
  if (node.getKind() === SyntaxKind.JsxExpression) {
    const expr = node.getExpression();
    if (expr && expr.getKind() === SyntaxKind.BinaryExpression) {
      const text = expr.getText();
      
      // Look for the specific conditionals
      if (text.includes("subView === 'strategy'") || 
          text.includes("subView === 'pine'") || 
          text.includes("isPredictionReportOpen")) {
          
          console.log(`Removing JSX Expression: ${text.substring(0, 50)}...`);
          
          // To remove it safely, we can replace the entire JsxExpression with an empty string or {null}
          // but replacing a JsxExpression node that is a child of JsxElement is tricky.
          // The safest is to replace it with `{null}`
          node.replaceWithText('{null}');
          modified = true;
      }
    }
  }
});

if (modified) {
  sourceFile.saveSync();
  console.log("Successfully removed duplicate HTML blocks via AST.");
} else {
  console.log("No duplicate blocks found matching the criteria.");
}
