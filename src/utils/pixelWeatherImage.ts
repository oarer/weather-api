import {
    createCanvas,
    loadImage,
    GlobalFonts,
    SKRSContext2D,
} from "@napi-rs/canvas";
import type { IWeatherData } from "@/types/weather.type";
import path from "node:path";
import { formatOtherInfo } from "./getLang";

type ThemeSize = "big" | "small";
type Language = "en" | "ru";

const themePath = path.join(process.cwd(), "public/themes/pixel-city");

export async function renderPixelCityTheme(
    weather: IWeatherData,
    language: Language,
    themeSize: ThemeSize
) {
    const isBig = themeSize === "big";
    const width = isBig ? 1024 : 512;
    const height = isBig ? 576 : 288;

    GlobalFonts.registerFromPath(
        path.join(themePath, "Poppins-SemiBold.ttf"),
        "Poppins"
    );
    GlobalFonts.registerFromPath(
        path.join(themePath, "Montserrat-Medium.ttf"),
        "Montserrat"
    );
    GlobalFonts.registerFromPath(
        path.join(themePath, "OpenSans-SemiBold.ttf"),
        "OpenSans"
    );

    const temperature = Math.round(weather.temperature.temp);
    const temperatureFl = Math.round(weather.temperature.feels_like);
    const details = capitalize(weather.detailed_status);
    const humidity = weather.humidity;
    const visibilityDistance = Math.round(
        (weather.visibility_distance ?? 10000) / 1000
    );
    const icon = weather.weather_icon_name;
    const backgroundName = mapIconToBackground(icon);

    const backgroundPath = path.join(
        themePath,
        "backgrounds",
        themeSize,
        `${backgroundName}.png`
    );
    const background = await loadImage(backgroundPath);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d") as SKRSContext2D;

    ctx.drawImage(background, 0, 0, width, height);

    const textTemperature = `${temperature}°C`;
    const otherInfo = formatOtherInfo(
        language,
        temperatureFl,
        humidity,
        visibilityDistance
    );

    drawTextWithShadow(
        ctx,
        textTemperature,
        width / 2,
        isBig ? 216 : 108,
        "Poppins",
        isBig ? 128 : 64
    );
    drawTextWithShadow(
        ctx,
        details,
        width / 2,
        isBig ? 357 : 178,
        "Montserrat",
        isBig ? 64 : 32
    );
    drawTextWithShadow(
        ctx,
        otherInfo,
        width / 2,
        isBig ? 435 : 217,
        "OpenSans",
        isBig ? 48 : 24
    );

    return canvas;
}

function drawTextWithShadow(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    size: number
) {
    ctx.font = `${size}px "${font}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (const [dx, dy] of [
        [2, 2],
        [-2, 2],
        [2, -2],
        [-2, -2],
    ]) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillText(text, x + dx, y + dy);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillText(text, x, y);
}

function mapIconToBackground(icon: string) {
    switch (icon) {
        case "01d":
            return "day";
        case "01n":
            return "night";
        case "02d":
        case "03d":
            return "day_few_clouds";
        case "02n":
        case "03n":
            return "night_few_clouds";
        case "04d":
        case "04n":
            return "broken_clouds";
        case "09d":
        case "09n":
            return "shower_rain";
        case "10d":
            return "day_rain";
        case "10n":
            return "night_rain";
        case "11d":
        case "11n":
            return "thunderstorm";
        case "13d":
        case "13n":
            return "snow";
        case "50n":
            return "mist";
        default:
            return "day";
    }
}

function capitalize(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
