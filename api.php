<?php

require_once 'config.php';

function makeWeatherRequest($endpoint, $params = []) {
    $params['appid'] = OPENWEATHER_API_KEY;
    $url = OPENWEATHER_BASE_URL . $endpoint . '?' . http_build_query($params);
    $ch = curl_init();
    
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        return [
            'success' => false,
            'error' => 'Connection error: ' . $curlError,
            'http_code' => 0
        ];
    }
    
    $data = json_decode($response, true);
    
    return [
        'success' => ($httpCode >= 200 && $httpCode < 300),
        'data' => $data,
        'http_code' => $httpCode
    ];
}

function getCurrentWeather($city) {
    $params = [
        'q' => $city,
        'units' => 'metric'
    ];
    
    $result = makeWeatherRequest('weather', $params);
    
    if (!$result['success']) {
        return [
            'success' => false,
            'error' => $result['data']['message'] ?? 'Failed to fetch weather data',
            'http_code' => $result['http_code']
        ];
    }
    
    return [
        'success' => true,
        'data' => [
            'city' => $result['data']['name'],
            'country' => $result['data']['sys']['country'],
            'temperature' => $result['data']['main']['temp'],
            'feels_like' => $result['data']['main']['feels_like'],
            'temp_min' => $result['data']['main']['temp_min'],
            'temp_max' => $result['data']['main']['temp_max'],
            'humidity' => $result['data']['main']['humidity'],
            'pressure' => $result['data']['main']['pressure'],
            'wind_speed' => $result['data']['wind']['speed'],
            'wind_deg' => $result['data']['wind']['deg'] ?? 0,
            'clouds' => $result['data']['clouds']['all'],
            'weather' => [
                'main' => $result['data']['weather'][0]['main'],
                'description' => $result['data']['weather'][0]['description'],
                'icon' => $result['data']['weather'][0]['icon']
            ],
            'timestamp' => $result['data']['dt'],
            'sunrise' => $result['data']['sys']['sunrise'],
            'sunset' => $result['data']['sys']['sunset'],
            'timezone' => $result['data']['timezone']
        ]
    ];
}

function getForecast($city) {
    $params = [
        'q' => $city,
        'units' => 'metric'
    ];
    
    $result = makeWeatherRequest('forecast', $params);
    
    if (!$result['success']) {
        return [
            'success' => false,
            'error' => $result['data']['message'] ?? 'Failed to fetch forecast data',
            'http_code' => $result['http_code']
        ];
    }
    
    return [
        'success' => true,
        'data' => [
            'city' => $result['data']['city']['name'],
            'country' => $result['data']['city']['country'],
            'list' => $result['data']['list'],
            'timezone' => $result['data']['city']['timezone']
        ]
    ];
}

function searchCity($query) {
    if (strlen($query) < 2) {
        return [
            'success' => false,
            'error' => 'Query too short'
        ];
    }
    
    $params = [
        'q' => $query,
        'units' => 'metric'
    ];
    
    $result = makeWeatherRequest('weather', $params);
    
    if (!$result['success']) {
        return [
            'success' => false,
            'error' => 'City not found'
        ];
    }
    
    return [
        'success' => true,
        'data' => [
            'name' => $result['data']['name'],
            'country' => $result['data']['sys']['country'],
            'lat' => $result['data']['coord']['lat'],
            'lon' => $result['data']['coord']['lon']
        ]
    ];
}

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'current':
            $city = $_GET['city'] ?? '';
            
            if (empty($city)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'City parameter is required'
                ]);
                exit;
            }
            
            $response = getCurrentWeather($city);
            echo json_encode($response);
            break;
            
        case 'forecast':
            $city = $_GET['city'] ?? '';
            
            if (empty($city)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'City parameter is required'
                ]);
                exit;
            }
            
            $response = getForecast($city);
            echo json_encode($response);
            break;
            
        case 'search':
            $query = $_GET['q'] ?? '';
            
            if (empty($query)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'Query parameter is required'
                ]);
                exit;
            }
            
            $response = searchCity($query);
            echo json_encode($response);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'error' => 'Invalid action. Available actions: current, forecast, search'
            ]);
            break;
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Server error: ' . $e->getMessage()
    ]);
}
?>
