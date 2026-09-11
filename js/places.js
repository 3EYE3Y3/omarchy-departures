.pragma library

function clean(value, maxLength) {
    return String(value || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ").slice(0, maxLength || 160)
}

function key(value) {
    return clean(value, 160).toLowerCase()
}

function coordinates(value) {
    if (!value) return null
    var latitude = Number(value.latitude)
    var longitude = Number(value.longitude)
    if (!isFinite(latitude) || !isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
    return { latitude: latitude, longitude: longitude }
}

function optionalNumber(value) {
    if (value === null || value === undefined || value === "") return NaN
    var number = Number(value)
    return isFinite(number) ? number : NaN
}

function idFor(value) {
    var text = key(value)
    var hash = 5381
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
    return "place-" + hash.toString(36)
}

function find(places, value) {
    var target = key(value)
    var source = Array.isArray(places) ? places : []
    for (var i = 0; i < source.length; i++) {
        var place = source[i]
        if (String(place.id) === String(value) || key(place.name) === target || key(place.address) === target) return place
    }
    return null
}

function weighted(previous, samples, next) {
    var count = Math.max(0, Number(samples) || 0)
    var value = Number(next)
    if (!isFinite(value)) return Number(previous) || 0
    return Math.round(((Number(previous) || 0) * count + value) / (count + 1))
}

function normalize(input) {
    if (!input) return null
    var name = clean(input.name || input.address, 80)
    var address = clean(input.address || input.name, 160)
    if (!name || !address) return null
    return {
        id: clean(input.id || idFor(name), 80),
        name: name,
        address: address,
        coordinates: coordinates(input.coordinates),
        normalTravelMinutes: Math.max(0, Math.round(Number(input.normalTravelMinutes) || 0)),
        arrivalBufferMinutes: Math.max(0, Math.round(Number(input.arrivalBufferMinutes) || 0)),
        parkingMinutes: Math.max(0, Math.round(Number(input.parkingMinutes) || 0)),
        walkingMinutes: Math.max(0, Math.round(Number(input.walkingMinutes) || 0)),
        preparationMinutes: Math.max(0, Math.round(Number(input.preparationMinutes) || 0)),
        preferredOriginPlaceId: clean(input.preferredOriginPlaceId, 80),
        kitKey: clean(input.kitKey, 80).toLowerCase(),
        samples: Math.max(0, Math.round(Number(input.samples) || 0)),
        routeSamples: Math.max(0, Math.round(Number(input.routeSamples) || 0)),
        geocodedAt: Math.max(0, Number(input.geocodedAt) || 0),
        modifiedAt: Math.max(0, Number(input.modifiedAt) || Date.now())
    }
}

function observeRoute(places, value, travelMinutes, now) {
    var existing = find(places, value)
    var observed = Number(travelMinutes)
    if (!existing || !isFinite(observed) || observed < 0) return Array.isArray(places) ? places.slice() : []
    var copy = normalize(existing)
    copy.normalTravelMinutes = weighted(copy.normalTravelMinutes, copy.routeSamples, observed)
    copy.routeSamples += 1
    copy.modifiedAt = Number(now) || Date.now()
    return upsert(places, copy)
}

function upsert(places, input) {
    var place = normalize(input)
    if (!place) return Array.isArray(places) ? places.slice() : []
    var result = []
    var replaced = false
    var source = Array.isArray(places) ? places : []
    for (var i = 0; i < source.length; i++) {
        if (String(source[i].id) === place.id || key(source[i].name) === key(place.name)) {
            result.push(place)
            replaced = true
        } else result.push(source[i])
    }
    if (!replaced) result.push(place)
    return result.sort(function(a, b) { return String(a.name).localeCompare(String(b.name)) })
}

function remove(places, value) {
    var target = find(places, value)
    if (!target) return Array.isArray(places) ? places.slice() : []
    return places.filter(function(place) { return String(place.id) !== String(target.id) })
}

function learn(places, departure, now) {
    if (!departure || !clean(departure.destination, 160)) return Array.isArray(places) ? places.slice() : []
    var existing = find(places, departure.destinationPlaceId || departure.destination)
    var samples = existing ? Number(existing.samples || 0) : 0
    var normal = optionalNumber(departure.routeTypicalMinutes)
    if (!isFinite(normal)) normal = optionalNumber(departure.manualTravelMinutes)
    if (!isFinite(normal)) normal = optionalNumber(departure.autoTravelMinutes)
    if (!isFinite(normal)) normal = optionalNumber(departure.travelMinutes)
    var learned = {
        id: existing ? existing.id : idFor(departure.destination),
        name: existing ? existing.name : clean(departure.destination, 80),
        address: existing ? existing.address : clean(departure.destination, 160),
        coordinates: coordinates(departure.destinationCoordinates) || (existing ? existing.coordinates : null),
        normalTravelMinutes: weighted(existing && existing.normalTravelMinutes, samples, normal),
        arrivalBufferMinutes: weighted(existing && existing.arrivalBufferMinutes, samples, departure.arrivalBufferMinutes),
        parkingMinutes: weighted(existing && existing.parkingMinutes, samples, departure.parkingMinutes),
        walkingMinutes: weighted(existing && existing.walkingMinutes, samples, departure.walkingMinutes),
        preparationMinutes: weighted(existing && existing.preparationMinutes, samples, departure.preparationMinutes),
        preferredOriginPlaceId: clean(departure.originPlaceId || (existing && existing.preferredOriginPlaceId), 80),
        kitKey: clean(departure.kitKey || departure.profile || (existing && existing.kitKey), 80).toLowerCase(),
        samples: samples + 1,
        geocodedAt: existing ? Number(existing.geocodedAt || 0) : 0,
        modifiedAt: Number(now) || Date.now()
    }
    return upsert(places, learned)
}

function withGeocode(places, value, result, now) {
    var existing = find(places, value)
    var place = normalize(existing || { name: value, address: value })
    if (!place || !result || !result.coordinates) return Array.isArray(places) ? places.slice() : []
    place.coordinates = coordinates(result.coordinates)
    place.address = clean(result.label || place.address, 160)
    place.geocodedAt = Number(now) || Date.now()
    place.modifiedAt = Number(now) || Date.now()
    return upsert(places, place)
}

function defaults(place) {
    if (!place) return null
    return {
        travelMinutes: Number(place.normalTravelMinutes || 0),
        arrivalBufferMinutes: Number(place.arrivalBufferMinutes || 0),
        parkingMinutes: Number(place.parkingMinutes || 0),
        walkingMinutes: Number(place.walkingMinutes || 0),
        preparationMinutes: Number(place.preparationMinutes || 0),
        originPlaceId: String(place.preferredOriginPlaceId || ""),
        kitKey: String(place.kitKey || "")
    }
}
