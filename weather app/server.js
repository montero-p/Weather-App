const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'VDWCFJDEBHFJS447JXYN9Y9ZV';

app.use(express.static(__dirname));

app.get('/api/weather', async (req, res) => {
  const location = (req.query.location || '').trim();

  if (!location) {
    return res.status(400).json({ error: 'Location is required.' });
  }

  const today = new Date();
  const startDate = new Date(today);
  const endDate = new Date(today);

  startDate.setDate(today.getDate() - 1);
  endDate.setDate(today.getDate() + 1);

  const formatDate = (date) => date.toISOString().split('T')[0];
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${formatDate(startDate)}/${formatDate(endDate)}?unitGroup=metric&include=current%2Chours%2Cdays&key=${WEATHER_API_KEY}&contentType=json`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Weather service unavailable.');
    }

    const weatherData = await response.json();
    return res.json(weatherData);
  } catch (error) {
    console.error('Weather fetch failed:', error.message);
    return res.status(500).json({
      error: 'Unable to fetch weather for that location. Please try another city or town.'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Weather app server running at http://localhost:${PORT}`);
});
