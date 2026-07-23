const fs = require('fs');
const file = 'src_demo/components/layout/RightSidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "<OrderBookPanel livePrice={props.livePrice} selectedCoin={props.selectedCoin} />",
  "<OrderBookPanel livePrice={props.livePrice} selectedCoin={props.selectedCoin} selectedExchange={props.selectedExchange} />"
);

fs.writeFileSync(file, code);
console.log("Successfully added selectedExchange to OrderBookPanel in RightSidebar.tsx");
