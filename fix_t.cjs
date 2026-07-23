const fs = require('fs');
const file = 'src_demo/components/layout/RightSidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "<RightSidebarWatchlist {...props} />",
  "<RightSidebarWatchlist {...props} t={t} />"
);

code = code.replace(
  "<RightSidebarDetails {...props} />",
  "<RightSidebarDetails {...props} t={t} />"
);

fs.writeFileSync(file, code);
console.log("Successfully added t={t} to Watchlist and Details in RightSidebar.tsx");
