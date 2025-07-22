const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require("supertest");
const { app, server } = require("../server");

afterAll((done) => {
  server.close(done); // Ensures server is closed after tests
});

describe("GET /api/version", () => {
  it("should return version info", async () => {
    const res = await request(app).get("/api/version");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(typeof res.body.version).toBe("string"); // optional: extra validation
  });
});
