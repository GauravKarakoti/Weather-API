import React, { useEffect, useState } from 'react';

const API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with your API Key
const CITY = 'London'; // Or dynamically set this

function ThreeDayForecast() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchForecast() {
      try {
        setLoading(true);
        setError('');
        // OpenWeatherMap's 3-day forecast uses the "forecast" endpoint (5-day/3-hourly)
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${CITY}&cnt=24&units=metric&appid=${API_KEY}`
        );
        const data = await response.json();
        if (data.cod !== "200") throw new Error(data.message);

        // Process to get 3 days (e.g., group by date)
        const daily = {};
        data.list.forEach(item => {
          const date = item.dt_txt.split(' ')[0];
          if (!daily[date]) daily[date] = [];
          daily[date].push(item);
        });
        // Get the first 3 days
        const threeDays = Object.keys(daily).slice(0, 3).map(date => {
          // Average temp, get weather for noon
          const midday = daily[date].find(d => d.dt_txt.includes("12:00:00")) || daily[date][0];
          return {
            date,
            temp: midday.main.temp,
            weather: midday.weather[0].description,
            icon: midday.weather[0].icon
          };
        });

        setForecast(threeDays);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchForecast();
  }, []);

  if (loading) return <div>Loading forecast...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      {forecast.map((day, i) => (
        <div key={i} style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '1rem',
          width: '160px',
          background: '#f5f7fa',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h4>{new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
          <img alt={day.weather} src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`} />
          <p style={{ fontSize: '2em', margin: '0.5em 0' }}>{Math.round(day.temp)}°C</p>
          <p style={{ textTransform: 'capitalize' }}>{day.weather}</p>
        </div>
      ))}
    </div>
  );
}

export default ThreeDayForecast;
