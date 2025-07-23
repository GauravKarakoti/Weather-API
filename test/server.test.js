
const request = require("supertest");
const { app, server } = require("../server");
const axios = require("axios");
const nodemailer = require("nodemailer");

jest.mock("nodemailer");

describe("Weather API Endpoint", () => {
  beforeAll(() => {
    // Mock axios.get
    const mockHtml = `
      <div class="wtr_tmp_rhs">20°C</div>
      <div class="wtr_hdr_rhs_ul"><li><span class="wtr_hdr_rhs_val">15°C / 25°C</span></li></div>
      <div class="wtr_crd_li"><span class="wtr_crd_rhs">70% Humidity, 1010 hPa</span></div>
      <div class="wtr_tmp_lhs">Sunny</div>
      <div class="wtr_hdr_dte">2025-07-23</div>
    `;
    jest.spyOn(axios, "get").mockResolvedValue({ data: mockHtml });

    // Mock nodemailer
    const mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });
    nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  afterAll(() => {
    server.close();
    jest.restoreAllMocks();
  });

  test("should return weather data for a valid city", async () => {
    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("temperature");
    expect(response.body).toHaveProperty("condition");
  });

  test("should return 400 for an invalid city name", async () => {
    const response = await request(app).get("/api/weather/x");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Invalid city name. Use letters, spaces, apostrophes (') and hyphens (-)"
    );
  });

  test("should return 404 for a non-existent city", async () => {
    jest.spyOn(axios, "get").mockRejectedValue({ response: { status: 404 } });
    const response = await request(app).get("/api/weather/InvalidCity");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("City not found. Please check the spelling.");
  });

  test("should return 503 for server errors", async () => {
    jest.spyOn(axios, "get").mockRejectedValue(new Error("Simulated server error"));
    const response = await request(app).get("/api/weather/London");
    expect(response.status).toBe(503);
    expect(response.body.error).toBe("Weather service temporarily unavailable.");
  });

  test("should send email alert for selector failure", async () => {
    process.env.TEMPERATURE_CLASS = "";
    await request(app).get("/api/weather/London"); // Removed unused 'response'
    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: process.env.ADMIN_EMAIL,
        subject: "Weather API Selector Failure Alert",
      })
    );
  });
});

describe("Rate Limiting", () => {
  test("should return 429 when exceeding rate limit for /api/weather", async () => {
    jest.setTimeout(10000);
    const apiKey = "test-api-key";
    const headers = { "x-api-key": apiKey };
    jest.spyOn(axios, "get").mockResolvedValue({
      data: `
        <div class="wtr_tmp_rhs">20°C</div>
        <div class="wtr_hdr_rhs_ul"><li><span class="wtr_hdr_rhs_val">15°C / 25°C</span></li></div>
        <div class="wtr_crd_li"><span class="wtr_crd_rhs">70% Humidity, 1010 hPa</span></div>
        <div class="wtr_tmp_lhs">Sunny</div>
        <div class="wtr_hdr_dte">2025-07-23</div>
      `,
    });
    for (let i = 0; i < 51; i++) {
      await request(app).get("/api/weather/London").set(headers);
    }
    const response = await request(app).get("/api/weather/London").set(headers);
    expect(response.status).toBe(429);
    expect(response.body.error).toBe(
      "Too many requests to the weather API. Please try again later."
    );
  });

  test("should not apply rate limit to different endpoints", async () => {
    const response = await request(app).get("/api/version");
    expect(response.status).toBe(200);
  });
});
