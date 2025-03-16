const request = require("supertest");
const { app, server } = require("../server");
const axios = require("axios");

describe("Weather API Endpoint", () => {
    afterAll(() => {
        server.close();
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
        expect(response.body.error).toBe("Invalid city name. Please enter a valid city.");
    });

    test("should return 404 for a non-existent city", async () => {
        const response = await request(app).get("/api/weather/InvalidCity");
        expect(response.status).toBe(404);
        expect(response.body.error)
            .toMatch(/City not found. Please enter a valid city name.|Weather data not found for the specified city./);
    });

    test("should return 500 for server errors", async () => {
        jest.spyOn(axios, "get").mockRejectedValue(new Error("Simulated server error"));

        const response = await request(app).get("/api/weather/London");
        expect(response.status).toBe(500);
        expect(response.body.error).toBe("Failed to retrieve weather data.");
    });
});

