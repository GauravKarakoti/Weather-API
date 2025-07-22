/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");

describe("Weather App Tests", () => {
  let html;
  let script;

  beforeAll(() => {
    html = fs.readFileSync(path.resolve(__dirname, "../public/index.html"), "utf8");
    document.documentElement.innerHTML = html;
    script = require("../public/script.js");
    global.script = script;
  });

  beforeEach(() => {
    Storage.prototype.setItem = jest.fn(); // ✅ mock setItem
    localStorage.clear();
  });

  test("should store recent searches in localStorage", () => {
    global.script.addToRecentSearches("London");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "recentSearches",
      JSON.stringify(["London"])
    );
  });
});
