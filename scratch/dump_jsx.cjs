const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  skipAddingFilesFromTsConfig: true
});

const sourceFile = project.addSourceFileAtPath('src/WebContainer.tsx');
const conditions = [];

sourceFile.forEachDescendant(node => {
  if (node.getKind() === SyntaxKind.JsxExpression) {
    const expr = node.getExpression();
    if (expr && expr.getKind() === SyntaxKind.BinaryExpression) {
      if (expr.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken) {
          conditions.push(expr.getLeft().getText());
      }
    }
  }
});

fs.writeFileSync('scratch/jsx_conditions.txt', conditions.join('\n'));
console.log("Dumped conditions to scratch/jsx_conditions.txt");
