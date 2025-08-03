# 🌦️ Weather API - Your Personal Weather Scraper!

<a name="top"></a>
A simple yet powerful weather scraper built with **Node.js, Express, and Cheerio**. This project dynamically fetches real-time weather data for any city, scrapes the necessary details, and presents them on an intuitive user interface. 🌍☀️🌧️

---

## ✨ Features That Shine

🔹 **Real-Time Weather Data:** Get instant updates on:

- 📅 Date
- 🌡️ Temperature (Current, Min & Max)
- 💧 Humidity
- 🔽 Pressure

🔹 **Express-Powered API:** A lightweight and efficient API built with Express.js.

🔹 **Web Scraping Magic:** Uses Axios to fetch and Cheerio to extract weather details effortlessly.

🔹 **Beautiful & Responsive UI:** Clean, minimal, and user-friendly interface for seamless interaction.

---

## 🔧 Prerequisites

Before you get started, ensure you have:

✅ [Node.js](https://nodejs.org/) (v12 or later recommended)
✅ [npm](https://www.npmjs.com/) (Comes bundled with Node.js)

---

## 🚀 Quick Installation

1️⃣ **Clone the repository:**

```bash
git clone https://github.com/GauravKarakoti/weather-api.git
cd weather-api
```

2️⃣ **Install dependencies:**

```bash
npm install
```

3️⃣ **Set up environment variables:**

```bash
cp .env.example .env
```

4. ** Setup:**
   1. Create a '.env' file in the project root.
   2. Add your OpenWeatherMap API key like this :   VITE_API_KEY=your_key_here

_(Update `.env` with required API endpoint, CSS selectors, and server port.)_

---

## 🌐 Live Demo & Usage

### 🎯 Try It Online!

🚀 **[Live Frontend Demo](https://weather-available.netlify.app)** – Just enter a city name and get weather details instantly!

### 🖥️ Running Locally

1️⃣ **Start the server:**

```bash
node server.js
```

_(Server runs on the port specified in `.env`, default: `3003`)_

2️⃣ **Launch the Frontend:**

- Open `index.html` in a browser.
- Or use [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for better performance.

3️⃣ **Get Weather Updates:**

- Enter a city name 📍
- Click **Get Weather** ☁️
- See real-time weather info! 🌡️

### 🔗 Backend API (Deployed)

🌍 **[Weather API Backend](https://openweathermap.org)** – Fetch weather details via endpoints.

Example: **[Delhi Weather](https://openweathermap.org/delhi)**

---

## 📂 Project Structure

```
weather-api/
│-- frontend/
│   ├── index.html      # User Interface
│   ├── styles.css      # Styling
│   ├── script.js       # API Handling
│
│-- server/
│   ├── server.js       # Express Backend
│   ├── scraper.js      # Web Scraping Logic
│   ├── .env            # Configurations
│   ├── package.json    # Dependencies
│
└── README.md           # Documentation
```

---

## 🔧 Tech Stack & Dependencies

🛠️ **Built With:**

- **Express.js** – Fast & lightweight web framework 🚀
- **Axios** – Fetching HTML content effortlessly 🌐
- **Cheerio** – Scraping and parsing made easy 🧐
- **CORS** – Secure cross-origin requests 🔄
- **dotenv** – Manages environment variables 🔐
- **Jest** - Efficient And RObut management for testing 💪🏻

---

## 🤝 Contributions Welcome!

💡 Have suggestions or improvements? Open an issue or submit a pull request!

### 🔄 Local Development Notes

🔹 When testing locally, switch the API endpoint in `index.html`:

```js
const apiUrl = `http://localhost:3003/${city}`;
```

🔹 Before submitting a **pull request**, revert it to the deployed API.

---

🚀 **Stay Ahead of the Weather – One City at a Time!** 🌍☀️🌧️

[🔝 Back to Top](#top)
