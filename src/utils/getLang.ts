import { translations } from "@/constants/translations.const";
import { ILanguageMap } from '@/types/languageMap.type'

function getTranslation(language: ILanguageMap) {
    const lang =
        language === "sp"
            ? "es"
            : language === "uk"
              ? "ua"
              : language === "se"
                ? "sv"
                : language === "zh_cn"
                  ? "zh"
                  : language;

    return {
        fl: translations.feels_like[lang] ?? "fl",
        h: translations.humidity[lang] ?? "H",
        v: translations.visibility[lang] ?? "V",
    };
}

export function formatOtherInfo(
    language: ILanguageMap,
    temperatureFl: number,
    humidity: number,
    visibilityDistance: number
): string {
    const t = getTranslation(language);
    return `${t.fl}: ${temperatureFl}°C / ${t.h}: ${humidity}% / ${t.v}: ${visibilityDistance} km`;
}
