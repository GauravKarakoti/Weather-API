# 🌦️ Weather API - Your Personal Weather Scraper!

![GSSoC Logo](./public/assets/gssoc%20logo.png)
<img src="https://s2apertre.resourcio.in/Logo_primary.svg" alt="Apertre 2025" />

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

🌍 **[Weather API Backend](https://weather-api-ex1z.onrender.com)** – Fetch weather details via endpoints.

Example: **[Delhi Weather](https://weather-api-ex1z.onrender.com/delhi)**

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

## 🤝 Contributors:

We love our contributors! If you'd like to help, please check out our [`CONTRIBUTE.md`](https://github.com/GauravKarakoti/Weather-API/blob/main/Contributing.md) file for guidelines.

Thanks to these amazing people who have contributed to the **Weather-API** project:

<!-- readme: contributors -start -->
<p align="center">
    <img src="https://api.vaunt.dev/v1/github/entities/GauravKarakoti/repositories/Weather-API/contributors?format=svg&limit=54" width="1000" />
</p>
<!-- readme: contributors -end -->

---

## 📬 Contact

Have ideas, feedback, or just want to say hi?
- 🛠️ Open an issue in the repository

---

## 📜 Code of Conduct

To ensure a welcoming and inclusive environment, we have a Code of Conduct that all contributors are expected to follow. In short: **Be respectful, be kind, and be collaborative.** Please read the full [Code of Conduct](https://github.com/GauravKarakoti/Weather-API/blob/main/Code%20of%20Conduct.md) before participating.

---

## 📄 License

This project is licensed under the [MIT License](https://github.com/GauravKarakoti/Weather-API/blob/main/LICENSE.md).

---

## 💡 Suggestions & Feedback
Feel free to open issues or discussions if you have any feedback, feature suggestions, or want to collaborate!

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

<p align="center">
  Thank you for your support!
  <br>
  <br>
  <a href="https://github.com/GauravKarakoti/Weather-API/stargazers">
    <img src="https://img.shields.io/github/stars/GauravKarakoti/Weather-API?style=for-the-badge&logo=github&color=FFC107&logoColor=white" alt="GitHub Stars">
  </a>
</p>

---
🚀 **Stay Ahead of the Weather – One City at a Time!** 🌍☀️🌧️

[🔝 Back to Top](#top)
