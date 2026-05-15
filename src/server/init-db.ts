import "dotenv/config";

import { initializeDatabase } from "./db.js";

initializeDatabase();
console.log("Database is ready.");
