.pragma library

// WeatherProvider normalization boundary reserved for contextual prompts. v0.2
// intentionally performs no weather requests; routing reliability has priority.
function unavailable() {
    return { available: false, provider: "none", reason: "Weather is deferred in v0.2" }
}

function normalize(provider, input) {
    if (!input || !isFinite(Number(input.observedAt)))
        return { ok: false, provider: String(provider || "weather"), error: { code: "malformed_response", message: "Weather response is invalid" } }
    return {
        ok: true,
        provider: String(provider || "weather"),
        value: {
            observedAt: Number(input.observedAt),
            rainProbability: Math.max(0, Math.min(100, Number(input.rainProbability) || 0)),
            temperatureC: isFinite(Number(input.temperatureC)) ? Number(input.temperatureC) : null,
            summary: String(input.summary || "")
        }
    }
}
