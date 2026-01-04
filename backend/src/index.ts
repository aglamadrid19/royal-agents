import { config } from "./config";
import { initDb } from "./db";
import { ChainClient } from "./chain";
import { createApp } from "./app";

const db = initDb(config.databasePath);
const chain = new ChainClient();
const app = createApp({ db, chain });

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`RoyalAgents backend listening on :${config.port}`);
});
