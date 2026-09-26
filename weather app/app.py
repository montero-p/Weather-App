import json
import os
from datetime import datetime, timedelta
from urllib import parse, request

from flask import Flask, jsonify, request as flask_request, send_file


app = Flask(__name__, static_folder='.', static_url_path='')
API_KEY = os.getenv('WEATHER_API_KEY', 'VDWCFJDEBHFJS447JXYN9Y9ZV')


@app.route('/')
def index():
    return send_file('index.html')


@app.route('/api/weather')
def weather():
    location = (flask_request.args.get('location') or '').strip()
    lat = flask_request.args.get('lat', '').strip()
    lon = flask_request.args.get('lon', '').strip()

    if not location and (not lat or not lon):
        return jsonify({'error': 'Location is required.'}), 400

    if lat and lon:
        try:
            float(lat)
            float(lon)
        except ValueError:
            return jsonify({'error': 'Latitude and longitude must be valid numbers.'}), 400
        location_value = f'{lat},{lon}'
    else:
        location_value = parse.quote(location, safe='')

    today = datetime.now()
    start_date = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    end_date = (today + timedelta(days=1)).strftime('%Y-%m-%d')

    url = (
        'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/'
        f'timeline/{parse.quote(location_value, safe=",-")}/{start_date}/{end_date}'
        '?unitGroup=metric&include=current%2Chours%2Cdays'
        f'&key={API_KEY}&contentType=json'
    )

    try:
        api_request = request.Request(url, headers={'User-Agent': 'WeatherApp/1.0'})
        with request.urlopen(api_request, timeout=20) as response:
            data = json.loads(response.read().decode('utf-8'))
        return jsonify(data)
    except Exception as exc:
        print(f'Weather request failed: {exc}')
        return jsonify({
            'error': 'Unable to fetch weather for that location. Please try another city or town.'
        }), 500


@app.route('/<path:path>')
def serve_static(path):
    return send_file(path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
