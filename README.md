# 🌦️ Weather API - Your Personal Weather Scraper!

![GSSoC Logo](https://github.com/GauravKarakoti/Weather-API/blob/main/public/assets/gssoc%20logo.png)

<tr>
<td align="center">
<a href="https://s2apertre.resourcio.in"><img src="https://s2apertre.resourcio.in/Logo_primary.svg" height="140px" width="180px" alt="Apertre 2025"></a>
</td>
</tr>

A simple yet powerful weather scraper built with **Node.js, Express, and Cheerio**. This project dynamically fetches real-time weather data for any city, scrapes the necessary details, and presents them on an intuitive user interface. 🌍☀️🌧️

[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/GauravKarakoti/Weather-API)

<table align="center">
    <thead align="center">
        <tr border: 1px;>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Star.png" width="20" height="20"> Stars</b></td>
            <td><b>🍴 Forks</b></td>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Lady%20Beetle.png" width="20" height="20"> Issues</b></td>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Check%20Mark%20Button.png" width="20" height="20"> Open PRs</b></td>
            <td><b><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/tarikul-islam-anik/main/assets/images/Cross%20Mark.png" width="20" height="20"> Closed PRs</b></td>
        </tr>
     </thead>
    <tbody>
         <tr>
            <td><img alt="Stars" src="https://img.shields.io/github/stars/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
             <td><img alt="Forks" src="https://img.shields.io/github/forks/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
            <td><img alt="Issues" src="https://img.shields.io/github/issues/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
            <td><img alt="Open Pull Requests" src="https://img.shields.io/github/issues-pr/GauravKarakoti/Weather-API?style=flat&logo=github"/></td>
           <td><img alt="Closed Pull Requests" src="https://img.shields.io/github/issues-pr-closed/GauravKarakoti/Weather-API?style=flat&color=critical&logo=github"/></td>
        </tr>
    </tbody>
</table>

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

<h2>Project Admin:</h2>
<table>
<tr>
<td align="center">
<a href="https://github.com/GauravKarakoti"><img src="https://avatars.githubusercontent.com/u/180496085?v=4" height="140px" width="140px" alt="Gaurav Karakoti "></a><br><sub><b>Gaurav Karakoti </b><br><a href="https://www.linkedin.com/in/gaurav-karakoti-248960302/"><img src="https://github-production-user-asset-6210df.s3.amazonaws.com/73993775/278833250-adb040ea-e3ef-446e-bcd4-3e8d7d4c0176.png" width="45px" height="45px"></a></sub>
</td>
</tr>
</table>

---
<div align="center">
  <h2 style="font-size:3rem;">Our Contributors <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png" alt="Red Heart" width="40" height="40" /></h2>
 
  We love our contributors! If you'd like to help, please check out our [CONTRIBUTE.md](https://github.com/GauravKarakoti/Weather-API/blob/main/Contributing.md) file for guidelines.
  
  <h3>Thanks to these amazing people who have contributed to the **Weather-API** project:</h3>
<p align="center">
    <img src="https://api.vaunt.dev/v1/github/entities/GauravKarakoti/repositories/Weather-API/contributors?format=svg&limit=54" width="1000" />
</p>
<p style="font-family:var(--ff-philosopher);font-size:3rem;"><b> Show some <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png" alt="Red Heart" width="40" height="40" /> by starring this awesome repository!
</p>
 </div>
---
🚀 **Stay Ahead of the Weather – One City at a Time!** 🌍☀️🌧️

---
 **👨‍💻 Developed By**  **❤️GauravKarakoti❤️** 
[GitHub](https://github.com/GauravKarakoti) | [LinkedIn](https://www.linkedin.com/in/gaurav-karakoti/)

[🔝 Back to Top](#top)
