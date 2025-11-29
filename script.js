

const CONFIG = {
    API_BASE_URL: 'api.php',
    DEFAULT_CITY: 'Jakarta',
    AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, 
    SEARCH_DEBOUNCE_DELAY: 500, 
    FAVORITES_KEY: 'weatherDashboard_favorites'
};


let currentState = {
    city: CONFIG.DEFAULT_CITY,
    unit: 'celsius',
    weatherData: null,
    forecastData: null,
    autoRefreshTimer: null,
    searchDebounceTimer: null
};


const elements = {
    citySearch: document.getElementById('citySearch'),
    searchBtn: document.getElementById('searchBtn'),
    suggestions: document.getElementById('suggestions'),
    
    refreshBtn: document.getElementById('refreshBtn'),
    favoritesBtn: document.getElementById('favoritesBtn'),
    addFavoriteBtn: document.getElementById('addFavoriteBtn'),
    
    themeToggle: document.getElementById('themeToggle'),
    
    unitCelsius: document.getElementById('unitCelsius'),
    unitFahrenheit: document.getElementById('unitFahrenheit'),
    
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorMessage: document.getElementById('errorMessage'),
    errorText: document.getElementById('errorText'),
    weatherContent: document.getElementById('weatherContent'),
    
    currentCity: document.getElementById('currentCity'),
    currentDate: document.getElementById('currentDate'),
    currentIcon: document.getElementById('currentIcon'),
    currentTemp: document.getElementById('currentTemp'),
    currentDescription: document.getElementById('currentDescription'),
    feelsLike: document.getElementById('feelsLike'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('windSpeed'),
    tempMin: document.getElementById('tempMin'),
    tempMax: document.getElementById('tempMax'),
    pressure: document.getElementById('pressure'),
    clouds: document.getElementById('clouds'),
    
    forecastContainer: document.getElementById('forecastContainer'),
    
    favoritesModal: document.getElementById('favoritesModal'),
    favoritesList: document.getElementById('favoritesList'),
    closeFavoritesBtn: document.getElementById('closeFavoritesBtn')
};


function convertTemperature(celsius, toUnit) {
    if (toUnit === 'fahrenheit') {
        return (celsius * 9/5) + 32;
    }
    return celsius;
}

function formatTemperature(celsius, unit = currentState.unit) {
    const temp = convertTemperature(celsius, unit);
    const symbol = unit === 'celsius' ? '°C' : '°F';
    return `${Math.round(temp)}${symbol}`;
}

function formatDate(timestamp, timezone = 0) {
    const date = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('id-ID', options);
}

function formatForecastDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const day = date.getDate();
    
    return `${dayName}, ${monthName} ${day}`;
}

function getWeatherIconUrl(iconCode) {
    return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
}

function getWeatherEmoji(iconCode) {
    const iconMap = {
        '01d': '☀️', '01n': '🌙',
        '02d': '⛅', '02n': '☁️',
        '03d': '☁️', '03n': '☁️',
        '04d': '☁️', '04n': '☁️',
        '09d': '🌧️', '09n': '🌧️',
        '10d': '🌦️', '10n': '🌧️',
        '11d': '⛈️', '11n': '⛈️',
        '13d': '❄️', '13n': '❄️',
        '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[iconCode] || '🌤️';
}

function showLoading() {
    elements.loadingIndicator.classList.remove('hidden');
    elements.weatherContent.classList.add('hidden');
    elements.errorMessage.classList.add('hidden');
}

function hideLoading() {
    elements.loadingIndicator.classList.add('hidden');
}

function showError(message) {
    elements.errorText.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    elements.weatherContent.classList.add('hidden');
    hideLoading();
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}


async function makeApiRequest(action, params = {}) {
    try {
        const queryParams = new URLSearchParams({
            action: action,
            ...params
        });
        
        const url = `${CONFIG.API_BASE_URL}?${queryParams.toString()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        return {
            success: false,
            error: 'Network error. Please check your connection.'
        };
    }
}

async function fetchCurrentWeather(city) {
    const response = await makeApiRequest('current', { city: city });
    
    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch weather data');
    }
    
    return response.data;
}

async function fetchForecast(city) {
    const response = await makeApiRequest('forecast', { city: city });
    
    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch forecast data');
    }
    
    return response.data;
}

async function searchCity(query) {
    const response = await makeApiRequest('search', { q: query });
    return response;
}


function processForecastData(forecastList) {
    const dailyForecasts = [];
    const processedDates = new Set();
    
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateString = date.toDateString();
        
        const hour = date.getHours();
        
        if (!processedDates.has(dateString)) {
            if (hour >= 11 && hour <= 14) {
                dailyForecasts.push(item);
                processedDates.add(dateString);
            }
        }
    });
    
    if (dailyForecasts.length < 5) {
        processedDates.clear();
        dailyForecasts.length = 0;
        
        forecastList.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dateString = date.toDateString();
            
            if (!processedDates.has(dateString) && dailyForecasts.length < 5) {
                dailyForecasts.push(item);
                processedDates.add(dateString);
            }
        });
    }
    
    return dailyForecasts.slice(0, 5); // Return max 5 days
}

function getDailyMinMax(forecastList, targetDate) {
    const sameDayForecasts = forecastList.filter(item => {
        const itemDate = new Date(item.dt * 1000).toDateString();
        return itemDate === targetDate;
    });
    
    if (sameDayForecasts.length === 0) {
        return { min: null, max: null };
    }
    
    const temps = sameDayForecasts.map(item => item.main.temp);
    return {
        min: Math.min(...temps),
        max: Math.max(...temps)
    };
}


function updateCurrentWeather(data) {
    currentState.weatherData = data;
    
    elements.currentCity.textContent = `${data.city}, ${data.country}`;
    elements.currentDate.textContent = formatDate(data.timestamp, data.timezone);
    
    elements.currentTemp.textContent = formatTemperature(data.temperature);
    elements.feelsLike.textContent = formatTemperature(data.feels_like);
    elements.tempMin.textContent = formatTemperature(data.temp_min);
    elements.tempMax.textContent = formatTemperature(data.temp_max);
    
    elements.currentDescription.textContent = data.weather.description;
    
    const iconUrl = getWeatherIconUrl(data.weather.icon);
    elements.currentIcon.innerHTML = `<img src="${iconUrl}" alt="${data.weather.description}" class="w-32 h-32">`;
    
    elements.humidity.textContent = `${data.humidity}%`;
    elements.windSpeed.textContent = `${data.wind_speed} m/s`;
    elements.pressure.textContent = `${data.pressure} hPa`;
    elements.clouds.textContent = `${data.clouds}%`;
    
    elements.weatherContent.classList.remove('hidden');
}

function updateForecast(data) {
    currentState.forecastData = data;
    
    const dailyForecasts = processForecastData(data.list);
    
    elements.forecastContainer.innerHTML = '';
    
    dailyForecasts.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const dateString = date.toDateString();
        
        const { min, max } = getDailyMinMax(data.list, dateString);
        
        const card = document.createElement('div');
        card.className = 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:bg-gray-800 rounded-md shadow-sm p-2 transition-all duration-200 hover:shadow-md border border-teal-100 dark:border-gray-700 h-full flex flex-col';
        
        card.innerHTML = `
            <div class="flex flex-col items-center text-center gap-1 flex-1 justify-between">
                <p class="text-teal-700 dark:text-gray-400 font-bold text-xs">
                    ${formatForecastDate(forecast.dt)}
                </p>
                <div class="flex flex-col items-center gap-1">
                    <img src="${getWeatherIconUrl(forecast.weather[0].icon)}" 
                         alt="${forecast.weather[0].description}" 
                         class="w-12 h-12">
                    <p class="text-teal-600 dark:text-gray-300 capitalize text-xs font-medium truncate w-full">
                        ${forecast.weather[0].description}
                    </p>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                    <p class="text-lg font-bold text-cyan-700 dark:text-white">
                        ${formatTemperature(forecast.main.temp)}
                    </p>
                    ${min !== null && max !== null ? `
                        <p class="text-xs text-teal-600 dark:text-gray-400 font-semibold">
                            <span class="text-cyan-600 dark:text-cyan-400">${formatTemperature(min)}</span>/<span class="text-rose-600 dark:text-rose-400">${formatTemperature(max)}</span>
                        </p>
                    ` : ''}
                    <div class="flex items-center space-x-0.5 text-xs text-teal-600 dark:text-gray-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
                        </svg>
                        <span>${forecast.main.humidity}%</span>
                    </div>
                </div>
            </div>
        `;
        
        elements.forecastContainer.appendChild(card);
    });
}

async function loadWeatherData(city) {
    try {
        showLoading();
        hideError();
        
        currentState.city = city;
        
        const [currentData, forecastData] = await Promise.all([
            fetchCurrentWeather(city),
            fetchForecast(city)
        ]);
        
        updateCurrentWeather(currentData);
        updateForecast(forecastData);
        
        hideLoading();
        
        resetAutoRefresh();
        
    } catch (error) {
        console.error('Error loading weather data:', error);
        showError(error.message || 'Failed to load weather data. Please try again.');
    }
}


function switchUnit(newUnit) {
    if (currentState.unit === newUnit) return;
    
    currentState.unit = newUnit;
    
    if (newUnit === 'celsius') {
        elements.unitCelsius.classList.add('bg-blue-600', 'text-white');
        elements.unitCelsius.classList.remove('text-gray-600', 'dark:text-gray-300');
        elements.unitFahrenheit.classList.remove('bg-blue-600', 'text-white');
        elements.unitFahrenheit.classList.add('text-gray-600', 'dark:text-gray-300');
    } else {
        elements.unitFahrenheit.classList.add('bg-blue-600', 'text-white');
        elements.unitFahrenheit.classList.remove('text-gray-600', 'dark:text-gray-300');
        elements.unitCelsius.classList.remove('bg-blue-600', 'text-white');
        elements.unitCelsius.classList.add('text-gray-600', 'dark:text-gray-300');
    }
    
    if (currentState.weatherData) {
        updateCurrentWeather(currentState.weatherData);
    }
    if (currentState.forecastData) {
        updateForecast(currentState.forecastData);
    }
}


function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}


function startAutoRefresh() {
    stopAutoRefresh(); // Clear existing timer
    
    currentState.autoRefreshTimer = setInterval(() => {
        console.log('Auto-refreshing weather data...');
        loadWeatherData(currentState.city);
    }, CONFIG.AUTO_REFRESH_INTERVAL);
    
    console.log(`Auto-refresh enabled: Every ${CONFIG.AUTO_REFRESH_INTERVAL / 1000 / 60} minutes`);
}

function stopAutoRefresh() {
    if (currentState.autoRefreshTimer) {
        clearInterval(currentState.autoRefreshTimer);
        currentState.autoRefreshTimer = null;
    }
}

function resetAutoRefresh() {
    startAutoRefresh();
}


function getFavorites() {
    const favorites = localStorage.getItem(CONFIG.FAVORITES_KEY);
    return favorites ? JSON.parse(favorites) : [];
}

function saveFavorites(favorites) {
    localStorage.setItem(CONFIG.FAVORITES_KEY, JSON.stringify(favorites));
}

function addToFavorites(cityName) {
    const favorites = getFavorites();
    
    const exists = favorites.some(fav => fav.toLowerCase() === cityName.toLowerCase());
    
    if (exists) {
        alert('This city is already in your favorites!');
        return;
    }
    
    favorites.push(cityName);
    saveFavorites(favorites);
    
    const originalText = elements.addFavoriteBtn.innerHTML;
    elements.addFavoriteBtn.innerHTML = `
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
    `;
    
    setTimeout(() => {
        elements.addFavoriteBtn.innerHTML = originalText;
    }, 2000);
}

function removeFromFavorites(cityName) {
    let favorites = getFavorites();
    favorites = favorites.filter(fav => fav.toLowerCase() !== cityName.toLowerCase());
    saveFavorites(favorites);
    renderFavorites();
}

function renderFavorites() {
    const favorites = getFavorites();
    
    if (favorites.length === 0) {
        elements.favoritesList.innerHTML = `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
                <p class="text-lg font-medium">No favorites yet</p>
                <p class="text-sm mt-2">Add cities to quickly access their weather</p>
            </div>
        `;
        return;
    }
    
    elements.favoritesList.innerHTML = favorites.map(city => `
        <div class="flex items-center justify-between p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:bg-gray-700 rounded-lg mb-3 hover:from-teal-100 hover:to-cyan-100 dark:hover:bg-gray-600 transition-all duration-200 border-2 border-teal-100 dark:border-gray-600">
            <button onclick="loadFavoriteCity('${city}')" class="flex-1 text-left font-bold text-teal-700 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400">
                ${city}
            </button>
            <button onclick="removeFromFavorites('${city}')" class="p-2 text-rose-500 dark:text-red-400 hover:bg-rose-100 dark:hover:bg-red-900/30 rounded-lg transition-colors duration-200" title="Hapus">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function loadFavoriteCity(cityName) {
    elements.favoritesModal.classList.add('hidden');
    elements.citySearch.value = cityName;
    loadWeatherData(cityName);
}

function showFavoritesModal() {
    renderFavorites();
    elements.favoritesModal.classList.remove('hidden');
}

function hideFavoritesModal() {
    elements.favoritesModal.classList.add('hidden');
}


function handleSearchInput() {
    const query = elements.citySearch.value.trim();
    
    if (currentState.searchDebounceTimer) {
        clearTimeout(currentState.searchDebounceTimer);
    }
    
    if (query.length < 2) {
        elements.suggestions.classList.add('hidden');
        return;
    }
    
    currentState.searchDebounceTimer = setTimeout(async () => {
        try {
            const result = await searchCity(query);
            
            if (result.success) {
                elements.suggestions.innerHTML = `
                    <div class="p-3 hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 dark:hover:bg-gray-600 cursor-pointer transition-all duration-200" 
                         onclick="selectCity('${result.data.name}')">
                        <p class="font-bold text-teal-700 dark:text-white">${result.data.name}, ${result.data.country}</p>
                        <p class="text-xs text-cyan-600 dark:text-gray-400">Lat: ${result.data.lat}, Lon: ${result.data.lon}</p>
                    </div>
                `;
                elements.suggestions.classList.remove('hidden');
            } else {
                elements.suggestions.innerHTML = `
                    <div class="p-3 text-teal-600 dark:text-gray-400 text-sm text-center font-medium">
                        Tidak ada hasil ditemukan
                    </div>
                `;
                elements.suggestions.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Search error:', error);
            elements.suggestions.classList.add('hidden');
        }
    }, CONFIG.SEARCH_DEBOUNCE_DELAY);
}

function selectCity(cityName) {
    elements.citySearch.value = cityName;
    elements.suggestions.classList.add('hidden');
    loadWeatherData(cityName);
}

function handleSearch() {
    const city = elements.citySearch.value.trim();
    
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    
    elements.suggestions.classList.add('hidden');
    loadWeatherData(city);
}


function initEventListeners() {
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.citySearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    elements.citySearch.addEventListener('input', handleSearchInput);
    
    elements.refreshBtn.addEventListener('click', () => {
        loadWeatherData(currentState.city);
    });
    
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    elements.unitCelsius.addEventListener('click', () => switchUnit('celsius'));
    elements.unitFahrenheit.addEventListener('click', () => switchUnit('fahrenheit'));
    
    elements.addFavoriteBtn.addEventListener('click', () => {
        if (currentState.weatherData) {
            addToFavorites(currentState.weatherData.city);
        }
    });
    elements.favoritesBtn.addEventListener('click', showFavoritesModal);
    elements.closeFavoritesBtn.addEventListener('click', hideFavoritesModal);
    
    elements.favoritesModal.addEventListener('click', (e) => {
        if (e.target === elements.favoritesModal) {
            hideFavoritesModal();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!elements.citySearch.contains(e.target) && !elements.suggestions.contains(e.target)) {
            elements.suggestions.classList.add('hidden');
        }
    });
}


function init() {
    console.log('Weather Dashboard initializing...');
    
    initTheme();
    
    initEventListeners();
    
    loadWeatherData(CONFIG.DEFAULT_CITY);
    
    startAutoRefresh();
    
    console.log('Weather Dashboard ready!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.selectCity = selectCity;
window.loadFavoriteCity = loadFavoriteCity;
window.removeFromFavorites = removeFromFavorites;
