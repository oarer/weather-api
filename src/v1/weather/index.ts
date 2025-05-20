import { Elysia, t } from "elysia";
import axios from "axios";
import { generateWeatherImage } from "@/utils/defaultWeatherImage";
import { renderPixelCityTheme } from "@/utils/pixelWeatherImage";
import { DateTime } from "luxon";
import { randomUUID } from "crypto";
import { IWeatherData } from "@/types/weather.type";
import { languageMap } from "@/constants/languageMap.const";

interface CacheEntry {
    timestamp: number;
    response: any;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 60 * 1000;

function getCacheKey(...args: any[]) {
    return JSON.stringify(args);
}

function normalizeTimezone(tz: string): string | null {
    const clean = tz.replace(/\s+/g, "").toUpperCase();
    const match = clean.match(/^UTC([+-]?\d{1,2})$/);
    if (match) {
        const offset = parseInt(match[1], 10);
        return `Etc/GMT${-offset}`;
    }
    if (DateTime.now().setZone(tz).isValid) {
        return tz;
    }
    return null;
}

function validateParams(
    place: string,
    rawLang: string,
    theme: string,
    rawTimezone: string
) {
    if (!place.trim()) {
        return {
            code: "place_not_found",
            message: "`place` parameter is required and cannot be empty.",
        };
    }

    const allowedThemes = ["default", "city"];
    if (theme && !allowedThemes.includes(theme)) {
        return {
            code: "theme_not_found",
            message: `Theme '${theme}' not found. Allowed: ${allowedThemes.join(", ")}.`,
        };
    }

    if (theme === "city") {
        const key = rawLang.toLowerCase();
        if (!languageMap[key]) {
            return {
                code: "lang_not_supported",
                message: `Language '${rawLang}' not supported for city theme.`,
            };
        }
    }

    if (!normalizeTimezone(rawTimezone)) {
        return {
            code: "tz_not_supported",
            message: `Timezone '${rawTimezone}' is not recognized.`,
        };
    }
    return null;
}

async function fetchRawWeather(place: string, language: string, token: string) {
    return axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: { q: place, appid: token, lang: language, units: "metric" },
    });
}

function normalizeWeather(raw: any): IWeatherData {
    return {
        temperature: { temp: raw.main.temp, feels_like: raw.main.feels_like },
        wind: { speed: raw.wind.speed, deg: raw.wind.deg },
        humidity: raw.main.humidity,
        detailed_status: raw.weather?.[0]?.description ?? "Unknown",
        pressure: { press: raw.main.pressure },
        visibility_distance: raw.visibility,
        weather_icon_name: raw.weather?.[0]?.icon.slice(0, 2),
    };
}

export default new Elysia({ prefix: "/v1" }).get(
    "/weather",
    async ({ query }) => {
        const {
            place = "",
            timezone: rawTimezone = "Europe/Moscow",
            lang = "ru",
            json: jsonFlag = "false",
            theme = "",
            size: rawSize = "big",
        } = query as Record<string, string>;

        const validationError = validateParams(place, lang, theme, rawTimezone);
        if (validationError) {
            return {
                status: 400,
                body: {
                    status: "error",
                    code: validationError.code,
                    message: validationError.message,
                },
            };
        }

        const timezone = normalizeTimezone(rawTimezone)!;
        const size = rawSize === "small" ? "small" : "big";

        const language =
            theme === "city" ? languageMap[lang.toLowerCase()] : lang;

        const cacheKey = getCacheKey(
            place,
            language,
            jsonFlag,
            theme,
            timezone,
            size
        );
        const cached = cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            const data = cached.response;
            if (theme === "default" || theme === "city") {
                return new Response(data, {
                    status: 200,
                    headers: {
                        "Content-Type": "image/png",
                        "Cache-Control": "no-store",
                    },
                });
            }
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                },
            });
        }

        try {
            const token = process.env.TOKEN;
            if (!token) throw new Error("API token is not set");

            const res = await fetchRawWeather(place, language, token);
            const rawWeather = res.data;

            const weatherData = normalizeWeather(rawWeather);

            let responsePayload: Buffer | object;

            if (theme === "default") {
                responsePayload = await generateWeatherImage(
                    weatherData,
                    language,
                    timezone
                );
            } else if (theme === "city") {
                const canvas = await renderPixelCityTheme(
                    weatherData,
                    language as any,
                    size
                );
                responsePayload = await canvas.encode("png");
            } else {
                responsePayload = {
                    status: "success",
                    temp: weatherData.temperature.temp,
                    feels_like: weatherData.temperature.feels_like,
                    pressure: weatherData.pressure.press,
                    visibility: weatherData.visibility_distance,
                    humidity: weatherData.humidity,
                    wind: weatherData.wind,
                    condition: weatherData.detailed_status,
                    icon: weatherData.weather_icon_name,
                };
            }

            cache.set(cacheKey, {
                timestamp: Date.now(),
                response: responsePayload,
            });

            if (responsePayload instanceof Buffer) {
                return new Response(responsePayload, {
                    status: 200,
                    headers: {
                        "Content-Type": "image/png",
                        "Cache-Control": "no-store",
                    },
                });
            }

            return new Response(JSON.stringify(responsePayload), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                },
            });
        } catch (err: any) {
            const errorId = randomUUID();

            if (axios.isAxiosError(err)) {
                const statusCode = err.response?.status;
                if (statusCode === 404) {
                    return {
                        status: 404,
                        body: {
                            status: "error",
                            code: "place_not_found",
                            message: `Place '${place}' not found.`,
                            error_id: errorId,
                        },
                    };
                }
                if (statusCode === 401) {
                    return {
                        status: 401,
                        body: {
                            status: "error",
                            code: "invalid_api_key",
                            message: "Invalid or missing API key.",
                            error_id: errorId,
                        },
                    };
                }
                return {
                    status: statusCode || 502,
                    body: {
                        status: "error",
                        code: "api_error",
                        message: `External API error: ${err.response?.data?.message || err.message}`,
                        error_id: errorId,
                    },
                };
            }

            console.error(`Error [${errorId}] in /weather:`, err);
            return {
                status: 500,
                body: {
                    status: "error",
                    code: "internal_error",
                    message: "Internal server error.",
                    error: err.message,
                    error_id: errorId,
                },
            };
        }
    },
    {
        query: t.Object({
            place: t.String(),
            timezone: t.Optional(t.String()),
            lang: t.Optional(t.String()),
            json: t.Optional(t.String()),
            theme: t.Optional(t.String()),
            size: t.Optional(t.Union([t.Literal("small"), t.Literal("big")])),
        }),
    }
);
