export interface IWeatherData {
    temperature: { temp: number; feels_like: number };
    wind: { speed: number; deg: number };
    humidity: number;
    detailed_status: string;
    pressure: { press: number };
    visibility_distance: number;
    weather_icon_name: string;
}
