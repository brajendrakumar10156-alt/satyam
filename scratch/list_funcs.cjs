const { Project, SyntaxKind } = require('ts-morph');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/WebContainer.tsx');

const declarations = sourceFile.getVariableDeclarations();
console.log("Functions/Variables in WebContainer.tsx:");
for (const decl of declarations) {
    if (decl.getInitializer() && decl.getInitializer().getKind() === SyntaxKind.ArrowFunction) {
        console.log(`- ${decl.getName()}`);
    }
}

const funcs = sourceFile.getFunctions();
for (const f of funcs) {
    console.log(`- ${f.getName()}`);
}
