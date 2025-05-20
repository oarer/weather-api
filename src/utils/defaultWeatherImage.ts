import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { IWeatherData } from '@/types/weather.type'

dayjs.extend(utc);
dayjs.extend(timezone);

const themePath = path.join(process.cwd(), "public/themes/default");

GlobalFonts.registerFromPath(
    path.join(themePath, "resources/manrope-bold.ttf"),
    "Manrope"
);

function normalizeTimezone(tz?: string): string | number {
    if (!tz) return "Europe/Moscow";
    const match = tz.match(/^UTC([+-]\d{1,2})$/);
    if (match) return parseInt(match[1], 10);
    return tz;
}

export async function generateWeatherImage(
    weather: IWeatherData,
    language: string,
    tz?: string
): Promise<Buffer> {
    const langRaw = await fs.readFile(
        path.join(themePath, "resources/lang.json"),
        "utf-8"
    );
    const lang = JSON.parse(langRaw);

    const background = await loadImage(
        path.join(themePath, "resources/background.png")
    );
    const icon = await loadImage(
        path.join(themePath, `icons/${weather.weather_icon_name}.png`)
    );
    const windArrow = await loadImage(
        path.join(themePath, "resources/wind.png")
    );
    const line = await loadImage(path.join(themePath, "resources/line.png"));

    const width = 440;
    const height = 145;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, width, height);
    ctx.drawImage(icon, 0, height / 2 - 45, 90, 90);

    const windCanvas = createCanvas(windArrow.width, windArrow.height);
    const windCtx = windCanvas.getContext("2d");
    windCtx.translate(windArrow.width / 2, windArrow.height / 2);
    windCtx.rotate(((180 - weather.wind.deg) * Math.PI) / 180);
    windCtx.translate(-windArrow.width / 2, -windArrow.height / 2);
    windCtx.drawImage(windArrow, 0, 0);
    ctx.drawImage(windCanvas, 180, 15);
    ctx.drawImage(line, 170, 8);

    ctx.font = "16px Manrope";
    ctx.fillStyle = "#fff";

    ctx.fillText(`${Math.round(weather.temperature.temp)}°C`, 90, 55);
    ctx.fillText(`fl: ${Math.round(weather.temperature.feels_like)}°C`, 90, 75);

    const windText = `${weather.wind.speed.toFixed(1)}m/s ${
        lang["wind_dir"][language][Math.round(weather.wind.deg / 45) % 8]
    }`;
    const pressure = `${Math.round(weather.pressure.press / 1.333)} ${
        lang["pressure"][language]
    }`;
    const humidity = `${lang["humidity"][language]}: ${weather.humidity}%`;
    const visibility = `${lang["visibility"][language]}: ${
        Math.round(weather.visibility_distance / 100) / 10
    }${lang["visibility_range"][language]}`;
    const status =
        weather.detailed_status[0].toUpperCase() +
        weather.detailed_status.slice(1);

    ctx.fillText(windText, 210, 30);
    ctx.fillText(pressure, 180, 50);
    ctx.fillText(humidity, 180, 70);
    ctx.fillText(visibility, 180, 90);
    ctx.fillText(status, 180, 110);

    const tzValue = normalizeTimezone(tz);
    const now =
        typeof tzValue === "number"
            ? dayjs().utcOffset(tzValue * 60)
            : dayjs().tz(tzValue);

    const formattedTime = `${lang["at_the_moment"][language]} ${now.format("HH:mm")} UTC${now.format("Z")}`;
    ctx.fillText(formattedTime, 180, 130);

    ctx.font = "10px Manrope";
    ctx.fillText("by oarer", 5, height - 5);

    return canvas.toBuffer("image/png");
}
