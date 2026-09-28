const defaultLocation = 'London';

const weatherForm = document.getElementById('weatherForm');
const locationInput = document.getElementById('locationInput');
const citySelect = document.getElementById('citySelect');
const refreshBtn = document.getElementById('refreshBtn');
const geoBtn = document.getElementById('geoBtn');
const statusMessage = document.getElementById('statusMessage');
const quickActions = document.querySelectorAll('.quick-action');

const locationName = document.getElementById('locationName');
const weatherIcon = document.getElementById('weatherIcon');
const currentTemp = document.getElementById('currentTemp');
const weatherDescription = document.getElementById('weatherDescription');
const windSpeed = document.getElementById('windSpeed');
const rainChance = document.getElementById('rainChance');
const humidity = document.getElementById('humidity');
const uvIndex = document.getElementById('uvIndex');
const airQuality = document.getElementById('airQuality');

const futureDateLabel = document.getElementById('futureDateLabel');
const futureSummary = document.getElementById('futureSummary');

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', isError);
}

function setActiveQuickAction(locationNameValue) {
  quickActions.forEach((button) => {
    const isActive = (button.dataset.location || '').toLowerCase() === (locationNameValue || '').toLowerCase();
    button.classList.toggle('active', isActive);
  });
}

function formatDateLabel(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatHourLabel(dateString, fallbackDate = null) {
  if (!dateString) return '--';

  const candidate = fallbackDate && dateString.includes(':') && !dateString.includes('-')
    ? `${fallbackDate}T${dateString}`
    : dateString;

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
  }).format(date);
}

function weatherIconForCondition(condition = '') {
  const normalized = condition.toLowerCase();

  if (normalized.includes('rain') || normalized.includes('thunder')) return '🌧️';
  if (normalized.includes('snow')) return '❄️';
  if (normalized.includes('fog') || normalized.includes('mist')) return '🌫️';
  if (normalized.includes('cloud')) return '☁️';
  return '☀️';
}

function safeAverage(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function getDominantWeather(segments) {
  if (!segments || !segments.length) return 'Clear';

  const counts = {};
  segments.forEach((segment) => {
    const weather = segment.conditions || 'Clear';
    counts[weather] = (counts[weather] || 0) + 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function buildPeriodMarkup(day, label, isFuture = false) {
  if (!day) {
    return '<p>Forecast unavailable.</p>';
  }

  const hours = day.hours || [];
  const dayTemps = hours.map((entry) => Number(entry.temp)).filter((value) => Number.isFinite(value));
  const rainChanceValues = hours.map((entry) => Number(entry.precipprob)).filter((value) => Number.isFinite(value));
  const windValues = hours.map((entry) => Number(entry.windspeed)).filter((value) => Number.isFinite(value));

  const avgTemp = Math.round(safeAverage(dayTemps));
  const rainChanceValue = Math.round(safeAverage(rainChanceValues));
  const windValue = Math.round(safeAverage(windValues));
  const dominantWeather = getDominantWeather(hours);
  const hourlySample = hours.slice(0, 5).map((entry) => `
    <div class="hour-pill">
      <span>${formatHourLabel(entry.datetime, day.datetime)}</span>
      <strong>${Math.round(Number(entry.temp || 0))}°</strong>
    </div>
  `).join('');

  const cardLabel = isFuture ? 'Forecast outlook' : 'Recent outlook';

  return `
    <div class="period-metrics">
      <div class="metric">
        <span>${cardLabel}</span>
        <strong>${dominantWeather}</strong>
      </div>
      <div class="metric">
        <span>Avg temp</span>
        <strong>${avgTemp}°C</strong>
      </div>
      <div class="metric">
        <span>Rain chance</span>
        <strong>${rainChanceValue}%</strong>
      </div>
      <div class="metric">
        <span>Wind</span>
        <strong>${windValue} km/h</strong>
      </div>
      <div class="metric">
        <span>Range</span>
        <strong>${Math.round(Number(day.tempmin || 0))}° - ${Math.round(Number(day.tempmax || 0))}°</strong>
      </div>
      <div class="metric">
        <span>Summary</span>
        <strong>${day.conditions || 'Clear'}</strong>
      </div>
    </div>
    <div class="hourly-list">${hourlySample}</div>
  `;
}

function getAirQualityLabel(current, rainProbability = 0) {
  const temp = Number(current.temp) || 20;
  const humidityValue = Number(current.humidity) || 50;
  const windValue = Number(current.windspeed) || 0;

  let score = 80;
  score -= Math.max(0, temp - 30) * 1.2;
  score -= Math.max(0, humidityValue - 60) * 0.5;
  score += windValue * 0.6;
  score -= rainProbability * 0.25;

  if (score >= 70) return 'Good';
  if (score >= 45) return 'Moderate';
  return 'Poor';
}

function applyWeatherTheme(current, conditionText) {
  const temp = Number(current.temp) || 20;
  const uv = Number(current.uvindex) || 0;
  const rainProbability = Number(current.precipprob) || 0;
  const airQualityText = getAirQualityLabel(current, rainProbability);

  const root = document.documentElement;

  let state = 'default';

  if (temp >= 30 || (conditionText.toLowerCase().includes('heat') && temp >= 26)) {
    root.style.setProperty('--bg-dark', '#2a0d17');
    root.style.setProperty('--bg-mid', '#6f1d2a');
    root.style.setProperty('--panel', 'rgba(54, 18, 27, 0.8)');
    root.style.setProperty('--line', 'rgba(255, 180, 180, 0.24)');
    root.style.setProperty('--text', '#fff1f4');
    root.style.setProperty('--text-soft', '#ffd1dd');
    root.style.setProperty('--accent', '#ff7a7a');
    root.style.setProperty('--accent-2', '#ffb0a1');
    state = 'hot';
  } else if (temp <= 8) {
    root.style.setProperty('--bg-dark', '#071b2a');
    root.style.setProperty('--bg-mid', '#1d4f75');
    root.style.setProperty('--panel', 'rgba(12, 34, 52, 0.8)');
    root.style.setProperty('--line', 'rgba(170, 225, 255, 0.24)');
    root.style.setProperty('--text', '#edfaff');
    root.style.setProperty('--text-soft', '#cfefff');
    root.style.setProperty('--accent', '#7cd6ff');
    root.style.setProperty('--accent-2', '#9be7ff');
    state = 'cold';
  } else if (rainProbability >= 50 || conditionText.toLowerCase().includes('rain') || conditionText.toLowerCase().includes('storm')) {
    root.style.setProperty('--bg-dark', '#062d39');
    root.style.setProperty('--bg-mid', '#0f5f69');
    root.style.setProperty('--panel', 'rgba(10, 36, 48, 0.8)');
    root.style.setProperty('--line', 'rgba(142, 227, 233, 0.22)');
    root.style.setProperty('--text', '#ecfffe');
    root.style.setProperty('--text-soft', '#b8f6f4');
    root.style.setProperty('--accent', '#4ec5d4');
    root.style.setProperty('--accent-2', '#7dd9c4');
    state = 'rain';
  } else if (uv >= 7) {
    root.style.setProperty('--bg-dark', '#220d3a');
    root.style.setProperty('--bg-mid', '#6a1d78');
    root.style.setProperty('--panel', 'rgba(41, 21, 58, 0.8)');
    root.style.setProperty('--line', 'rgba(233, 171, 255, 0.24)');
    root.style.setProperty('--text', '#fdf2ff');
    root.style.setProperty('--text-soft', '#f1d1ff');
    root.style.setProperty('--accent', '#d170ff');
    root.style.setProperty('--accent-2', '#ff72d5');
    state = 'uv';
  } else if (airQualityText === 'Poor') {
    root.style.setProperty('--bg-dark', '#1e1633');
    root.style.setProperty('--bg-mid', '#422e72');
    root.style.setProperty('--panel', 'rgba(31, 22, 52, 0.82)');
    root.style.setProperty('--line', 'rgba(201, 171, 255, 0.24)');
    root.style.setProperty('--text', '#f6f0ff');
    root.style.setProperty('--text-soft', '#d9ccff');
    root.style.setProperty('--accent', '#8d6cff');
    root.style.setProperty('--accent-2', '#6d5ef7');
    state = 'air';
  } else if (Number(current.windspeed) >= 20) {
    root.style.setProperty('--bg-dark', '#062d35');
    root.style.setProperty('--bg-mid', '#0e6c6a');
    root.style.setProperty('--panel', 'rgba(12, 44, 52, 0.8)');
    root.style.setProperty('--line', 'rgba(156, 246, 244, 0.22)');
    root.style.setProperty('--text', '#edfffe');
    root.style.setProperty('--text-soft', '#c9fff8');
    root.style.setProperty('--accent', '#74f1d5');
    root.style.setProperty('--accent-2', '#7ce8ff');
    state = 'wind';
  } else {
    root.style.setProperty('--bg-dark', '#081a2d');
    root.style.setProperty('--bg-mid', '#122b46');
    root.style.setProperty('--panel', 'rgba(15, 29, 46, 0.82)');
    root.style.setProperty('--line', 'rgba(166, 196, 255, 0.18)');
    root.style.setProperty('--text', '#eff7ff');
    root.style.setProperty('--text-soft', '#c7dbf8');
    root.style.setProperty('--accent', '#76d4ff');
    root.style.setProperty('--accent-2', '#8be2a8');
    state = 'default';
  }

  document.body.dataset.weatherState = state;
}

function renderCurrentWeather(data) {
  const current = data.currentConditions || {};
  const resolvedAddress = data.resolvedAddress || data.address || 'Current location';
  const currentCondition = current.conditions || 'Clear';

  locationName.textContent = resolvedAddress;
  weatherIcon.textContent = weatherIconForCondition(currentCondition);
  currentTemp.textContent = Number.isFinite(Number(current.temp)) ? Math.round(Number(current.temp)) : '--';
  weatherDescription.textContent = currentCondition;
  windSpeed.textContent = Number.isFinite(Number(current.windspeed)) ? `${Math.round(Number(current.windspeed))} km/h` : '--';
  rainChance.textContent = Number.isFinite(Number(current.precipprob)) ? `${Math.round(Number(current.precipprob))}%` : '--';
  humidity.textContent = Number.isFinite(Number(current.humidity)) ? `${Math.round(Number(current.humidity))}%` : '--';
  uvIndex.textContent = Number.isFinite(Number(current.uvindex)) ? `${Math.round(Number(current.uvindex))}` : '--';
  const airQualityValue = getAirQualityLabel(current, Number(current.precipprob) || 0);
  airQuality.textContent = airQualityValue;
  applyWeatherTheme(current, currentCondition);
}

function renderPeriodWeather(data) {
  const days = data.days || [];
  const nextDay = days[1] || days[0] || null;

  futureDateLabel.textContent = nextDay ? formatDateLabel(nextDay.datetime) : '--';
  futureSummary.innerHTML = buildPeriodMarkup(nextDay, 'Expected weather', true);
}

async function fetchWeather(location = '', coordinates = null) {
  const cleanedLocation = (location || '').trim();

  if (!cleanedLocation && !coordinates) {
    setStatus('Please enter a location to check the weather.', true);
    return;
  }

  setStatus('Loading weather data...');

  try {
    const params = new URLSearchParams();

    if (coordinates) {
      params.set('lat', coordinates.latitude);
      params.set('lon', coordinates.longitude);
    } else if (cleanedLocation) {
      params.set('location', cleanedLocation);
    }

    const response = await fetch(`/api/weather?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Location not found or weather service unavailable.');
    }

    renderCurrentWeather(data);
    renderPeriodWeather(data);
    setStatus(`Showing weather for ${data.resolvedAddress || (coordinates ? 'your location' : cleanedLocation)}.`);
  } catch (error) {
    setStatus(error.message || 'Something went wrong while fetching the weather.', true);
    locationName.textContent = 'Weather unavailable';
    weatherIcon.textContent = '⚠️';
    currentTemp.textContent = '--';
    weatherDescription.textContent = 'Unable to load';
    windSpeed.textContent = '--';
    rainChance.textContent = '--';
    humidity.textContent = '--';
    futureSummary.innerHTML = '<p>Unable to load expected weather.</p>';
  }
}

quickActions.forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.location || defaultLocation;
    locationInput.value = value;
    citySelect.value = value;
    setActiveQuickAction(value);
    fetchWeather(value);
  });
});

weatherForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = locationInput.value.trim();
  if (citySelect && value) {
    citySelect.value = value;
    setActiveQuickAction(value);
  }
  fetchWeather(value);
});

citySelect.addEventListener('change', () => {
  const value = citySelect.value.trim();
  if (!value) return;
  locationInput.value = value;
  setActiveQuickAction(value);
  fetchWeather(value);
});

refreshBtn.addEventListener('click', () => {
  const value = (locationInput.value || citySelect.value || defaultLocation).trim();
  fetchWeather(value);
});

geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Geolocation is not supported by this browser.', true);
    return;
  }

  setStatus('Finding your location...');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationInput.value = 'My location';
      citySelect.value = 'London';
      fetchWeather('', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    () => {
      setStatus('Unable to access your location. Please search for a city manually.', true);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

locationInput.value = defaultLocation;
citySelect.value = defaultLocation;
setActiveQuickAction(defaultLocation);
fetchWeather(defaultLocation);
