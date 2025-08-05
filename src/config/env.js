const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

function configureEnv() {
  const result = dotenv.config();
  if (result.error) {
    const examplePath = path.join(__dirname, "../../.env.example");
    if (fs.existsSync(examplePath)) {
      dotenv.config({ path: examplePath });
      console.warn("Using .env.example. Please create a .env file.");
    } else {
      console.error("No .env or .env.example file found!");
      process.exit(1);
    }
  }
}

module.exports = { configureEnv };
