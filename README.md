# Weather API

A simple weather scraper built with Node.js, Express, and Cheerio. This project fetches weather data for a given city from a target website, scrapes the necessary details, and displays them on a user-friendly interface.

## Features

- **Dynamic Weather Data:** Scrapes and displays the current weather details such as date, temperature, minimum & maximum temperature, humidity, and pressure.
- **Express Server:** Uses Express to create a lightweight API for fetching weather data.
- **Web Scraping:** Utilizes Axios to retrieve HTML content and Cheerio to parse and extract weather information.
- **Responsive Frontend:** A clean and simple interface built with HTML, CSS, and JavaScript.

## Prerequisites

- [Node.js](https://nodejs.org/) (v12 or later recommended)
- [npm](https://www.npmjs.com/)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GauravKarakoti/weather-api.git
   cd weather-scraper
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

## Usage

1. **Open the frontend:** Visit [Live Demo](https://weather-available.netlify.app)
3. **Fetch Weather Data:**
  - Enter a city name in the input field.
  - Click the **Get Weather** button.
  - The weather details will be fetched from the API and displayed on the page.

## Project Structure
- **index.html**
  The frontend interface that allows users to input a city name and displays the scraped weather information.
- **server.js**
  The backend server that:
    - Receives requests with a city parameter.
    - Fetches HTML content from a third-party weather source using Axios.
    - Parses the HTML with Cheerio to extract weather details.
    - Responds with a JSON object containing the weather data.
- **.env**
  Environment configuration file containing API endpoints, CSS selectors, and server port (this file should be copied from .env.example by the user).

### [Backend deployed here](https://weather-api-ex1z.onrender.com)
- Navigate to the desired state endpoint
- For example , For delhi , navigate to /delhi endpoint : [Delhi](https://weather-api-ex1z.onrender.com/delhi)

## Dependencies
- **Express:** Web framework for Node.js.
- **Axios:** HTTP client for making requests.
- **Cheerio:** jQuery-like tool for parsing and traversing HTML.
- **cors:** Middleware to enable Cross-Origin Resource Sharing.
- **dotenv:** Loads environment variables from a `.env` file.

## Contributing
Contributions are welcome! If you have suggestions, bug reports, or improvements, please open an issue or submit a pull request.

- Make sure to switch the link in the response variable in the `index.html` file to `http://localhost:3003/${city}` for local testing and vice-versa while raising pull request.

### For local users
1. **Start the server:**
```bash
node server.js
```
The server will start and listen on the port specified in your `.env` file (default is 3003).
2. **Open the frontend:** Open the `index.html` file in your web browser. You can either:
  - Open it directly from your file system.
  - Serve it using a static server of your choice (e.g., [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code).
3. **Fetch Weather Data:**
  - Enter a city name in the input field.
  - Click the **Get Weather** button.
  - The weather details will be fetched from the API and displayed on the page.